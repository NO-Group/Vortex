import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { OAuthService } from './oauth.service.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from './tokens.js';

const providerUpsertSchema = z.object({
  name: z.enum(['google', 'github', 'gitlab', 'discord', 'apple', 'microsoft']),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
  displayName: z.string().min(1).max(64).optional(),
});

/**
 * OAuth routes.
 *
 * Public:
 *   GET  /v1/auth/oauth/providers        — list enabled providers (for login UI)
 *   GET  /v1/auth/oauth/:provider/start  — redirect to provider's authorize URL
 *   GET  /v1/auth/oauth/:provider/callback — handle provider redirect, return session
 *
 * Authenticated:
 *   GET  /v1/auth/oauth/accounts          — list your linked provider accounts
 *   DELETE /v1/auth/oauth/accounts/:provider — unlink a provider
 *
 * Admin:
 *   GET  /v1/auth/oauth/admin/providers   — list all configured providers
 *   POST /v1/auth/oauth/admin/providers   — create/update a provider
 *   DELETE /v1/auth/oauth/admin/providers/:name — remove a provider
 */
export function createOAuthRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new OAuthService(
    ctx.db,
    ctx.env.jwt as TokenConfig,
    { publicAppUrl: ctx.env.publicAppUrl },
  );
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  function requireAdmin(role: string | undefined): void {
    if (role !== 'admin') throw ApiError.forbidden('Admin access required');
  }

  // ── Public: list enabled providers ────────────────────────────────────
  router.get('/providers', async (_req, res, next) => {
    try {
      const providers = await service.listEnabledProviders();
      res.json({
        providers: providers.map((p) => ({
          name: p.name,
          displayName: p.displayName,
          scopes: p.scopes,
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Public: start OAuth flow (redirect to provider) ───────────────────
  router.get('/:provider/start', async (req, res, next) => {
    try {
      const providerName = req.params.provider!;
      const state = randomUUID();
      const redirectUri = service.redirectUri(providerName);
      const url = await service.getAuthorizeUrl(providerName, redirectUri, state);
      res.redirect(302, url);
    } catch (err) {
      next(err);
    }
  });

  // ── Public: OAuth callback (provider redirects here) ──────────────────
  router.get('/:provider/callback', async (req, res, next) => {
    try {
      const providerName = req.params.provider!;
      const code = String(req.query.code ?? '');
      if (!code) {
        throw ApiError.badRequest('Missing authorization code');
      }

      const redirectUri = service.redirectUri(providerName);
      const result = await service.handleCallback(providerName, code, redirectUri);

      // For browser-based flows, redirect to the console with the token.
      // For API clients, return the session as JSON.
      const redirect = String(req.query.redirect ?? '');
      if (redirect) {
        const sep = redirect.includes('?') ? '&' : '?';
        res.redirect(302, `${redirect}${sep}vortex_token=${encodeURIComponent(result.session.token)}`);
        return;
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── Authenticated: list linked accounts ──────────────────────────────
  router.get('/accounts', auth, async (req, res, next) => {
    try {
      const accounts = await service.listAccounts(req.auth!.sub);
      res.json({ accounts });
    } catch (err) {
      next(err);
    }
  });

  // ── Authenticated: unlink a provider ─────────────────────────────────
  router.delete('/accounts/:provider', auth, async (req, res, next) => {
    try {
      await service.unlinkAccount(req.auth!.sub, req.params.provider!, req.auth!.sub);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Admin: list all providers ─────────────────────────────────────────
  router.get('/admin/providers', auth, async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role);
      const providers = await service.listProviders();
      // Mask client secrets in the response.
      res.json({
        providers: providers.map((p) => ({
          ...p,
          clientSecret: p.clientSecret ? '••••••' : '',
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  // ── Admin: create/update a provider ───────────────────────────────────
  router.post('/admin/providers', auth, validateBody(providerUpsertSchema), async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role);
      const provider = await service.upsertProvider(req.body);
      res.status(201).json({ provider });
    } catch (err) {
      next(err);
    }
  });

  // ── Admin: remove a provider ──────────────────────────────────────────
  router.delete('/admin/providers/:name', auth, async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role);
      await service.removeProvider(req.params.name!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
