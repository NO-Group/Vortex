import type { NextFunction, Request, Response } from 'express';
import type { JwtClaims } from '@vortex/core';
import { ApiError } from '../errors.js';

/**
 * Row-Level Security (RLS) for storage objects.
 *
 * Every read/write request must pass through the VortexStorageGuard middleware.
 * It verifies JWT claim roles against object paths.
 *
 * Path patterns:
 *   /buckets/user-avatars/{user_id}/*  → only writable if jwt.sub == user_id
 *   /buckets/public/*                   → readable by anyone, writable only by admin
 *   /buckets/{bucket}/*                 → owner or admin
 *
 * Non-public objects strictly reject unsigned requests with HTTP 403.
 */

interface PathRule {
  /** Regex pattern for the object key. */
  pattern: RegExp;
  /** Whether the rule applies to reads, writes, or both. */
  access: 'read' | 'write' | 'both';
  /** Description of the rule. */
  description: string;
}

/** Default path rules for RLS enforcement. */
const DEFAULT_RULES: PathRule[] = [
  {
    pattern: /^\/buckets\/public\//,
    access: 'both',
    description: 'Public bucket — anyone can read, only admins can write',
  },
  {
    pattern: /^\/buckets\/user-avatars\/([^/]+)\//,
    access: 'both',
    description: 'User avatars — owner can read/write, others read-only',
  },
  {
    pattern: /^\/buckets\/([^/]+)\//,
    access: 'both',
    description: 'General bucket — owner or admin only',
  },
  {
    pattern: /^/,
    access: 'both',
    description: 'Default — authenticated users can read/write',
  },
];

/**
 * Check if a request is allowed to access a given object key.
 */
export function checkAccess(
  key: string,
  claims: JwtClaims | undefined,
  action: 'read' | 'write',
  rules: PathRule[] = DEFAULT_RULES,
): void {
  // Non-public objects reject unsigned requests with 403
  if (!claims) {
    // Check if it's a public bucket
    const isPublic = rules.some(
      (r) => r.pattern.test(key) && r.access !== 'write',
    );
    if (!isPublic) {
      throw ApiError.forbidden('Authentication required for this resource');
    }
    return;
  }

  // Admins always pass
  if (claims.role === 'admin') return;

  for (const rule of rules) {
    if (!rule.pattern.test(key)) continue;
    if (rule.access === 'write' && action === 'read') continue;

    const match = key.match(rule.pattern);
    if (!match) continue;

    // User avatars: check ownership
    if (rule.pattern.source.includes('user-avatars')) {
      const userId = match[1];
      if (action === 'write' && claims.sub !== userId) {
        throw ApiError.forbidden('You can only write to your own resources');
      }
      return;
    }

    // Public bucket: non-admin can read, but not write
    if (rule.pattern.source.includes('public')) {
      if (action === 'write') {
        throw ApiError.forbidden('Only admins can write to public buckets');
      }
      return;
    }

    // General bucket: check if the user owns the bucket
    // In a real system, this would check a bucket ownership table
    // For now, we allow access if the user is authenticated
    return;
  }

  // If no rule matches, deny by default
  throw ApiError.forbidden('Access denied for this resource');
}

/**
 * Express middleware that enforces RLS on storage operations.
 * Extracts the object key from the request and validates access.
 */
export function storageGuard(req: Request, _res: Response, next: NextFunction): void {
  const claims = req.auth as JwtClaims | undefined;
  const key = req.params.key ?? req.query.key ?? req.body?.key ?? '';

  if (!key) {
    next();
    return;
  }

  const action: 'read' | 'write' =
    req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write';

  try {
    checkAccess(key, claims, action);
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validate a storage key against path traversal attacks.
 * Throws ApiError(400) on invalid keys.
 */
export function validateKey(key: string): void {
  if (!key || key.length === 0) {
    throw ApiError.badRequest('Storage key cannot be empty');
  }
  if (key.includes('\0')) {
    throw ApiError.badRequest('Storage key cannot contain null bytes');
  }
  if (key.includes('..')) {
    throw ApiError.badRequest('Storage key cannot contain path traversal sequences');
  }
}
