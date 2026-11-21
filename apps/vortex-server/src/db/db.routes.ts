/**
 * Vortex Server — Database API routes: /v1/db/*
 */

import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { QueryService } from './query.service.js';
import { RbacService } from './rbac.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

const filterSchema = z.object({
  column: z.string().min(1).max(64),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'in']),
  value: z.any(),
});

const selectSchema = z.object({
  table: z.string().min(1).max(64),
  filters: z.array(filterSchema).optional(),
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  orderBy: z.object({
    column: z.string().min(1).max(64),
    direction: z.enum(['asc', 'desc']),
  }).optional(),
});

const insertSchema = z.object({
  table: z.string().min(1).max(64),
  rows: z.array(z.record(z.any())).min(1).max(100),
});

const updateSchema = z.object({
  table: z.string().min(1).max(64),
  filters: z.array(filterSchema).min(1),
  patch: z.record(z.any()),
});

const deleteSchema = z.object({
  table: z.string().min(1).max(64),
  filters: z.array(filterSchema).min(1),
});

export function createDbRoutes(ctx: AppContext): Router {
  const router = Router();
  const queryService = new QueryService(ctx.db, new RbacService(ctx.db));
  const auth = requireAuth(ctx.env.jwt);

  /** GET /v1/db/select — query rows from a table. */
  router.get('/select', auth, validateQuery(selectSchema), async (req, res, next) => {
    try {
      const actor = { userId: req.auth!.sub, role: req.auth!.role };
      const result = await queryService.select(actor, req.query.table as string, {
        filters: req.query.filters as never[],
        limit: req.query.limit as number | undefined,
        offset: req.query.offset as number | undefined,
        orderBy: req.query.orderBy as never,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/db/insert — insert rows into a table. */
  router.post('/insert', auth, validateBody(insertSchema), async (req, res, next) => {
    try {
      const actor = { userId: req.auth!.sub, role: req.auth!.role };
      const result = await queryService.insert(actor, req.body.table, req.body.rows);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/db/update — update rows in a table. */
  router.post('/update', auth, validateBody(updateSchema), async (req, res, next) => {
    try {
      const actor = { userId: req.auth!.sub, role: req.auth!.role };
      const result = await queryService.update(actor, req.body.table, req.body.filters, req.body.patch);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/db/delete — delete rows from a table. */
  router.post('/delete', auth, validateBody(deleteSchema), async (req, res, next) => {
    try {
      const actor = { userId: req.auth!.sub, role: req.auth!.role };
      const result = await queryService.delete(actor, req.body.table, req.body.filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
