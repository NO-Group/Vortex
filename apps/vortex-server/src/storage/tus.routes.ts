import { Router, raw } from 'express';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import type { TokenConfig } from '../auth/tokens.js';
import { StorageRegistry } from './storage.service.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import { TusService } from './tus.service.js';
import {
  TUS_VERSION,
  TUS_MAX_VERSION,
  TUS_EXTENSIONS,
  parseUploadMetadata,
  parseUploadChecksum,
} from './tus.types.js';

let webhookService: WebhookService | null = null;

function getWebhookService(ctx: AppContext): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService(ctx.db, {
      publicAppUrl: ctx.env.publicAppUrl,
    });
  }
  return webhookService;
}

/**
 * TUS Protocol Adapter routes.
 *
 * Mounted at `/v1/storage/tus`.
 *
 * POST   /v1/storage/tus/uploads              — create upload (Upload-Length header)
 * HEAD   /v1/storage/tus/uploads/:uploadId     — get offset/status
 * PATCH  /v1/storage/tus/uploads/:uploadId     — upload data (Upload-Offset header)
 * DELETE /v1/storage/tus/uploads/:uploadId     — terminate upload
 * POST   /v1/storage/tus/uploads/:uploadId/complete — finalize and register object
 * GET    /v1/storage/tus                      — protocol discovery (Tus-Version, Tus-Extension)
 */
export function createTusRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = new TusService(ctx.db, ctx.storage);
  const registry = new StorageRegistry(ctx.db);

  // ── Protocol Discovery ────────────────────────────────────────────────

  /** GET /v1/storage/tus — protocol capabilities. */
  router.get('/', auth, (_req, res) => {
    res.set('Tus-Version', `${TUS_VERSION},${TUS_MAX_VERSION}`);
    res.set('Tus-Extension', TUS_EXTENSIONS.join(','));
    res.set('Tus-Max-Size', '1073741824'); // 1 GB
    res.status(204).end();
  });

  // ── Create Upload ────────────────────────────────────────────────────

  /** POST /v1/storage/tus/uploads — create a new resumable upload. */
  router.post('/uploads', auth, async (req, res, next) => {
    try {
      // Parse TUS headers
      const uploadLength = req.header('upload-length');
      const uploadMetadata = req.header('upload-metadata');
      const contentType = req.header('content-type') ?? undefined;
      const checksumHeader = req.header('upload-checksum');

      if (!uploadLength) {
        throw ApiError.badRequest('Missing Upload-Length header');
      }

      const size = parseInt(uploadLength, 10);
      if (Number.isNaN(size) || size < 0) {
        throw ApiError.badRequest('Invalid Upload-Length');
      }
      if (size > 1024 * 1024 * 1024) { // 1 GB max
        throw ApiError.badRequest('Upload exceeds maximum size (1 GB)');
      }

      const metadata = parseUploadMetadata(uploadMetadata);
      const checksum = parseUploadChecksum(checksumHeader);

      const creation = await service.createUpload(req.auth!.sub, {
        size,
        contentType,
        metadata,
        checksum: checksum ? `${checksum.algorithm} ${checksum.value}` : undefined,
        appId: req.tenant?.id ?? null,
      });

      // Set TUS response headers
      res.set('Tus-Resumable', TUS_VERSION);
      res.set('Location', creation.location);
      res.set('Upload-Length', String(creation.size));
      res.set('Upload-Offset', '0');
      res.status(201).json({
        uploadId: creation.uploadId,
        key: creation.key,
        size: creation.size,
        offset: creation.offset,
        location: creation.location,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── HEAD: Get Offset ──────────────────────────────────────────────────

  /** HEAD /v1/storage/tus/uploads/:uploadId — get current offset. */
  router.head('/uploads/:uploadId', auth, async (req, res, next) => {
    try {
      const upload = await service.head(req.auth!.sub, req.params.uploadId!);

      res.set('Tus-Resumable', TUS_VERSION);
      res.set('Upload-Length', String(upload.size));
      res.set('Upload-Offset', String(upload.offset));
      res.set('Cache-Control', 'no-store');

      if (upload.expiresAt) {
        res.set('Upload-Expires', new Date(upload.expiresAt).toISOString());
      }

      res.status(200).end();
    } catch (err) {
      next(err);
    }
  });

  // ── PATCH: Upload Data ────────────────────────────────────────────────

  /** PATCH /v1/storage/tus/uploads/:uploadId — upload data chunk. */
  router.patch(
    '/uploads/:uploadId',
    auth,
    raw({ type: '*/*', limit: '64mb' }),
    async (req, res, next) => {
      try {
        const uploadOffset = parseInt(req.header('upload-offset') ?? '0', 10);
        if (Number.isNaN(uploadOffset)) {
          throw ApiError.badRequest('Invalid Upload-Offset header');
        }

        const checksumHeader = req.header('upload-checksum');
        const checksum = parseUploadChecksum(checksumHeader);

        const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (body.length === 0) {
          throw ApiError.badRequest('Empty PATCH body');
        }

        const result = await service.patch(
          req.auth!.sub,
          req.params.uploadId!,
          body,
          uploadOffset,
          checksum,
        );

        res.set('Tus-Resumable', TUS_VERSION);
        res.set('Upload-Offset', String(result.offset));
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Complete: Finalize Upload ─────────────────────────────────────────

  /** POST /v1/storage/tus/uploads/:uploadId/complete — finalize and register. */
  router.post('/uploads/:uploadId/complete', auth, async (req, res, next) => {
    try {
      const result = await service.finalize(
        req.auth!.sub,
        req.params.uploadId!,
        req.tenant?.id ?? null,
      );

      // Register in storage registry
      await registry.record({
        key: result.key,
        size: result.size,
        contentType: result.contentType,
        ownerId: req.auth!.sub,
        appId: req.tenant?.id ?? null,
      });

      // Webhook
      try {
        await getWebhookService(ctx).deliver('storage.upload', {
          key: result.key,
          size: result.size,
          contentType: result.contentType,
          ownerId: req.auth!.sub,
          chunked: true,
          protocol: 'tus',
        });
      } catch {
        // Webhook failures must never break the request
      }

      res.set('Tus-Resumable', TUS_VERSION);
      res.status(201).json({
        key: result.key,
        size: result.size,
        contentType: result.contentType,
      });
    } catch (err) {
      next(err);
    }
  });

  // ── DELETE: Terminate ─────────────────────────────────────────────────

  /** DELETE /v1/storage/tus/uploads/:uploadId — terminate upload. */
  router.delete('/uploads/:uploadId', auth, async (req, res, next) => {
    try {
      await service.terminate(req.auth!.sub, req.params.uploadId!);
      res.set('Tus-Resumable', TUS_VERSION);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
