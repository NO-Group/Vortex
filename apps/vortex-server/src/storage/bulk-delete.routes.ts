import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { storageGuard } from './storage-guard.js';
import { createStorageDriver } from './storage.factory.js';
import type { TokenConfig } from '../auth/tokens.js';

const bulkDeleteSchema = z.object({
  keys: z.array(z.string().min(1).max(512)).min(1).max(1000),
});

/**
 * `/v1/storage/bulk-delete` — Bulk Asset Purging.
 *
 * Accepts an array of up to 1,000 object keys.
 * Batch processes deletions using native batch S3 commands where supported,
 * with fallback parallel execution for local/Azure drivers.
 * Returns exact arrays of successfully deleted and failed keys.
 */
export function createBulkDeleteRoutes(ctx: AppContext): Router {
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

  /** POST /v1/storage/bulk-delete — delete multiple objects. */
  router.post(
    '/bulk-delete',
    auth,
    storageGuard,
    validateBody(bulkDeleteSchema),
    async (req, res, next) => {
      try {
        const result = await driver.deleteBulkObjects(req.body.keys);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
