import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import { createCustomDomainService } from './domain.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const addDomainSchema = z.object({
  domain: z.string().min(1).max(255).regex(/^[a-z0-9.-]+$/i, 'Invalid domain format'),
});

/** `/v1/apps/:name/domains` — custom domain management for apps. */
export function createCustomDomainRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = createCustomDomainService(ctx.db);

  /** POST /v1/apps/:name/domains — add a custom domain. */
  router.post('/domains', auth, validateBody(addDomainSchema), async (req, res, next) => {
    try {
      const result = await service.addDomain(
        req.auth!.sub,
        req.params.name!,
        req.body.domain,
      );
      res.status(201).json({ domain: result });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/apps/:name/domains — list custom domains. */
  router.get('/domains', auth, async (req, res, next) => {
    try {
      const domains = await service.listDomains(req.auth!.sub, req.params.name!);
      res.json({ domains });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/apps/:name/domains/:id — remove a custom domain. */
  router.delete('/domains/:id', auth, async (req, res, next) => {
    try {
      const removed = await service.removeDomain(req.auth!.sub, req.params.id!);
      if (!removed) {
        return res.status(404).json({ error: 'Domain not found' });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/apps/:name/domains/:id/verify — verify DNS and activate. */
  router.post('/domains/:id/verify', auth, async (req, res, next) => {
    try {
      const domain = await service.verifyDomain(req.auth!.sub, req.params.id!);
      res.json({ domain });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
