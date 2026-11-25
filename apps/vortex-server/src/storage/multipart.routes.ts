import { Router, raw } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { storageGuard, validateKey } from './storage-guard.js';
import { createStorageDriver } from './storage.factory.js';
import type { TokenConfig } from '../auth/tokens.js';

const initiateSchema = z.object({
  key: z.string().min(1).max(512),
  mimeType: z.string().max(256),
});

const uploadPartSchema = z.object({
  key: z.string().min(1).max(512),
  uploadId: z.string().min(1).max(512),
  partNumber: z.number().int().min(1).max(10000),
});

const completeSchema = z.object({
  key: z.string().min(1).max(512),
  uploadId: z.string().min(1).max(512),
  parts: z.array(
    z.object({
      partNumber: z.number().int().min(1),
      etag: z.string().min(1),
    }),
  ).min(1).max(10000),
});

const abortSchema = z.object({
  key: z.string().min(1).max(512),
  uploadId: z.string().min(1).max(512),
});

/**
 * `/v1/storage/multipart` — Chunked Multipart Ingest Pipeline.
 *
 * Handles large asset uploads (>100 MB) by exposing:
 * - /v1/storage/multipart/initiate — start a multipart upload
 * - /v1/storage/multipart/upload-part — upload a single part
 * - /v1/storage/multipart/complete — assemble all parts
 * - /v1/storage/multipart/abort — cancel a upload
 *
 * Automatic cleanup of uncompleted/orphaned multipart uploads
 * is handled by the cleanupOrphanedMultipartUploads method
 * (runs after 24 hours).
 */
export function createMultipartRoutes(ctx: AppContext): Router {
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

  /** POST /v1/storage/multipart/initiate — start a multipart upload. */
  router.post(
    '/multipart/initiate',
    auth,
    storageGuard,
    validateBody(initiateSchema),
    async (req, res, next) => {
      try {
        validateKey(req.body.key);
        const result = await driver.initiateMultipartUpload(req.body.key, req.body.mimeType);
        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /v1/storage/multipart/upload-part — upload a single part. */
  router.post(
    '/multipart/upload-part',
    auth,
    storageGuard,
    raw({ type: () => true, limit: '64mb' }),
    validateBody(uploadPartSchema),
    async (req, res, next) => {
      try {
        validateKey(req.body.key);
        const bodyBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const result = await driver.uploadPart(
          req.body.key,
          req.body.uploadId,
          req.body.partNumber,
          bodyBuffer,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /v1/storage/multipart/complete — assemble all parts. */
  router.post(
    '/multipart/complete',
    auth,
    storageGuard,
    validateBody(completeSchema),
    async (req, res, next) => {
      try {
        validateKey(req.body.key);
        const result = await driver.completeMultipartUpload(
          req.body.key,
          req.body.uploadId,
          req.body.parts,
        );
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /v1/storage/multipart/abort — cancel a multipart upload. */
  router.post(
    '/multipart/abort',
    auth,
    storageGuard,
    validateBody(abortSchema),
    async (req, res, next) => {
      try {
        validateKey(req.body.key);
        await driver.abortMultipartUpload(req.body.key, req.body.uploadId);
        res.status(204).end();
      } catch (err) {
        next(err);
      }
    },
  );

  /** POST /v1/storage/multipart/cleanup — clean up orphaned uploads (admin only). */
  router.post(
    '/multipart/cleanup',
    auth,
    async (req, res, next) => {
      try {
        if (req.auth!.role !== 'admin') {
          throw ApiError.forbidden('Only admins can clean up orphaned uploads');
        }
        const olderThan = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const count = await driver.cleanupOrphanedMultipartUploads(olderThan);
        res.json({ cleaned: count });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
