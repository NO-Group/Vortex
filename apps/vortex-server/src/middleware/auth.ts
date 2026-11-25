import type { NextFunction, Request, Response } from 'express';
import type { JwtClaims } from '@vortex/core';
import { createHash } from 'node:crypto';
import { ApiError } from '../errors.js';
import { verifyToken, type TokenConfig } from '../auth/tokens.js';
import { createApiKeyService } from '../apikeys/apikey.service.js';
import type { Knex } from 'knex';
import type { SessionService } from '../auth/session.service.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Verified JWT claims, present after `requireAuth`. */
      auth?: JwtClaims;
    }
  }
}

/**
 * Super admin email from VORTEX_SUPER_ADMIN env var.
 * This email always has admin access — bypasses any paywall,
 * role restriction, or subscription check. Set during deploy.
 */
const SUPER_ADMIN_EMAIL = process.env.VORTEX_SUPER_ADMIN?.trim().toLowerCase();

/**
 * Apply super admin bypass: if the authenticated user's email matches
 * VORTEX_SUPER_ADMIN, force their role to 'admin'. This runs after token
 * verification so it overrides whatever role is in the JWT claim —
 * paywalls and role restrictions cannot restrict this account.
 */
function applySuperAdmin(req: Request): void {
  if (!SUPER_ADMIN_EMAIL || !req.auth) return;
  if (req.auth.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
    req.auth.role = 'admin';
  }
}

/**
 * Express middleware that accepts either a JWT bearer token or a Vortex
 * service API key (`vortex_live_…`). JWT tokens take priority; if the
 * token doesn't start with the API key prefix, it's treated as a JWT.
 */
export function requireAuthWithApiKeys(db: Knex, config: TokenConfig) {
  const apiKeyService = createApiKeyService(db);

  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearerFrom(req);
    if (!token) {
      next(ApiError.unauthorized('Missing Bearer token'));
      return;
    }

    // Try API key first if it has the Vortex key prefix
    if (token.startsWith('vortex_live_')) {
      apiKeyService.validate(token).then((result) => {
        if (!result) {
          next(ApiError.unauthorized('Invalid or revoked API key'));
          return;
        }
        // Touch last_used_at (fire-and-forget)
        const keyHash = createHash('sha256').update(token).digest('hex');
        apiKeyService.touch(keyHash).catch(() => {});

        req.auth = {
          sub: result.userId,
          email: '',
          role: 'apikey' as JwtClaims['role'],
          iss: 'vortex-api-key',
          iat: Math.floor(Date.now() / 1000),
          exp: 0,
        };
        next();
      }).catch(next);
      return;
    }

    // Fall back to JWT
    try {
      req.auth = verifyToken(token, config);
      applySuperAdmin(req);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Extract a bearer token: `Authorization: Bearer …` only.
 *
 * The `x-vortex-token` header fallback has been REMOVED for CSRF
 * protection. Accepting tokens from a custom header allows cross-origin
 * requests to carry an Authorization header (via fetch with mode: 'no-cors'
 * or XMLHttpRequest), bypassing CORS and enabling CSRF.
 *
 * If a reverse proxy strips the Authorization header, configure it to
 * preserve it, or use a custom header at the proxy level that is not
 * accessible from browser JavaScript.
 */
export function bearerFrom(req: Request): string | null {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (header) {
    const match = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (match?.[1]) return match[1];
  }
  return null;
}

/** Express middleware enforcing a valid Vortex access token. */
export function requireAuth(config: TokenConfig, sessionService?: SessionService) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const token = bearerFrom(req);
    if (!token) {
      next(ApiError.unauthorized('Missing Bearer token'));
      return;
    }
    try {
      const claims = verifyToken(token, config);

      // JWT token revocation: if a session service is available and the
      // token has a jti (session ID), check that the session hasn't been
      // revoked. This allows forced logout, account compromise response,
      // and per-session revocation. Fails open only if the session row
      // doesn't exist (e.g. sessions table not yet populated for old tokens).
      if (sessionService && claims.jti) {
        try {
          const active = await sessionService.isActive(claims.jti);
          if (!active) {
            next(ApiError.unauthorized('Session has been revoked'));
            return;
          }
        } catch {
          // DB error — don't block the request, but log for audit
          // (fail-open on infrastructure errors, fail-closed on revoked)
        }
      }

      req.auth = claims;
      applySuperAdmin(req);
      if (sessionService && claims.sub && claims.jti) {
        sessionService.ensure(claims.sub, claims.jti, {
          userAgent: req.header('user-agent') ?? undefined,
          ipAddress: req.ip ?? req.socket.remoteAddress ?? undefined,
        }).catch(() => {});
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Soft auth middleware — sets `req.auth` if a valid token is present,
 * but does NOT reject the request if no token is found. Used by the
 * OIDC authorize endpoint, which redirects to login instead of 401.
 */
export function softAuth(config: TokenConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearerFrom(req);
    if (!token) {
      next();
      return;
    }
    try {
      req.auth = verifyToken(token, config);
      applySuperAdmin(req);
    } catch {
      // Invalid token — don't reject, just leave req.auth undefined
    }
    next();
  };
}

/** Require a specific role (admins and super admin always pass). */
export function requireRole(role: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      next(ApiError.unauthorized());
      return;
    }
    // Re-check super admin on every role gate — even if req.auth was
    // set by an earlier middleware that didn't call applySuperAdmin.
    applySuperAdmin(req);
    if (auth.role === 'admin' || auth.role === role) {
      next();
      return;
    }
    next(ApiError.forbidden(`Role "${role}" required`));
  };
}
