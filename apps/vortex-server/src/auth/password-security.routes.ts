import { Router } from 'express';
import type { AppContext } from '../context.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ApiError } from '../errors.js';
import { PasswordSecurityService } from './password-security.service.js';
import { verifyPassword } from './passwords.js';
import type { TokenConfig } from './tokens.js';

/**
 * `/v1/auth/password-security` — breached password check, password history,
 * and account lockout status.
 */
export function createPasswordSecurityRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const admin = requireRole('admin');
  const service = new PasswordSecurityService(ctx.db);

  /** GET /v1/auth/password-security/check — check if a password is breached. */
  router.get('/check', auth, async (req, res, next) => {
    try {
      const password = String(req.query.password ?? '');
      if (!password) throw ApiError.badRequest('Missing "password" query parameter');
      const breached = service.isBreached(password);
      res.json({ breached });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/auth/password-security/history — get password history. */
  router.get('/history', auth, async (req, res, next) => {
    try {
      const rows = await service.getHistory(req.auth!.sub);
      res.json({
        history: rows.map((r) => ({
          id: r.id,
          createdAt: r.created_at.toISOString(),
        })),
        count: rows.length,
      });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/auth/password-security/lockout — get lockout status. */
  router.get('/lockout', auth, async (req, res, next) => {
    try {
      const status = await service.getLockoutStatus(req.auth!.sub);
      res.json(status);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/password-security/validate — validate a new password. */
  router.post('/validate', auth, async (req, res, next) => {
    try {
      const { password } = req.body as { password: string };
      if (!password) throw ApiError.badRequest('Missing "password" in body');

      const user = await ctx.db('users').where({ id: req.auth!.sub }).first();
      if (!user) throw ApiError.notFound('User not found');

      const result = await service.validateNewPassword(
        req.auth!.sub,
        password,
        user.password_hash,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/password-security/clear-lockout — admin: clear lockout. */
  router.post('/clear-lockout/:userId', auth, admin, async (req, res, next) => {
    try {
      await service.clearLockout(req.params.userId!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
