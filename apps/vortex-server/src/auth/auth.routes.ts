import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { AuthService } from './auth.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import type { TokenConfig } from './tokens.js';

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  metadata: z.record(z.unknown()).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function createAuthRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new AuthService(ctx.db, ctx.env.jwt as TokenConfig);
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  /** POST /v1/auth/signup — register and receive an access token. */
  router.post('/signup', validateBody(signupSchema), async (req, res, next) => {
    try {
      const session = await service.signup(req.body);
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/login — exchange credentials for an access token. */
  router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const session = await service.login(req.body);
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/auth/me — profile of the authenticated user. */
  router.get('/me', auth, async (req, res, next) => {
    try {
      const user = await service.me(req.auth!.sub);
      res.status(200).json({ user });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
