import type { NextFunction, Request, Response } from 'express';
import type { JwtClaims } from '@vortex/core';
import { ApiError } from '../errors.js';
import { verifyToken, type TokenConfig } from '../auth/tokens.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Verified JWT claims, present after `requireAuth`. */
      auth?: JwtClaims;
    }
  }
}

/** Extract a Bearer token from the Authorization header. */
export function bearerFrom(req: Request): string | null {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/** Express middleware enforcing a valid Vortex access token. */
export function requireAuth(config: TokenConfig) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearerFrom(req);
    if (!token) {
      next(ApiError.unauthorized('Missing Bearer token'));
      return;
    }
    try {
      req.auth = verifyToken(token, config);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Require a specific role (admins always pass). */
export function requireRole(role: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      next(ApiError.unauthorized());
      return;
    }
    if (auth.role === 'admin' || auth.role === role) {
      next();
      return;
    }
    next(ApiError.forbidden(`Role "${role}" required`));
  };
}
