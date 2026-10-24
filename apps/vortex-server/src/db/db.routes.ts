import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { RbacService } from './rbac.js';
import { QueryService } from './query.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const filterSchema = z.object({
  column: z.string().min(1),
  op: z
    .enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is', 'contains'])
    .optional(),
  value: z.unknown(),
});

const orderSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']).optional(),
});

const includeSchema = z.object({
  table: z.string().min(1),
  localKey: z.string().min(1),
  foreignKey: z.string().min(1),
  as: z.string().min(1),
  select: z.array(z.string().min(1)).optional(),
});

const querySchema = z.object({
  select: z.array(z.string().min(1)).optional(),
  filters: z.array(filterSchema).optional(),
  or: z.array(z.array(filterSchema)).optional(),
  orderBy: z.array(orderSchema).optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().min(0).optional(),
  include: z.array(includeSchema).max(8).optional(),
  countTotal: z.boolean().optional(),
  /** Return the planner's cost + plan summary alongside the rows. */
  explain: z.boolean().optional(),
});

const insertSchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1).max(200),
});

const updateSchema = z.object({
  patch: z.record(z.unknown()),
  filters: z.array(filterSchema).min(1),
});

const deleteSchema = z.object({
  filters: z.array(filterSchema).min(1),
});

export function createDbRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  // v0.7: queries run through compiled row policies and, when a cost ceiling
  // is configured, are EXPLAINed before they're allowed to execute.
  const service = new QueryService(ctx.db, new RbacService(ctx.db), ctx.bus, {
    policies: ctx.policies,
    governor: ctx.governor,
  });

  const actorOf = (req: {
    auth?: { sub: string; role: string; email?: string; meta?: Record<string, unknown> };
  }) => ({
    userId: req.auth!.sub,
    role: req.auth!.role,
    email: req.auth!.email ?? null,
    meta: req.auth!.meta ?? {},
  });

  /** POST /v1/db/:table/query — run a dynamic SELECT. */
  router.post('/:table/query', auth, validateBody(querySchema), async (req, res, next) => {
    try {
      const result = await service.select(actorOf(req), req.params.table!, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/db/:table — insert rows. */
  router.post('/:table', auth, validateBody(insertSchema), async (req, res, next) => {
    try {
      const result = await service.insert(actorOf(req), req.params.table!, req.body.rows);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/db/:table — update rows matching filters. */
  router.patch('/:table', auth, validateBody(updateSchema), async (req, res, next) => {
    try {
      const result = await service.update(
        actorOf(req),
        req.params.table!,
        req.body.patch,
        req.body.filters,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/db/:table — delete rows matching filters. */
  router.delete('/:table', auth, validateBody(deleteSchema), async (req, res, next) => {
    try {
      const result = await service.delete(actorOf(req), req.params.table!, req.body.filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/db/tables — list non-system table names (for policy UIs). */
  router.get('/tables', auth, async (_req, res, next) => {
    try {
      const rows = await ctx.db<{ table_name: string }>('information_schema.tables')
        .select('table_name')
        .whereRaw("table_schema = 'public' AND table_type = 'BASE TABLE'")
        .whereNotIn('table_name', [
          'users',
          'table_permissions',
          'storage_objects',
          'apps',
          'app_files',
          'auth_tokens',
          'buckets',
          'functions',
          'vortex_policies',
          'vortex_query_log',
        ])
        .orderBy('table_name');

      res.json({ tables: rows.map((r) => r.table_name) });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
