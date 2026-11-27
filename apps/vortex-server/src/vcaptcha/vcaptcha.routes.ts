import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { VCaptchaService } from './vcaptcha.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const generateSchema = z.object({
  mode: z.enum(['sequence', 'negative', 'pattern']).optional(),
  gridSize: z.number().int().min(3).max(5).optional(),
  sequenceLength: z.number().int().min(3).max(5).optional(),
});

const verifySchema = z.object({
  challengeId: z.string().min(1).max(256),
  clicks: z.array(z.number().int().min(0).max(25)).min(1).max(25),
});

const configPatchSchema = z.object({
  enabled: z.boolean().optional(),
  default_mode: z.enum(['sequence', 'negative', 'pattern']).optional(),
  default_grid_size: z.number().int().min(3).max(5).optional(),
  default_sequence_length: z.number().int().min(3).max(5).optional(),
  ttl_seconds: z.number().int().min(60).max(3600).optional(),
  require_on_signup: z.boolean().optional(),
  require_on_login: z.boolean().optional(),
  max_attempts: z.number().int().min(1).max(10).optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one config field must be provided',
});

const SUPER_ADMIN_EMAIL = process.env.VORTEX_SUPER_ADMIN?.trim().toLowerCase();

function requireAdmin(role: string | undefined, email?: string): void {
  if (email?.toLowerCase() === SUPER_ADMIN_EMAIL) return;
  if (role !== 'admin') {
    const err: Error & { status?: number } = new Error('Admin access required');
    err.status = 403;
    throw err;
  }
}

/**
 * `/v1/vcaptcha` — Temporal-Spatial Sequence Recall captcha.
 *
 * VCaptcha is a novel anti-bot challenge: the user watches cells light up
 * in sequence on a grid, then reproduces the sequence by clicking. This
 * tests cognition (working memory + spatial recall), not perception —
 * making it immune to OCR, vision AI, and behavioral profiling.
 *
 * POST /challenge  — Generate a new challenge
 * POST /verify     — Verify a solution
 * GET  /config      — Get current VCaptcha configuration
 * PATCH /config     — Update configuration (admin only)
 * GET  /stats       — Challenge statistics (admin only)
 * POST /cleanup     — Delete expired challenges (admin only)
 */
export function createVCaptchaRoutes(ctx: AppContext): Router {
  const router = Router();
  const vcaptcha = new VCaptchaService(ctx.db, ctx.env.jwt.secret);
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  /**
   * POST /v1/vcaptcha/challenge — generate a new challenge.
   *
   * Returns the grid dimensions and metadata. The correct sequence
   * is stored server-side and never exposed to the client.
   */
  router.post('/challenge', validateBody(generateSchema), async (req, res, next) => {
    try {
      const config = await vcaptcha.getConfig();
      if (!config.enabled) {
        return res.status(403).json({
          error: { code: 'vcaptcha_disabled', message: 'VCaptcha is not enabled.' },
        });
      }
      const challenge = await vcaptcha.generateChallenge(req.body ?? undefined);
      res.status(201).json(challenge);
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /v1/vcaptcha/verify — verify a solution.
   *
   * The client sends the challenge ID (HMAC hash) and the sequence of
   * cell indices the user clicked. Returns valid=true on success, or a
   * new challenge on failure.
   */
  router.post('/verify', validateBody(verifySchema), async (req, res, next) => {
    try {
      const config = await vcaptcha.getConfig();
      if (!config.enabled) {
        return res.status(403).json({
          error: { code: 'vcaptcha_disabled', message: 'VCaptcha is not enabled.' },
        });
      }
      const ip = req.ip ?? req.socket.remoteAddress ?? undefined;
      const result = await vcaptcha.verifySolution(req.body, ip);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/vcaptcha/config — get current VCaptcha configuration. */
  router.get('/config', async (req, res, next) => {
    try {
      const config = await vcaptcha.getConfig();
      res.json({ config });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/vcaptcha/config — update configuration (admin only). */
  router.patch('/config', auth, validateBody(configPatchSchema), async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role, req.auth!.email);
      const config = await vcaptcha.updateConfig(req.body);
      res.json({ config });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/vcaptcha/stats — challenge statistics (admin only). */
  router.get('/stats', auth, async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role, req.auth!.email);
      const stats = await vcaptcha.getStats();
      res.json({ stats });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/vcaptcha/cleanup — delete expired challenges (admin only). */
  router.post('/cleanup', auth, async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role, req.auth!.email);
      const deleted = await vcaptcha.cleanupExpired();
      res.json({ deleted });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
