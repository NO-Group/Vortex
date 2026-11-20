import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { MediaTransformService } from './media-transform.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import type { TokenConfig } from '../auth/tokens.js';

let webhookService: WebhookService | null = null;

function getWebhookService(ctx: AppContext): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService(ctx.db, {
      publicAppUrl: ctx.env.publicAppUrl,
    });
  }
  return webhookService;
}

const transformSchema = z.object({
  key: z.string().min(1).max(1024),
  operation: z.enum(['resize', 'crop', 'format', 'quality', 'rotate']),
  params: z.record(z.unknown()),
});

/**
 * `/v1/storage/transformations` — media transformation requests.
 *
 * POST /           — request a transformation
 * GET  /           — list transformations for the caller
 * GET  /:id        — get a single transformation
 * DELETE /:id      — delete a transformation record
 */
export function createTransformRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = new MediaTransformService(ctx.db, getWebhookService(ctx));

  /** POST /v1/storage/transformations — request a media transformation. */
  router.post('/', auth, validateBody(transformSchema), async (req, res, next) => {
    try {
      const row = await service.request(req.auth!.sub, req.body);
      res.status(202).json({
        id: row.id,
        key: row.key,
        operation: row.operation,
        params: row.params,
        outputKey: row.output_key,
        status: row.status,
        createdAt: row.created_at.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/storage/transformations — list transformations. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const rows = await service.list(req.auth!.sub, 20);
      res.json({
        transformations: rows.map((r) => ({
          id: r.id,
          key: r.key,
          operation: r.operation,
          params: r.params,
          outputKey: r.output_key,
          status: r.status,
          webhookStatus: r.webhook_status,
          completedAt: r.completed_at?.toISOString() ?? null,
          createdAt: r.created_at.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/storage/transformations/:id — get a single transformation. */
  router.get('/:id', auth, async (req, res, next) => {
    try {
      const row = await service.get(req.params.id!);
      if (!row || row.owner_id !== req.auth!.sub) {
        res.status(404).json({ error: { code: 'not_found', message: 'Transformation not found' } });
        return;
      }
      res.json({
        id: row.id,
        key: row.key,
        operation: row.operation,
        params: row.params,
        outputKey: row.output_key,
        status: row.status,
        webhookStatus: row.webhook_status,
        errorMessage: row.error_message,
        completedAt: row.completed_at?.toISOString() ?? null,
        createdAt: row.created_at.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/storage/transformations/:id — delete a transformation. */
  router.delete('/:id', auth, async (req, res, next) => {
    try {
      await service.delete(req.params.id!, req.auth!.sub);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
