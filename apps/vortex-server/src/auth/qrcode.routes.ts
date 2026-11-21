import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { ApiError } from '../errors.js';
import { QrCodeService } from './qrcode.service.js';
import { AuthService } from './auth.service.js';
import type { TokenConfig } from './tokens.js';

const qrVerifySchema = z.object({
  token: z.string().min(16).max(256),
});

/**
 * `/v1/auth/qr-code` — QR code sign-in flow.
 *
 * POST /init   — generate a QR code for the authenticated user
 * POST /verify — verify a scanned QR token and receive a session
 */
export function createQrCodeRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);
  const qrService = new QrCodeService(ctx.db);
  const authService = new AuthService(ctx.db, ctx.env.jwt as TokenConfig, {
    devLinks: ctx.env.devLinks,
    publicAppUrl: ctx.env.publicAppUrl,
    mailer: undefined,
  });

  /** POST /v1/auth/qr-code/init — generate a QR code sign-in session. */
  router.post('/init', auth, async (req, res, next) => {
    try {
      const session = await qrService.init(req.auth!.sub);
      res.status(201).json({
        token: session.token,
        qrDataUrl: session.qrDataUrl,
        expiresAt: session.expiresAt.toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/qr-code/verify — verify a QR token, receive a session. */
  router.post('/verify', validateBody(qrVerifySchema), async (req, res, next) => {
    try {
      const { token } = req.body;
      const userId = await qrService.verify(token);
      if (!userId) {
        throw ApiError.unauthorized('Invalid or expired QR code token');
      }
      const session = await authService.issueSessionForUser(userId);
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
