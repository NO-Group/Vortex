import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import type { JwtClaims, RoleName } from '@vortex/core';
import { ApiError } from '../errors.js';

export interface TokenConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
}

export interface SignTokenInput {
  userId: string;
  email: string;
  role: RoleName;
  /** Custom claims (from user metadata) — attached under `meta`. */
  meta?: Record<string, unknown>;
}

/** Sign a Vortex access token for a user. */
export function signToken(input: SignTokenInput, config: TokenConfig): string {
  return jwt.sign(
    {
      email: input.email,
      role: input.role,
      jti: randomUUID(),
      ...(input.meta && Object.keys(input.meta).length ? { meta: input.meta } : {}),
    },
    config.secret,
    {
      subject: input.userId,
      issuer: config.issuer,
      expiresIn: config.expiresIn,
    } as jwt.SignOptions,
  );
}

/** Verify a Vortex access token and return its claims. */
export function verifyToken(token: string, config: TokenConfig): JwtClaims {
  try {
    const decoded = jwt.verify(token, config.secret, { issuer: config.issuer });
    if (typeof decoded === 'string') {
      throw ApiError.unauthorized('Malformed token payload');
    }
    const claims = decoded as jwt.JwtPayload;
    if (!claims.sub) {
      throw ApiError.unauthorized('Token missing subject');
    }
    return {
      sub: claims.sub,
      email: String(claims.email ?? ''),
      role: (claims.role ?? 'user') as RoleName,
      meta: (claims.meta ?? undefined) as Record<string, unknown> | undefined,
      iss: String(claims.iss ?? config.issuer),
      iat: Number(claims.iat ?? 0),
      exp: Number(claims.exp ?? 0),
      jti: claims.jti ? String(claims.jti) : undefined,
    };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw ApiError.unauthorized('Invalid or expired token');
  }
}
