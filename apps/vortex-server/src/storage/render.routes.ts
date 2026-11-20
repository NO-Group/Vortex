import { Router } from 'express';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { storageGuard, validateKey } from './storage-guard.js';
import { createStorageDriver } from './storage.factory.js';
import { EdgeTransformService } from './edge-transform.service.js';
import type { TokenConfig } from '../auth/tokens.js';

/**
 * `/v1/storage/render` — Dynamic Edge Image Transformation.
 *
 * Parses URL query parameters (path, w, h, fmt, q, fit).
 * Intercepts image requests, resizes/converts formats on-the-fly,
 * and caches transformed assets back into an edge cache bucket
 * to prevent redundant CPU computation.
 */
export function createRenderRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  // Create driver and transform service
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

  const transformService = new EdgeTransformService(
    driver,
    ctx.edgeCache,
    ctx.env.storage.publicApiBase,
  );

  /** GET /v1/storage/render — render an image transformation. */
  router.get('/render', auth, storageGuard, async (req, res, next) => {
    try {
      const query = req.query as Record<string, string>;
      const params = transformService.parseParams(query);

      if (!params) {
        throw new Error('Missing "path" query parameter');
      }

      validateKey(params.path);

      const result = await transformService.render(params);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
