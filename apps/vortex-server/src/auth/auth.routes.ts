/**
 * Vortex Server — Authentication routes: /v1/auth/*
 */

import { Router } from 'express';
import { z } from 'zod';
import { ApiError } from '../errors.js';
import type { AppContext } from '../context.js';
import { SessionService } from './session.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(128),
  role: z.enum(['admin', 'developer', 'viewer']).optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

export function createAuthRoutes(ctx: AppContext): Router {
  const router = Router();
  const session = new SessionService(ctx.db, ctx.env.jwt);
  const auth = requireAuth(ctx.env.jwt);

  /** POST /v1/auth/signup — create a new account. */
  router.post('/signup', validateBody(signupSchema), async (req, res, next) => {
    try {
      const user = await session.createUser(req.body);
      const { tokens } = await session.login(user.email, req.body.password);
      res.status(201).json({ user, tokens });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/login — authenticate and receive tokens. */
  router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const { user, tokens } = await session.login(req.body.email, req.body.password);
      res.json({ user, tokens });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/auth/me — get the currently authenticated user. */
  router.get('/me', auth, async (req, res, next) => {
    try {
      const user = await session.findById(req.auth!.sub);
      if (!user) {
        throw ApiError.notFound('User not found');
      }
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
