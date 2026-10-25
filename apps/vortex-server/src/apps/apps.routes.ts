import { Router, raw } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from '../auth/tokens.js';
import { AppsService } from './apps.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';

let webhookService: WebhookService | null = null;

function getWebhookService(ctx: AppContext): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService(ctx.db, {
      publicAppUrl: ctx.env.publicAppUrl,
    });
  }
  return webhookService;
}

async function deliverWebhook(
  ctx: AppContext,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await getWebhookService(ctx).deliver(event, data);
  } catch {
    // Webhook delivery failures must never break the request
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(40),
  title: z.string().max(120).optional(),
});

/** Authenticated app-management API — `/v1/apps`. */
export function createAppsRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = new AppsService(ctx.db, ctx.storage);

  const actor = (req: { auth?: { sub: string; role: string } }) => ({
    userId: req.auth!.sub,
    isAdmin: req.auth!.role === 'admin',
  });

  /** POST /v1/apps — create an app. */
  router.post('/', auth, validateBody(createSchema), async (req, res, next) => {
    try {
      const app = await service.create(req.auth!.sub, req.body.name, req.body.title);
      void deliverWebhook(ctx, 'apps.deploy', {
        app: { name: app.name, title: app.title },
      });
      res.status(201).json({ app });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/apps — list my apps. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const apps = await service.list(req.auth!.sub, req.auth!.role === 'admin');
      res.json({ apps });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/apps/:name — app details + files. */
  router.get('/:name', auth, async (req, res, next) => {
    try {
      const { userId, isAdmin } = actor(req);
      const app = await service.requireOwned(req.params.name!, userId, isAdmin);
      const files = await service.listFiles(app.name);
      res.json({ app, files });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/apps/:name — delete an app and its files. */
  router.delete('/:name', auth, async (req, res, next) => {
    try {
      const { userId, isAdmin } = actor(req);
      await service.remove(req.params.name!, userId, isAdmin);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /v1/apps/:name/files?path=index.html — deploy one file (raw body).
   * A deployment is just repeated uploads; the last write per path wins.
   */
  router.post(
    '/:name/files',
    auth,
    raw({ type: () => true, limit: '64mb' }),
    async (req, res, next) => {
      try {
        const { userId, isAdmin } = actor(req);
        const path = String(req.query.path ?? '');
        if (!path) throw ApiError.badRequest('Missing "path" query parameter');
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const file = await service.putFile(
          req.params.name!,
          userId,
          isAdmin,
          path,
          body,
          req.header('content-type') ?? undefined,
        );
        res.status(201).json({ file });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /v1/apps/:name/files — list deployed files. */
  router.get('/:name/files', auth, async (req, res, next) => {
    try {
      const { userId, isAdmin } = actor(req);
      await service.requireOwned(req.params.name!, userId, isAdmin);
      const files = await service.listFiles(req.params.name!);
      res.json({ files });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/apps/:name/files?path=… — remove one file. */
  router.delete('/:name/files', auth, async (req, res, next) => {
    try {
      const { userId, isAdmin } = actor(req);
      const path = String(req.query.path ?? '');
      if (!path) throw ApiError.badRequest('Missing "path" query parameter');
      await service.removeFile(req.params.name!, userId, isAdmin, path);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
