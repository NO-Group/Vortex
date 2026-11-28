import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth, softAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from './tokens.js';
import { OidcService } from './oidc.service.js';
import type { OAuthClient, OAuthClientCreateInput } from './oidc.types.js';

const SUPER_ADMIN_EMAIL = process.env.VORTEX_SUPER_ADMIN?.trim().toLowerCase();

/** True if the user is the super admin (bypasses all role checks). */
function isSuperAdmin(req: { auth?: { email?: string } }): boolean {
  return req.auth?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
}

const clientCreateSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(256).optional(),
  redirectUris: z.array(z.string().url()).min(1).max(10),
  scopes: z.array(z.string()).optional(),
  grantTypes: z.array(z.string()).optional(),
  logoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
});

const clientUpdateSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(256).optional(),
  redirectUris: z.array(z.string().url()).min(1).max(10).optional(),
  scopes: z.array(z.string()).optional(),
  grantTypes: z.array(z.string()).optional(),
  logoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
});

/** Strip sensitive fields from a client for public display. */
function publicClient(client: OAuthClient): OAuthClient {
  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    description: client.description,
    redirectUris: client.redirectUris,
    scopes: client.scopes,
    grantTypes: client.grantTypes,
    logoUrl: client.logoUrl,
    websiteUrl: client.websiteUrl,
    enabled: client.enabled,
    appId: client.appId,
    ownerId: client.ownerId,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

/**
 * OIDC / SSO Identity Server routes.
 *
 * Public:
 *   GET  /v1/auth/oidc/discovery              — OIDC discovery document
 *   GET  /v1/auth/oidc/jwks                   — JSON Web Key Set
 *   GET  /v1/auth/oidc/authorize              — Authorization endpoint
 *   POST /v1/auth/oidc/token                  — Token endpoint
 *   GET  /v1/auth/oidc/userinfo               — UserInfo endpoint
 *
 * Authenticated (user):
 *   GET  /v1/auth/oidc/clients                — List your OAuth clients
 *   POST /v1/auth/oidc/clients                — Register a new client
 *   GET  /v1/auth/oidc/clients/:clientId      — Get client details
 *   PATCH /v1/auth/oidc/clients/:clientId     — Update client
 *   DELETE /v1/auth/oidc/clients/:clientId    — Delete client
 */
export function createOidcRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new OidcService(
    ctx.db,
    ctx.env.jwt as TokenConfig,
    { publicAppUrl: ctx.env.publicAppUrl },
  );
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  // Pre-load the JWKS key at startup
  void service.preloadKey();

  // ── Discovery ─────────────────────────────────────────────────────────

  router.get('/discovery', async (_req, res, next) => {
    try {
      res.json(service.getDiscovery());
    } catch (err) {
      next(err);
    }
  });

  // ── JWKS ─────────────────────────────────────────────────────────────

  router.get('/jwks', async (_req, res, next) => {
    try {
      const jwks = await service.getJwks();
      res.json(jwks);
    } catch (err) {
      next(err);
    }
  });

  // ── Authorization Endpoint ────────────────────────────────────────────

  router.get('/authorize', softAuth(ctx.env.jwt as TokenConfig), async (req, res, next) => {
    try {
      const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, nonce } = req.query as Record<string, string | undefined>;

      if (!client_id) throw ApiError.badRequest('Missing client_id');
      if (!redirect_uri) throw ApiError.badRequest('Missing redirect_uri');
      if (response_type !== 'code') {
        throw ApiError.badRequest('Only response_type=code is supported');
      }

      const client = await service.requireClient(client_id);
      if (!client.redirectUris.includes(redirect_uri)) {
        throw ApiError.badRequest('Invalid redirect_uri');
      }

      // If the user is not authenticated, redirect to login
      if (!req.auth) {
        const loginUrl = new URL('/v1/auth/login', ctx.env.publicAppUrl);
        loginUrl.searchParams.set('redirect', req.originalUrl);
        return res.redirect(loginUrl.toString());
      }

      const user = req.auth;
      const requestedScope = scope ?? 'openid profile email';

      // Check if requested scopes are within client's allowed scopes
      const clientScopes = client.scopes;
      const requested = requestedScope.split(' ').filter(Boolean);
      const allowed = requested.filter((s) => clientScopes.includes(s));
      const effectiveScope = allowed.length > 0 ? allowed.join(' ') : 'openid';

      // Create the authorization code
      const authCode = await service.createAuthCode(
        client_id,
        user.sub,
        redirect_uri,
        effectiveScope,
        code_challenge ?? null,
        code_challenge_method ?? null,
        nonce ?? null,
      );

      // Redirect back to the client with the code
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set('code', authCode.code);
      if (state) redirectUrl.searchParams.set('state', state);

      res.redirect(redirectUrl.toString());
    } catch (err) {
      next(err);
    }
  });

  // ── Token Endpoint ────────────────────────────────────────────────────

  router.post('/token', async (req, res, next) => {
    try {
      const { grant_type, code, redirect_uri, client_id, client_secret, code_verifier, refresh_token } = req.body as Record<string, string | undefined>;

      if (grant_type === 'authorization_code') {
        if (!code) throw ApiError.badRequest('Missing code');
        if (!client_id) throw ApiError.badRequest('Missing client_id');
        if (!redirect_uri) throw ApiError.badRequest('Missing redirect_uri');

        const result = await service.exchangeAuthCode(
          code,
          client_id,
          client_secret ?? null,
          redirect_uri,
          code_verifier ?? null,
        );

        const includeRefresh = result.scope.includes('offline_access');
        const tokenResponse = await service.buildTokenResponse(
          result.user,
          client_id,
          result.scope,
          result.nonce,
          includeRefresh,
        );

        res.json(tokenResponse);
      } else if (grant_type === 'refresh_token') {
        if (!refresh_token) throw ApiError.badRequest('Missing refresh_token');
        if (!client_id) throw ApiError.badRequest('Missing client_id');

        // Validate the client first
        const client = await service.requireClient(client_id);

        // Verify client secret if one is set
        if (client_secret) {
          await service.verifyClientSecret(client_id, client_secret);
        }

        const { user, scope } = await service.validateRefreshToken(refresh_token, client_id);

        // Build a new token response (refresh tokens are rotated — a new one is issued)
        const tokenResponse = await service.buildTokenResponse(
          user,
          client_id,
          scope,
          null,
          true,
        );

        res.json(tokenResponse);
      } else {
        throw ApiError.badRequest(`Unsupported grant_type: ${grant_type}`);
      }
    } catch (err) {
      next(err);
    }
  });

  // ── UserInfo Endpoint ─────────────────────────────────────────────────

  router.get('/userinfo', auth, async (req, res, next) => {
    try {
      const claims = req.auth!;
      const user = await ctx.db('users').where({ id: claims.sub }).first();
      if (!user) throw ApiError.notFound('User not found');

      const scope = (req.headers['scope'] as string) ?? 'openid profile email';
      const scopes = scope.split(' ');

      const response: Record<string, unknown> = {
        sub: user.id,
      };

      if (scopes.includes('profile')) {
        response.name = (user.metadata?.name as string) ?? user.email;
        response.picture = (user.metadata?.picture as string) ?? null;
      }
      if (scopes.includes('email')) {
        response.email = user.email;
        response.email_verified = true;
      }

      res.json(response);
    } catch (err) {
      next(err);
    }
  });

  // ── Client Management (authenticated users) ──────────────────────────

  router.get('/clients', auth, async (req, res, next) => {
    try {
      const isAdmin = req.auth!.role === 'admin' || isSuperAdmin(req);
      const clients = await service.listClients(req.auth!.sub, isAdmin);
      res.json({ clients: clients.map(publicClient) });
    } catch (err) {
      next(err);
    }
  });

  router.post('/clients', auth, validateBody(clientCreateSchema), async (req, res, next) => {
    try {
      const input: OAuthClientCreateInput = {
        name: req.body.name,
        description: req.body.description,
        redirectUris: req.body.redirectUris,
        scopes: req.body.scopes,
        grantTypes: req.body.grantTypes,
        logoUrl: req.body.logoUrl,
        websiteUrl: req.body.websiteUrl,
      };

      // Generate the client secret
      const clientSecret = randomUUID();
      const client = await service.createClient(req.auth!.sub, input, clientSecret);

      res.status(201).json({
        client: publicClient(client),
        // Secret is only returned on creation
        client_secret: clientSecret,
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/clients/:clientId', auth, async (req, res, next) => {
    try {
      const client = await service.getClient(req.params.clientId!);
      if (!client) throw ApiError.notFound('Client not found');
      if (req.auth!.role !== 'admin' && !isSuperAdmin(req) && client.ownerId !== req.auth!.sub) {
        throw ApiError.forbidden('You do not own this client');
      }
      res.json({ client: publicClient(client) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/clients/:clientId', auth, validateBody(clientUpdateSchema), async (req, res, next) => {
    try {
      const client = await service.updateClient(
        req.params.clientId!,
        req.auth!.sub,
        req.auth!.role === 'admin' || isSuperAdmin(req),
        req.body,
      );
      res.json({ client: publicClient(client) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/clients/:clientId', auth, async (req, res, next) => {
    try {
      await service.removeClient(
        req.params.clientId!,
        req.auth!.sub,
        req.auth!.role === 'admin' || isSuperAdmin(req),
      );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
