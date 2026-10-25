import { Router, raw } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from '../auth/tokens.js';
import { LocalStorageDriver } from './local.driver.js';
import { StorageRegistry } from './storage.service.js';
import { BucketService } from './buckets.service.js';
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

const presignUploadSchema = z.object({
  key: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(255).optional(),
  expiresIn: z.number().int().positive().max(3600).optional(),
});

const bucketSchema = z.object({
  name: z.string().min(2).max(32),
  public: z.boolean().optional(),
});

const presignDownloadSchema = z.object({
  key: z.string().min(1).max(1024),
  expiresIn: z.number().int().positive().max(3600).optional(),
});

const deleteSchema = z.object({
  key: z.string().min(1).max(1024),
});

export function createStorageRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const registry = new StorageRegistry(ctx.db);
  const bucketService = new BucketService(ctx.db);
  const driver = ctx.storage;

  /**
   * When PUBLIC_API_BASE=auto, presigned URLs are derived from the incoming
   * request's protocol + Host so they work behind any proxy or preview host.
   */
  const baseFor = (req: { protocol: string; get: (name: string) => string | undefined }): string | undefined => {
    if (ctx.env.storage.publicApiBase !== 'auto') return undefined;
    const host = req.get('x-forwarded-host') ?? req.get('host');
    if (!host) return undefined;
    const proto = req.get('x-forwarded-proto') ?? req.protocol;
    return `${proto}://${host}`;
  };

  /** POST /v1/storage/presign-upload — get a direct-upload URL. */
  router.post('/presign-upload', auth, validateBody(presignUploadSchema), async (req, res, next) => {
    try {
      await bucketService.assertKeyAllowed(req.body.key);
      const presigned = await driver.presignUpload(req.body, baseFor(req));
      res.json(presigned);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/storage/presign-download — get a direct-download URL. */
  router.post('/presign-download', auth, validateBody(presignDownloadSchema), async (req, res, next) => {
    try {
      const presigned = await driver.presignDownload(req.body.key, req.body.expiresIn ?? 900, baseFor(req));
      res.json(presigned);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/storage/upload — proxied upload (auth + owner registration). */
  router.post(
    '/upload',
    auth,
    raw({ type: '*/*', limit: '64mb' }),
    async (req, res, next) => {
      try {
        const key = String(req.query.key ?? '');
        if (!key) throw ApiError.badRequest('Missing "key" query parameter');
        await bucketService.assertKeyAllowed(key);
        const contentType = req.header('content-type') ?? 'application/octet-stream';
        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

        const result = await driver.put({ key, body, contentType });
        const meta = await registry.record({
          key: result.key,
          size: result.size,
          contentType,
          ownerId: req.auth!.sub,
        });
        void deliverWebhook(ctx, 'storage.upload', {
          key: meta.key,
          size: meta.size,
          contentType: meta.contentType,
          ownerId: meta.ownerId,
        });
        res.status(201).json({ object: meta });
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /v1/storage/object?key= — proxied download of an owned object. */
  router.get('/object', auth, async (req, res, next) => {
    try {
      const key = String(req.query.key ?? '');
      if (!key) throw ApiError.badRequest('Missing "key" query parameter');

      const meta = await registry.find(key);
      if (meta && meta.ownerId && meta.ownerId !== req.auth!.sub && req.auth!.role !== 'admin') {
        throw ApiError.forbidden('You do not own this object');
      }

      const object = await driver.get(key);
      res.setHeader('content-type', meta?.contentType ?? object.contentType);
      res.setHeader('content-length', String(object.size));
      res.send(object.body);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/storage/list — objects owned by the caller. */
  router.get('/list', auth, async (req, res, next) => {
    try {
      const registry = new StorageRegistry(ctx.db);
      const objects = await registry.listForOwner(req.auth!.sub);
      res.json({ objects });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/storage/stats — aggregate storage usage stats. */
  router.get('/stats', auth, async (req, res, next) => {
    try {
      const registry = new StorageRegistry(ctx.db);
      const objects = await registry.listForOwner(req.auth!.sub);
      const totalSize = objects.reduce((sum, o) => sum + o.size, 0);
      const byBucket = objects.reduce<Record<string, { count: number; size: number }>>(
        (acc, o) => {
          const bucket = o.key.split('/')[0] || 'unknown';
          if (!acc[bucket]) acc[bucket] = { count: 0, size: 0 };
          acc[bucket].count++;
          acc[bucket].size += o.size;
          return acc;
        },
        {},
      );
      res.json({
        totalObjects: objects.length,
        totalSize,
        byBucket,
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/storage/buckets — create a bucket namespace. */
  router.post('/buckets', auth, validateBody(bucketSchema), async (req, res, next) => {
    try {
      const bucket = await bucketService.create(
        req.body.name,
        req.body.public ?? false,
        req.auth!.sub,
      );
      res.status(201).json({ bucket });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/storage/buckets — list buckets. */
  router.get('/buckets', auth, async (_req, res, next) => {
    try {
      const buckets = await bucketService.list();
      res.json({ buckets });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/storage/buckets/:name — remove a bucket and its objects. */
  router.delete('/buckets/:name', auth, async (req, res, next) => {
    try {
      const removedKeys = await bucketService.remove(
        req.params.name!,
        req.auth!.sub,
        req.auth!.role === 'admin',
      );
      for (const key of removedKeys) {
        await driver.delete(key).catch(() => undefined);
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/storage/object — remove an owned object. */
  router.delete('/object', auth, validateBody(deleteSchema), async (req, res, next) => {
    try {
      const key = req.body.key as string;
      const meta = await registry.find(key);
      if (meta && meta.ownerId && meta.ownerId !== req.auth!.sub && req.auth!.role !== 'admin') {
        throw ApiError.forbidden('You do not own this object');
      }
      await driver.delete(key);
      await registry.remove(key);
      void deliverWebhook(ctx, 'storage.delete', {
        key,
        ownerId: meta?.ownerId ?? null,
      });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Local-driver presigned endpoints (HMAC token auth, no JWT) ────────────
  // Only mounted when the local driver is active; S3 presigns point at the
  // bucket directly and never touch the server.

  if (driver instanceof LocalStorageDriver) {
    /** PUT /v1/storage/local/upload?token= — presigned local upload. */
    router.put(
      '/local/upload',
      raw({ type: '*/*', limit: '64mb' }),
      async (req, res, next) => {
        try {
          const token = String(req.query.token ?? '');
          const payload = driver.verifySigned(token);
          if (payload.op !== 'put') throw ApiError.forbidden('Token is not an upload token');

          const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
          const result = await driver.put({
            key: payload.key,
            body,
            contentType: payload.contentType ?? req.header('content-type') ?? 'application/octet-stream',
          });
          await registry.record({
            key: result.key,
            size: result.size,
            contentType: result.contentType,
            ownerId: null,
          });
          res.status(201).json({ key: result.key, size: result.size });
        } catch (err) {
          next(err);
        }
      },
    );

    /** GET /v1/storage/local/object?token= — presigned local download. */
    router.get('/local/object', async (req, res, next) => {
      try {
        const token = String(req.query.token ?? '');
        const payload = driver.verifySigned(token);
        if (payload.op !== 'get') throw ApiError.forbidden('Token is not a download token');

        const object = await driver.get(payload.key);
        res.setHeader('content-type', object.contentType);
        res.setHeader('content-length', String(object.size));
        res.send(object.body);
      } catch (err) {
        next(err);
      }
    });
  }

  return router;
}
