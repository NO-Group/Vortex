import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createApiKeyService } from './apikey.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const createSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
});

/** `/v1/api-keys` — manage server-to-server API keys. */
export function createApiKeyRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = createApiKeyService(ctx.db);

  /** POST /v1/api-keys — create a new API key. */
  router.post('/', auth, validateBody(createSchema), async (req, res, next) => {
    try {
      const result = await service.create(
        req.auth!.sub,
        req.body.name,
        req.body.scopes,
      );
      res.status(201).json({ apiKey: result });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/api-keys — list active API keys. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const keys = await service.list(req.auth!.sub);
      res.json({ apiKeys: keys });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/api-keys/:id — revoke an API key. */
  router.delete('/:id', auth, async (req, res, next) => {
    try {
      const revoked = await service.revoke(req.auth!.sub, req.params.id!);
      if (!revoked) {
        return res.status(404).json({ error: 'API key not found' });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
