import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { WebhookService } from './webhook.service.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from '../auth/tokens.js';

const webhookCreateSchema = z.object({
  url: z.string().url().max(512),
  events: z.array(z.string().min(1)).min(1).max(50),
});

const webhookUpdateSchema = z.object({
  url: z.string().url().max(512).optional(),
  events: z.array(z.string().min(1)).min(1).max(50).optional(),
  active: z.boolean().optional(),
});

export function createWebhookRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new WebhookService(ctx.db, {
    publicAppUrl: ctx.env.publicAppUrl,
  });
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  /** POST /v1/webhooks — register a new webhook endpoint. */
  router.post(
    '/',
    auth,
    validateBody(webhookCreateSchema),
    async (req, res, next) => {
      try {
        const webhook = await service.createWebhook(req.auth!.sub, req.body);
        res.status(201).json({ webhook });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /v1/webhooks — list your webhooks. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const webhooks = await service.listWebhooks(req.auth!.sub);
      res.json({ webhooks });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/webhooks/:id — update a webhook. */
  router.patch(
    '/:id',
    auth,
    validateBody(webhookUpdateSchema),
    async (req, res, next) => {
      try {
        const webhook = await service.updateWebhook(req.params.id!, req.body);
        res.json({ webhook });
      } catch (err) {
        next(err);
      }
    },
  );

  /** DELETE /v1/webhooks/:id — delete a webhook. */
  router.delete('/:id', auth, async (req, res, next) => {
    try {
      await service.deleteWebhook(req.params.id!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/webhooks/:id/secret — regenerate the signing secret. */
  router.post('/:id/secret', auth, async (req, res, next) => {
    try {
      const result = await service.regenerateSecret(req.params.id!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/webhooks/:id/log — view delivery history. */
  router.get('/:id/log', auth, async (req, res, next) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const log = await service.listLog(req.params.id!, limit);
      res.json({ log });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/webhooks/:id/secret — get the signing secret. */
  router.get('/:id/secret', auth, async (req, res, next) => {
    try {
      const result = await service.getSigningSecret(req.params.id!);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/webhooks/verify — verify an incoming webhook signature. */
  router.post('/verify', async (req, res) => {
    const { secret, payload, headers } = req.body as {
      secret: string;
      payload: string;
      headers: Record<string, string>;
    };
    if (!secret || !payload || !headers) {
      throw ApiError.badRequest('Missing "secret", "payload", or "headers" in body');
    }
    const valid = service.verifySignature(secret, payload, headers);
    res.json({ valid });
  });

  return router;
}
