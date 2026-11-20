import { Router } from 'express';
import { z } from 'zod';
import type { SqlResult } from '@vortex/core';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from '../auth/tokens.js';

const sqlSchema = z.object({
  sql: z.string().min(1).max(20_000),
  params: z.array(z.unknown()).max(100).optional(),
});

const STATEMENT_TIMEOUT_MS = 10_000;

/**
 * Reject multi-statement scripts (defense-in-depth on top of the
 * parameterized protocol): trailing semicolons are fine, inner ones not.
 */
export function assertSingleStatement(sql: string): string {
  const trimmed = sql.trim().replace(/;+\s*$/, '').trimEnd();
  // Cheap check: a ';' outside of a string literal → multiple statements.
  let inSingle = false;
  let inDouble = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]!;
    const next = trimmed[i + 1];
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (!inSingle && !inDouble && ch === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }
    if (!inSingle && !inDouble && ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      continue;
    }
    if (ch === ';' && !inSingle && !inDouble) {
      throw ApiError.badRequest('Only a single SQL statement is allowed per call');
    }
  }
  return trimmed;
}

/**
 * Accept both `?` (positional) and `$1..$n` (pg-style) placeholders.
 * `$n` occurrences are rewritten to `?` in appearance order with matching
 * bindings so `$2, $1` ordering works too.
 */
export function prepareBindings(
  sql: string,
  params: unknown[],
): { prepared: string; bindings: unknown[] } {
  if (!/\$\d+/.test(sql)) return { prepared: sql, bindings: params };

  const ordered: unknown[] = [];
  const prepared = sql.replace(/\$(\d+)/g, (_m, n: string) => {
    const value = params[Number(n) - 1];
    if (value === undefined) {
      throw ApiError.badRequest(`Missing binding for placeholder $${n}`);
    }
    ordered.push(value);
    return '?';
  });
  return { prepared, bindings: ordered };
}

/** SQL console API — `POST /v1/sql` (admins only). */
export function createSqlRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  router.post('/', auth, validateBody(sqlSchema), async (req, res, next) => {
    try {
      if (req.auth!.role !== 'admin') {
        throw ApiError.forbidden('The SQL console is admin-only');
      }

      const sql = assertSingleStatement(req.body.sql as string);
      const params = (req.body.params ?? []) as unknown[];
      const { prepared, bindings } = prepareBindings(sql, params);
      const started = Date.now();

      const result = await ctx.db.transaction(async (trx) => {
        await trx.raw(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);
        return trx.raw(prepared, bindings as (string | number | boolean | null)[]);
      });

      const raw = result as unknown as {
        rows?: Record<string, unknown>[];
        fields?: Array<{ name: string }>;
        rowCount?: number;
      };
      const rows = raw.rows ?? [];
      const columns =
        raw.fields?.map((f) => f.name) ?? (rows[0] ? Object.keys(rows[0]) : []);
      const payload: SqlResult = {
        columns,
        rows,
        rowCount: raw.rowCount ?? rows.length,
        durationMs: Date.now() - started,
      };
      res.json(payload);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
