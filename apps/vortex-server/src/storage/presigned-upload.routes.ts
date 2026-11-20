import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { storageGuard, validateKey } from './storage-guard.js';
import { createStorageDriver } from './storage.factory.js';
import type { TokenConfig } from '../auth/tokens.js';

const presignSchema = z.object({
  key: z.string().min(1).max(512),
  contentType: z.string().max(256).optional(),
  fileSize: z.number().int().min(0).optional(),
  expiresIn: z.number().int().min(1).max(3600).optional(),
});

/**
 * `/v1/storage/presigned-upload` — Direct Presigned Browser Uploads.
 *
 * Accepts target filename, file size, and MIME type.
 * Validates bucket permission rules, generates a time-limited signed URL
 * (default 15 mins), and returns it to the client.
 * The client browser uploads directly to the cloud provider,
 * bypassing main API memory limits.
 */
export function createPresignedUploadRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const driver = createStorageDriver({
    type: (ctx.env.storage.driver === 's3' ? 'aws_s3' : 'local_disk') as any,
    bucket: ctx.env.storage.s3.bucket,
    region: ctx.env.storage.s3.region,
    endpoint: ctx.env.storage.s3.endpoint,
    accessKeyId: ctx.env.storage.s3.accessKeyId,
    secretAccessKey: ctx.env.storage.s3.secretAccessKey,
    forcePathStyle: ctx.env.storage.s3.forcePathStyle,
    localDir: ctx.env.storage.localDir,
  });

  /** POST /v1/storage/presigned-upload — generate a presigned upload URL. */
  router.post(
    '/presigned-upload',
    auth,
    storageGuard,
    validateBody(presignSchema),
    async (req, res, next) => {
      try {
        validateKey(req.body.key);

        // Validate file size against limits
        const maxSize = 5 * 1024 * 1024 * 1024; // 5 GB
        if (req.body.fileSize && req.body.fileSize > maxSize) {
          throw new Error('File size exceeds 5 GB limit');
        }

        const expiresIn = req.body.expiresIn ?? 900; // 15 minutes default

        const result = await driver.generatePresignedUrl({
          key: req.body.key,
          expiresInSeconds: expiresIn,
          contentType: req.body.contentType,
          action: 'write',
        });

        res.json({
          ...result,
          key: req.body.key,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /v1/storage/presigned-download — generate a presigned download URL. */
  router.post(
    '/presigned-download',
    auth,
    storageGuard,
    validateBody(presignSchema),
    async (req, res, next) => {
      try {
        validateKey(req.body.key);
        const expiresIn = req.body.expiresIn ?? 900;

        const result = await driver.generatePresignedUrl({
          key: req.body.key,
          expiresInSeconds: expiresIn,
          action: 'read',
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
