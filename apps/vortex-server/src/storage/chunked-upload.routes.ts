import { Router, raw } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import { ChunkedUploadService } from './chunked-upload.service.js';
import { StorageRegistry } from './storage.service.js';
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

const initSchema = z.object({
  key: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(255).optional(),
  totalChunks: z.number().int().positive().max(1000),
});

const chunkSchema = z.object({
  uploadId: z.string().min(1).max(128),
  chunkIndex: z.number().int().min(0).max(999),
  totalChunks: z.number().int().positive().max(1000),
});

const completeSchema = z.object({
  uploadId: z.string().min(1).max(128),
});

const abortSchema = z.object({
  uploadId: z.string().min(1).max(128),
});

/**
 * `/v1/storage/chunked` — chunked / multipart upload API.
 *
 * POST /init     — initialize an upload session
 * PUT  /chunk    — upload a single chunk (raw body)
 * POST /complete — assemble chunks into the final object
 * GET  /status   — check upload progress
 * POST /abort    — cancel an upload session
 */
export function createChunkedUploadRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = new ChunkedUploadService(ctx.db, ctx.storage);
  const registry = new StorageRegistry(ctx.db);

  /** POST /v1/storage/chunked/init — initialize a chunked upload. */
  router.post('/init', auth, validateBody(initSchema), async (req, res, next) => {
    try {
      const session = await service.init(req.auth!.sub, req.body);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  });

  /** PUT /v1/storage/chunked/chunk — upload a single chunk. */
  router.put(
    '/chunk',
    auth,
    raw({ type: '*/*', limit: '64mb' }),
    async (req, res, next) => {
      try {
        const uploadId = String(req.query.uploadId ?? req.body?.uploadId ?? '');
        const chunkIndex = parseInt(String(req.query.chunkIndex ?? req.body?.chunkIndex ?? '-1'), 10);
        const totalChunks = parseInt(String(req.query.totalChunks ?? req.body?.totalChunks ?? '0'), 10);

        if (!uploadId) throw ApiError.badRequest('Missing uploadId');
        if (Number.isNaN(chunkIndex) || chunkIndex < 0) {
          throw ApiError.badRequest('Invalid chunkIndex');
        }
        if (Number.isNaN(totalChunks) || totalChunks < 1) {
          throw ApiError.badRequest('Invalid totalChunks');
        }

        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (body.length === 0) {
          throw ApiError.badRequest('Empty chunk body');
        }

        const result = await service.uploadChunk(req.auth!.sub, {
          uploadId,
          chunkIndex,
          totalChunks,
          body,
          contentType: req.header('content-type') ?? undefined,
        });
        res.status(200).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /v1/storage/chunked/complete — assemble and finalize the upload. */
  router.post('/complete', auth, validateBody(completeSchema), async (req, res, next) => {
    try {
      const result = await service.complete(req.auth!.sub, { uploadId: req.body.uploadId });

      // Register the object in the storage registry
      await registry.record({
        key: result.key,
        size: result.size,
        contentType: result.contentType,
        ownerId: req.auth!.sub,
      });

      // Dispatch webhook
      try {
        await getWebhookService(ctx).deliver('storage.upload', {
          key: result.key,
          size: result.size,
          contentType: result.contentType,
          ownerId: req.auth!.sub,
          chunked: true,
        });
      } catch {
        // Webhook failures must never break the request
      }

      res.status(201).json({ object: { key: result.key, size: result.size, contentType: result.contentType } });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/storage/chunked/status — check upload progress. */
  router.get('/status', auth, async (req, res, next) => {
    try {
      const uploadId = String(req.query.uploadId ?? '');
      if (!uploadId) throw ApiError.badRequest('Missing uploadId');
      const row = await service.status(req.auth!.sub, uploadId);
      if (!row) throw ApiError.notFound('Upload session not found');
      res.json({
        uploadId: row.upload_id,
        key: row.key,
        totalChunks: row.total_chunks,
        chunksReceived: row.chunks_received,
        status: row.status,
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/storage/chunked/abort — cancel an upload session. */
  router.post('/abort', auth, validateBody(abortSchema), async (req, res, next) => {
    try {
      await service.abort(req.auth!.sub, req.body.uploadId);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
