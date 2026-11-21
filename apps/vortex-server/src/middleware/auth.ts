/**
 * Vortex Server — Auth middleware: JWT verification and role-based access.
 */

import type { NextFunction, Request, Response } from 'express';
import { verifyToken } from '@vortex/core';
import type { JwtPayload, UserRole } from '@vortex/core';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

/** Verify a JWT bearer token and attach the payload to the request. */
export function requireAuth(jwtConfig: AppContext['env']['jwt']) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      next(ApiError.unauthorized());
      return;
    }
    const token = header.slice(7);
    try {
      req.auth = verifyToken(token, jwtConfig);
      next();
    } catch {
      next(ApiError.unauthorized('Invalid or expired token'));
    }
  };
}

/** Require a minimum role for access (admin > developer > viewer). */
const ROLE_RANK: Record<UserRole, number> = { viewer: 0, developer: 1, admin: 2 };

export function requireRole(minRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      next(ApiError.unauthorized());
      return;
    }
    if (ROLE_RANK[auth.role] < ROLE_RANK[minRole]) {
      next(ApiError.forbidden(`Requires ${minRole} role or higher`));
      return;
    }
    next();
  };
}
