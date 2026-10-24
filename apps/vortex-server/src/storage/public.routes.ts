import { Router } from 'express';
import type { AppContext } from '../context.js';
import { BucketService } from './buckets.service.js';
import { applyTransforms, parseTransforms, hasTransforms } from './image-transforms.js';
import { join } from 'node:path';

/**
 * Anonymous object reads for PUBLIC buckets:
 *   `GET /v1/storage/public/<bucket>/<path>`
 *
 * Private buckets always 404 here (existence is not leaked).
 *
 * Image transforms: append Cloudinary-compatible parameters to any image URL:
 *   `GET /v1/storage/public/images/photo.jpg?w=800&h=600&fit=cover&fmt=webp`
 * The gateway applies the transform on the fly (powered by sharp) and caches
 * the result on disk.
 */
export function createPublicStorageRoutes(ctx: AppContext): Router {
  const router = Router();
  const buckets = new BucketService(ctx.db);

  router.get('/:bucket/*', async (req, res, next) => {
    try {
      const bucketName = String(req.params.bucket ?? '');
      const rest = String((req.params as Record<string, string>)[0] ?? '').replace(/^\/+/, '');
      const key = `${bucketName}/${rest}`;

      const bucket = await buckets.get(bucketName);
      if (!bucket?.public) {
        res.status(404).type('text').send('Not found');
        return;
      }

      const object = await ctx.storage.get(key).catch(() => null);
      if (!object) {
        res.status(404).type('text').send('Not found');
        return;
      }

      // Parse transform parameters (Cloudinary-compatible).
      const transforms = parseTransforms(req.query as Record<string, string | string[] | undefined>);
      const transformCacheDir = join(process.cwd(), '.vortex-data', 'transform-cache');

      if (hasTransforms(transforms)) {
        // Apply transforms on the fly — sharp-powered, cached to disk.
        const result = await applyTransforms(object.body, key, transforms, transformCacheDir);

        res.setHeader('content-type', result.contentType);
        res.setHeader('content-length', String(result.body.length));
        res.setHeader('cache-control', 'public, max-age=86400');
        res.setHeader('x-vortex-bucket', bucketName);
        res.setHeader('x-vortex-transform', result.cached ? 'cached' : 'generated');
        if (result.cacheKey) {
          res.setHeader('x-vortex-cache-key', result.cacheKey);
        }
        res.send(result.body);
        return;
      }

      // No transforms — serve the original.
      res.setHeader('content-type', object.contentType);
      res.setHeader('content-length', String(object.size));
      res.setHeader('cache-control', 'public, max-age=300');
      res.setHeader('x-vortex-bucket', bucketName);
      res.send(object.body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
