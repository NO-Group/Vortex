import { Router } from 'express';
import type { AppContext } from '../context.js';
import { BucketService } from './buckets.service.js';

/**
 * Anonymous object reads for PUBLIC buckets:
 *   `GET /v1/storage/public/<bucket>/<path>`
 *
 * Private buckets always 404 here (existence is not leaked).
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
