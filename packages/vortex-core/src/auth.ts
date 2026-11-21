/**
 * Vortex Core — Authentication utilities: JWT, password hashing.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { AuthTokens, JwtPayload, User, UserRole } from './types.js';

export interface JwtConfig {
  secret: string;
  accessExpiry: string;
  refreshExpiry: string;
}

/** Hash a plaintext password using bcrypt. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/** Verify a plaintext password against a bcrypt hash. */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generate a JWT access token. */
export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, config: JwtConfig): string {
  return jwt.sign(payload, config.secret, {
    expiresIn: config.accessExpiry as jwt.SignOptions['expiresIn'],
  });
}

/** Generate a JWT refresh token. */
export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, config: JwtConfig): string {
  return jwt.sign(payload, config.secret, {
    expiresIn: config.refreshExpiry as jwt.SignOptions['expiresIn'],
  });
}

/** Verify and decode a JWT token. */
export function verifyToken(token: string, config: JwtConfig): JwtPayload {
  return jwt.verify(token, config.secret) as JwtPayload;
}

/** Generate a full set of auth tokens for a user. */
export function generateTokens(user: User, config: JwtConfig): AuthTokens {
  const base = { sub: user.id, email: user.email, role: user.role, name: user.name };
  return {
    accessToken: signAccessToken(base, config),
    refreshToken: signRefreshToken(base, config),
    expiresIn: 3600,
  };
}

/** Validate a role string, defaulting to 'developer'. */
export function normalizeRole(role: string | undefined | null): UserRole {
  const r = (role ?? 'developer').toLowerCase();
  if (r === 'admin' || r === 'developer' || r === 'viewer') return r;
  return 'developer';
}
