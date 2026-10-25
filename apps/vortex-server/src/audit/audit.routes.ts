import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createAuditService } from './audit.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const listQuerySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const statsQuerySchema = z.object({
  userId: z.string().optional(),
});

/** `/v1/audit` — audit log for authenticated users (self) or admins (any). */
export function createAuditRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const service = createAuditService(ctx.db);

  /** GET /v1/audit/log — list audit entries. */
  router.get('/log', auth, async (req, res, next) => {
    try {
      const parsed = listQuerySchema.parse(req.query);
      const isAdmin = req.auth!.role === 'admin';
      const targetUserId = isAdmin && parsed.userId
        ? parsed.userId
        : req.auth!.sub;

      const entries = await service.list({
        userId: targetUserId,
        action: parsed.action,
        limit: parsed.limit ?? 50,
        offset: parsed.offset ?? 0,
      });
      res.json({ entries, count: entries.length });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/audit/stats — audit statistics. */
  router.get('/stats', auth, async (req, res, next) => {
    try {
      const parsed = statsQuerySchema.parse(req.query);
      const isAdmin = req.auth!.role === 'admin';
      const targetUserId = isAdmin && parsed.userId
        ? parsed.userId
        : req.auth!.sub;

      const stats = await service.stats(targetUserId);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
