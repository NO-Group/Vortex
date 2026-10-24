import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { NotificationService } from './notification.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import type { TokenConfig } from '../auth/tokens.js';

const deviceSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['web', 'ios', 'android']).optional(),
  pushService: z.enum(['fcm', 'apns', 'web_push']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const notificationSchema = z.object({
  title: z.string().min(1).max(256),
  body: z.string().min(1),
  data: z.record(z.unknown()).optional(),
  target: z.enum(['all', 'web', 'ios', 'android']).optional(),
});

export function createNotificationRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new NotificationService(ctx.db, {
    fcmServerKey: ctx.env.fcmServerKey,
    publicAppUrl: ctx.env.publicAppUrl,
  });
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  function requireAdmin(role: string | undefined): void {
    if (role !== 'admin') throw ApiError.forbidden('Admin access required');
  }

  // ── Device management ─────────────────────────────────────────────────

  /** POST /v1/notifications/devices — register a device token. */
  router.post('/devices', auth, validateBody(deviceSchema), async (req, res, next) => {
    try {
      const result = await service.registerDevice({
        userId: req.auth!.sub,
        token: req.body.token,
        platform: req.body.platform,
        pushService: req.body.pushService,
        metadata: req.body.metadata,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/notifications/devices — list registered devices. */
  router.get('/devices', auth, async (req, res, next) => {
    try {
      const devices = await service.listDevices(req.auth!.sub);
      res.json({ devices });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/notifications/devices/:id — deactivate a device. */
  router.delete('/devices/:id', auth, async (req, res, next) => {
    try {
      await service.deactivateDevice(req.auth!.sub, req.params.id!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Notifications ────────────────────────────────────────────────────

  /** POST /v1/notifications — send a push notification. */
  router.post('/', auth, validateBody(notificationSchema), async (req, res, next) => {
    try {
      const result = await service.sendNotification({
        userId: req.auth!.sub,
        title: req.body.title,
        body: req.body.body,
        data: req.body.data,
        target: req.body.target,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/notifications — list your notifications. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const notifications = await service.listNotifications(req.auth!.sub, limit);
      res.json({ notifications });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/notifications/stats — notification stats. */
  router.get('/stats', auth, async (req, res, next) => {
    try {
      const stats = await service.notificationStats(req.auth!.sub);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  // ── Admin: broadcast ──────────────────────────────────────────────────

  /** POST /v1/notifications/broadcast — admin: send to all users. */
  router.post('/broadcast', auth, validateBody(notificationSchema), async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role);
      const result = await service.sendNotification({
        title: req.body.title,
        body: req.body.body,
        data: req.body.data,
        target: req.body.target ?? 'all',
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
