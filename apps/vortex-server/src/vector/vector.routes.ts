import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import { createVectorService } from './vector.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const collectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  dimensions: z.number().int().min(1).max(4096),
});

const itemSchema = z.object({
  itemId: z.string().min(1).max(200),
  vector: z.array(z.number()).min(1),
  payload: z.record(z.unknown()).optional(),
});

const searchSchema = z.object({
  vector: z.array(z.number()).min(1),
  limit: z.number().int().min(1).max(100).optional(),
  filter: z.record(z.unknown()).optional(),
});

/** `/v1/vector` — vector search for AI applications. */
export function createVectorRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = createVectorService(ctx.db);

  // ── Collections ──────────────────────────────────────────────────────

  /** POST /v1/vector/collections — create a collection. */
  router.post('/collections', auth, validateBody(collectionSchema), async (req, res, next) => {
    try {
      const collection = await service.createCollection(req.auth!.sub, req.body);
      res.status(201).json({ collection });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/vector/collections — list collections. */
  router.get('/collections', auth, async (req, res, next) => {
    try {
      const collections = await service.listCollections(req.auth!.sub);
      res.json({ collections });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/vector/collections/:id — delete a collection. */
  router.delete('/collections/:id', auth, async (req, res, next) => {
    try {
      const deleted = await service.deleteCollection(req.auth!.sub, req.params.id!);
      if (!deleted) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Items ─────────────────────────────────────────────────────────────

  /** POST /v1/vector/collections/:id/items — insert a vector. */
  router.post('/collections/:id/items', auth, validateBody(itemSchema), async (req, res, next) => {
    try {
      const item = await service.insert(req.params.id!, req.body);
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/vector/collections/:id/items — upsert a vector. */
  router.patch('/collections/:id/items', auth, validateBody(itemSchema), async (req, res, next) => {
    try {
      const item = await service.upsert(req.params.id!, req.body);
      res.json({ item });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/vector/collections/:id/items/:itemId — delete a vector. */
  router.delete('/collections/:id/items/:itemId', auth, async (req, res, next) => {
    try {
      const deleted = await service.delete(req.params.id!, req.params.itemId!);
      if (!deleted) {
        return res.status(404).json({ error: 'Item not found' });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/vector/collections/:id/items — list vectors. */
  router.get('/collections/:id/items', auth, async (req, res, next) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const items = await service.list(req.params.id!, limit);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  });

  // ── Search ────────────────────────────────────────────────────────────

  /** POST /v1/vector/collections/:id/search — search vectors. */
  router.post('/collections/:id/search', auth, validateBody(searchSchema), async (req, res, next) => {
    try {
      const results = await service.search(req.params.id!, req.body.vector, {
        limit: req.body.limit,
        filter: req.body.filter,
      });
      res.json({ results });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
