import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import { SessionService } from './session.service.js';
import type { TokenConfig } from './tokens.js';

const revokeSchema = z.object({
  sessionId: z.string().min(1).max(256),
});

/**
 * `/v1/auth/sessions` — session management: list, revoke, revoke-all.
 */
export function createSessionRoutes(ctx: AppContext): Router {
  const router = Router();
  const sessions = ctx.sessions;
  const auth = requireAuth(ctx.env.jwt as TokenConfig, sessions);

  /** GET /v1/auth/sessions — list active sessions for the user. */
  router.get('/', auth, async (req, res, next) => {
    try {
      const rows = await sessions.list(req.auth!.sub);
      res.json({
        sessions: rows.map((r) => ({
          id: r.id,
          sessionId: r.session_id,
          userAgent: r.user_agent,
          ipAddress: r.ip_address,
          deviceType: r.device_type,
          lastActiveAt: r.last_active_at.toISOString(),
          createdAt: r.created_at.toISOString(),
        })),
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/sessions/revoke — revoke a single session. */
  router.post('/revoke', auth, validateBody(revokeSchema), async (req, res, next) => {
    try {
      const revoked = await sessions.revoke(req.auth!.sub, req.body.sessionId);
      if (!revoked) throw ApiError.notFound('Session not found or already revoked');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/sessions/revoke-all — revoke all sessions (except current). */
  router.post('/revoke-all', auth, async (req, res, next) => {
    try {
      const count = await sessions.revokeAll(req.auth!.sub);
      res.json({ revoked: count });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
