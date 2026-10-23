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
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in', 'is']).optional(),
  value: z.unknown(),
});

const orderSchema = z.object({
  column: z.string().min(1),
  direction: z.enum(['asc', 'desc']).optional(),
});

const querySchema = z.object({
  select: z.array(z.string().min(1)).optional(),
  filters: z.array(filterSchema).optional(),
  orderBy: z.array(orderSchema).optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().min(0).optional(),
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
  const service = new QueryService(ctx.db, new RbacService(ctx.db), ctx.bus);

  const actorOf = (req: { auth?: { sub: string; role: string } }) => ({
    userId: req.auth!.sub,
    role: req.auth!.role,
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

  return router;
}
