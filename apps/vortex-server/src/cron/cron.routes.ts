import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from '../auth/tokens.js';
import { CronService } from './cron.service.js';

const createSchema = z.object({
  name: z.string().min(2).max(40),
  functionName: z.string().min(1).max(40).nullable().optional(),
  cronExpression: z.string().min(1).max(100),
  payload: z.record(z.unknown()).nullable().optional(),
});

const patchSchema = z.object({
  functionName: z.string().min(1).max(40).nullable().optional(),
  cronExpression: z.string().min(1).max(100).optional(),
  payload: z.record(z.unknown()).nullable().optional(),
  status: z.enum(['enabled', 'disabled']).optional(),
});

const triggerSchema = z.object({
  payload: z.record(z.unknown()).nullable().optional(),
});

/** Management API — `/v1/cron/jobs`. */
export function createCronRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = new CronService(ctx.db);

  /** POST /v1/cron/jobs — create a scheduled job. */
  router.post('/jobs', auth, validateBody(createSchema), async (req, res, next) => {
    try {
      const job = await service.create(req.auth!.sub, req.body);
      res.status(201).json({ job });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/cron/jobs — list scheduled jobs. */
  router.get('/jobs', auth, async (req, res, next) => {
    try {
      const isAdmin = req.auth!.role === 'admin';
      const jobs = await service.list(req.auth!.sub, isAdmin);
      res.json({ jobs });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/cron/jobs/:name — get a single job. */
  router.get('/jobs/:name', auth, async (req, res, next) => {
    try {
      const isAdmin = req.auth!.role === 'admin';
      const job = await service.get(req.params.name!, req.auth!.sub, isAdmin);
      res.json({ job });
    } catch (err) {
      next(err);
    }
  });

  /** PUT /v1/cron/jobs/:name — update a job (expression, payload, status). */
  router.put('/jobs/:name', auth, validateBody(patchSchema), async (req, res, next) => {
    try {
      const isAdmin = req.auth!.role === 'admin';
      const job = await service.update(
        req.params.name!,
        req.auth!.sub,
        isAdmin,
        req.body,
      );
      res.json({ job });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/cron/jobs/:name — remove a job and its run history. */
  router.delete('/jobs/:name', auth, async (req, res, next) => {
    try {
      const isAdmin = req.auth!.role === 'admin';
      await service.remove(req.params.name!, req.auth!.sub, isAdmin);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/cron/jobs/:name/trigger — manually trigger a job immediately. */
  router.post('/jobs/:name/trigger', auth, validateBody(triggerSchema.optional()), async (req, res, next) => {
    try {
      const scheduler = ctx.cronScheduler;
      if (!scheduler) throw new Error('Cron scheduler not initialized');

      const payloadOverride = req.body?.payload;
      const result = await scheduler.triggerJob(req.params.name!, payloadOverride);
      res.json({ job: await service.get(req.params.name!, req.auth!.sub, req.auth!.role === 'admin'), result });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/cron/jobs/:name/runs — list execution history for a job. */
  router.get('/jobs/:name/runs', auth, async (req, res, next) => {
    try {
      const isAdmin = req.auth!.role === 'admin';
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;
      const runs = await service.listRuns(
        req.params.name!,
        req.auth!.sub,
        isAdmin,
        limit,
      );
      res.json({ runs });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/cron/scheduler — scheduler status. */
  router.get('/scheduler', auth, async (_req, res, next) => {
    try {
      const scheduler = ctx.cronScheduler;
      res.json({
        running: scheduler?.isRunning ?? false,
        tickCount: scheduler?.tickCount ?? 0,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
