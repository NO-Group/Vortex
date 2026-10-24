import { Router } from 'express';
import type { AppContext } from '../context.js';
import { BucketService } from './buckets.service.js';
import { applyTransforms, parseTransforms, hasTransforms } from './image-transforms.js';
import { EdgeCache } from '../governance/edge-cache.js';
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
 *
 * Edge Cache: every response gets an ETag. Repeat requests with If-None-Match
 * return 304 Not Modified. Cache-Control headers are set for CDNs. The edge
 * cache stores transformed + original objects for instant repeat reads.
 */
export function createPublicStorageRoutes(ctx: AppContext): Router {
  const router = Router();
  const buckets = new BucketService(ctx.db);
  const edgeCache = new EdgeCache({
    maxEntries: ctx.env.edgeCacheMaxEntries ?? 10000,
    defaultTtl: ctx.env.edgeCacheTtl ?? 300,
  });

  router.get('/:bucket/*', async (req, res, next) => {
    try {
      const bucketName = String(req.params.bucket ?? '');
      const rest = String((req.params as Record<string, string>)[0] ?? '').replace(/^\/+/, '');
      const key = `${bucketName}/${rest}`;
      const cacheKey = `storage:public:${key}`;

      // Check the edge cache first.
      const cached = edgeCache.get(cacheKey);
      if (cached) {
        // Conditional GET — if the client's ETag matches, return 304.
        const ifNoneMatch = req.headers['if-none-match'] as string | undefined;
        if (edgeCache.matchesEtag(cacheKey, ifNoneMatch)) {
          res.status(304).setHeader('ETag', cached.etag);
          res.end();
          return;
        }

        // Serve from cache.
        res.status(cached.status);
        res.setHeader('content-type', cached.contentType);
        res.setHeader('content-length', String(cached.body.length));
        res.setHeader('cache-control', `public, max-age=${Math.floor((cached.expiresAt - Date.now()) / 1000)}`);
        res.setHeader('ETag', cached.etag);
        res.setHeader('x-vortex-cache', 'edge');
        res.setHeader('x-vortex-bucket', bucketName);
        res.send(cached.body);
        return;
      }

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

        const contentType = result.contentType;
        const body = Buffer.isBuffer(result.body) ? result.body : Buffer.from(result.body);

        res.setHeader('content-type', contentType);
        res.setHeader('content-length', String(body.length));
        res.setHeader('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
        res.setHeader('x-vortex-bucket', bucketName);
        res.setHeader('x-vortex-transform', result.cached ? 'cached' : 'generated');
        if (result.cacheKey) {
          res.setHeader('x-vortex-cache-key', result.cacheKey);
        }

        // Cache the transformed response.
        const entry = edgeCache.put(cacheKey, body, contentType, {
          status: 200,
          ttl: 86400,
        });
        res.setHeader('ETag', entry.etag);

        res.send(body);
        return;
      }

      // No transforms — serve the original.
      const contentType = object.contentType;
      const body = Buffer.isBuffer(object.body) ? object.body : Buffer.from(object.body);

      res.setHeader('content-type', contentType);
      res.setHeader('content-length', String(body.length));
      res.setHeader('cache-control', 'public, max-age=300, stale-while-revalidate=86400');
      res.setHeader('x-vortex-bucket', bucketName);

      // Cache the original.
      const entry = edgeCache.put(cacheKey, body, contentType, {
        status: 200,
        ttl: 300,
      });
      res.setHeader('ETag', entry.etag);

      res.send(body);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
