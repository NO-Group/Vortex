/**
 * Vortex Core — Authentication utilities: JWT, password hashing.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { JwtClaims, AuthUser, RoleName } from './types.js';

export interface JwtConfig {
  secret: string;
  accessExpiry: string;
  refreshExpiry: string;
  issuer?: string;
}

const DEFAULT_ISSUER = 'vortex';

/** Hash a plaintext password using bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Verify a plaintext password against a bcrypt hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generate a JWT access token. */
export function signAccessToken(claims: Omit<JwtClaims, 'iat' | 'exp'>, config: JwtConfig): string {
  return jwt.sign(claims, config.secret, {
    expiresIn: config.accessExpiry as jwt.SignOptions['expiresIn'],
    issuer: config.issuer ?? DEFAULT_ISSUER,
  });
}

/** Generate a JWT refresh token. */
export function signRefreshToken(claims: Omit<JwtClaims, 'iat' | 'exp'>, config: JwtConfig): string {
  return jwt.sign(claims, config.secret, {
    expiresIn: config.refreshExpiry as jwt.SignOptions['expiresIn'],
    issuer: config.issuer ?? DEFAULT_ISSUER,
  });
}

/** Verify and decode a JWT token. */
export function verifyToken(token: string, config: JwtConfig): JwtClaims {
  const decoded = jwt.verify(token, config.secret) as JwtClaims;
  if (config.issuer && decoded.iss !== config.issuer && decoded.iss !== DEFAULT_ISSUER) {
    throw new Error('Invalid token issuer');
  }
  return decoded;
}

/** Generate a full set of auth tokens for a user. */
export function generateTokens(user: AuthUser, config: JwtConfig): { accessToken: string; refreshToken: string; expiresIn: number } {
  const issuer = config.issuer ?? DEFAULT_ISSUER;
  const base = { sub: user.id, email: user.email, role: user.role, meta: user.metadata, iss: issuer };
  return {
    accessToken: signAccessToken(base, config),
    refreshToken: signRefreshToken(base, config),
    expiresIn: 3600,
  };
}

/** Validate a role string, defaulting to 'user'. */
export function normalizeRole(role: string | undefined | null): RoleName {
  const r = (role ?? 'user').toLowerCase();
  if (r === 'admin' || r === 'user') return r;
  return 'user';
}
