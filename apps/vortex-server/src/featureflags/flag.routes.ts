import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import { createFeatureFlagService } from './flag.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const createSchema = z.object({
  key: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  status: z.enum(['off', 'on', 'gradual']).optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  targeting: z.record(z.unknown()).optional(),
  variants: z.array(z.record(z.unknown())).optional(),
});

const updateSchema = z.object({
  description: z.string().max(500).optional(),
  status: z.enum(['off', 'on', 'gradual']).optional(),
  rolloutPercentage: z.number().min(0).max(100).optional(),
  targeting: z.record(z.unknown()).optional(),
  variants: z.array(z.record(z.unknown())).optional(),
});

const evaluateSchema = z.object({
  key: z.string().min(1).max(100),
});

/** `/v1/flags` — feature flags and remote config. */
export function createFlagRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = createFeatureFlagService(ctx.db);

  /** POST /v1/flags — create a flag. */
  router.post('/', auth, validateBody(createSchema), async (req, res, next) => {
    try {
      const flag = await service.create(req.auth!.sub, req.body);
      res.status(201).json({ flag });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/flags — list all flags for the authenticated user. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const flags = await service.list(req.auth!.sub);
      res.json({ flags });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/flags/:id — update a flag. */
  router.patch('/:id', auth, validateBody(updateSchema), async (req, res, next) => {
    try {
      const flag = await service.update(req.auth!.sub, req.params.id!, req.body);
      if (!flag) {
        return res.status(404).json({ error: 'Flag not found' });
      }
      res.json({ flag });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/flags/:id — delete a flag. */
  router.delete('/:id', auth, async (req, res, next) => {
    try {
      const deleted = await service.delete(req.auth!.sub, req.params.id!);
      if (!deleted) {
        return res.status(404).json({ error: 'Flag not found' });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/flags/evaluate?key= — evaluate a single flag. */
  router.get('/evaluate', auth, async (req, res, next) => {
    try {
      const key = String(req.query.key ?? '');
      if (!key) throw ApiError.badRequest('Missing "key" query parameter');
      const result = await service.evaluate(
        key,
        req.auth!.sub,
        req.auth!.role,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/flags/evaluate-all — evaluate all flags for the current user. */
  router.get('/evaluate-all', auth, async (req, res, next) => {
    try {
      const results = await service.evaluateAll(req.auth!.sub, req.auth!.role);
      res.json({ flags: results });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
