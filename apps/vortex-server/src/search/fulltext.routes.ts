import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from '../auth/tokens.js';
import { FulltextService } from './fulltext.service.js';

const createIndexSchema = z.object({
  name: z.string().min(2).max(40),
  tableName: z.string().min(1).max(64),
  columns: z.array(z.string().min(1).max(64)).min(1).max(5),
  language: z.string().min(1).max(20).optional(),
});

const searchSchema = z.object({
  tableName: z.string().min(1).max(64),
  query: z.string().min(1).max(1000),
  columns: z.array(z.string().min(1).max(64)).min(1).max(5).optional(),
  language: z.string().min(1).max(20).optional(),
  limit: z.number().int().positive().max(100).optional(),
  mode: z.enum(['match', 'plain']).optional(),
});

/** Management API — `/v1/search/fulltext`. */
export function createFulltextRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = new FulltextService(ctx.db);

  /** POST /v1/search/fulltext/index — create a full-text GIN index. */
  router.post('/index', auth, validateBody(createIndexSchema), async (req, res, next) => {
    try {
      const index = await service.createIndex(req.auth!.sub, req.body);
      res.status(201).json({ index });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/search/fulltext/index — list all full-text indexes. */
  router.get('/index', auth, async (req, res, next) => {
    try {
      const indexes = await service.listIndexes(req.auth!.sub);
      res.json({ indexes });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/search/fulltext/index/:name — drop a full-text index. */
  router.delete('/index/:name', auth, async (req, res, next) => {
    try {
      await service.dropIndex(req.auth!.sub, req.params.name!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/search/fulltext — search a table using full-text query. */
  router.post('/', auth, validateBody(searchSchema), async (req, res, next) => {
    try {
      const results = await service.search(req.auth!.sub, req.body);
      res.json({ results, count: results.length });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
