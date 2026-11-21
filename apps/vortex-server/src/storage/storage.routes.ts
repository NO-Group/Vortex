/**
 * Vortex Server — Storage routes: /v1/storage/*
 */

import { Router, raw } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { LocalStorageDriver } from './local.driver.js';
import { R2StorageDriver } from './r2.driver.js';
import { StorageRegistry } from './storage.service.js';

const presignUploadSchema = z.object({
  key: z.string().min(1).max(1024),
  contentType: z.string().min(1).max(255).optional(),
  expiresIn: z.number().int().positive().max(3600).optional(),
});

const presignDownloadSchema = z.object({
  key: z.string().min(1).max(1024),
  expiresIn: z.number().int().positive().max(3600).optional(),
});

export function createStorageRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt);
  const registry = new StorageRegistry(ctx.db);
  const driver = ctx.storage;

  /** POST /v1/storage/presign-upload — get a direct-upload URL. */
  router.post('/presign-upload', auth, validateBody(presignUploadSchema), async (req, res, next) => {
    try {
      const presigned = await driver.presignUpload(req.body, deriveBaseUrl(ctx, req));
      res.json(presigned);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/storage/presign-download — get a direct-download URL. */
  router.post('/presign-download', auth, validateBody(presignDownloadSchema), async (req, res, next) => {
    try {
      const presigned = await driver.presignDownload(req.body.key, req.body.expiresIn ?? 900, deriveBaseUrl(ctx, req));
      res.json(presigned);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/storage/upload — proxied upload with owner registration. */
  router.post('/upload', auth, raw({ type: '*/*', limit: '64mb' }), async (req, res, next) => {
    try {
      const key = String(req.query.key ?? '');
      if (!key) throw ApiError.badRequest('Missing "key" query parameter');
      const contentType = req.header('content-type') ?? 'application/octet-stream';
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

      const result = await driver.put({ key, body, contentType });
      const meta = await registry.record({
        key: result.key,
        size: result.size,
        contentType,
        ownerId: req.auth!.sub,
      });
      res.status(201).json({ object: meta });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/storage/object?key= — download an owned object. */
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

  /** GET /v1/storage/list — list objects owned by the caller. */
  router.get('/list', auth, async (req, res, next) => {
    try {
      const objects = await registry.listForOwner(req.auth!.sub, 1000);
      res.json({ objects });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/storage/object — remove an owned object. */
  router.delete('/object', auth, validateBody(z.object({ key: z.string().min(1).max(1024) })), async (req, res, next) => {
    try {
      const key = req.body.key as string;
      const meta = await registry.find(key);
      if (meta && meta.ownerId && meta.ownerId !== req.auth!.sub && req.auth!.role !== 'admin') {
        throw ApiError.forbidden('You do not own this object');
      }
      await driver.delete(key);
      await registry.remove(key);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Driver-specific presigned endpoints (HMAC token auth, no JWT) ─────────

  if (driver instanceof LocalStorageDriver) {
    /** PUT /v1/storage/local/upload?token= — presigned local upload. */
    router.put('/local/upload', raw({ type: '*/*', limit: '64mb' }), async (req, res, next) => {
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
    });

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

  if (driver instanceof R2StorageDriver) {
    /** PUT /v1/storage/r2/upload?token=&bucket= — presigned R2 upload proxy. */
    router.put('/r2/upload', raw({ type: '*/*', limit: '64mb' }), async (req, res, next) => {
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
    });

    /** GET /v1/storage/r2/object?token=&bucket= — presigned R2 download proxy. */
    router.get('/r2/object', async (req, res, next) => {
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

/** Derive the public base URL from the request when PUBLIC_API_BASE=auto. */
function deriveBaseUrl(ctx: AppContext, req: { protocol: string; get: (name: string) => string | undefined }): string | undefined {
  if (ctx.env.storage.publicApiBase !== 'auto') return undefined;
  const host = req.get('x-forwarded-host') ?? req.get('host');
  if (!host) return undefined;
  const proto = req.get('x-forwarded-proto') ?? req.protocol;
  return `${proto}://${host}`;
}
