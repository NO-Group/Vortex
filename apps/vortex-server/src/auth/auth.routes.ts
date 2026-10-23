import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { AuthService } from './auth.service.js';
import { ApiError } from '../errors.js';
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

const magicSchema = z.object({ email: z.string().email() });
const magicVerifySchema = z.object({ token: z.string().min(16).max(256) });
const resetConfirmSchema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});
const adminPatchSchema = z.object({
  role: z.string().min(1).max(32).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const requireAdmin = (role: string | undefined): void => {
  if (role !== 'admin') throw ApiError.forbidden('Admin access required');
};

export function createAuthRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new AuthService(ctx.db, ctx.env.jwt as TokenConfig, {
    devLinks: ctx.env.devLinks,
  });
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

  /** POST /v1/auth/magic-link — begin passwordless sign-in. */
  router.post('/magic-link', validateBody(magicSchema), async (req, res, next) => {
    try {
      const result = await service.requestMagicLink(req.body.email);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/magic-link/verify — consume the link, receive a session. */
  router.post('/magic-link/verify', validateBody(magicVerifySchema), async (req, res, next) => {
    try {
      const session = await service.verifyMagicLink(req.body.token);
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/password-reset — begin a password reset. */
  router.post('/password-reset', validateBody(magicSchema), async (req, res, next) => {
    try {
      const result = await service.requestPasswordReset(req.body.email);
      res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/password-reset/confirm — set a new password. */
  router.post(
    '/password-reset/confirm',
    validateBody(resetConfirmSchema),
    async (req, res, next) => {
      try {
        const session = await service.confirmPasswordReset(req.body.token, req.body.password);
        res.status(200).json(session);
      } catch (err) {
        next(err);
      }
    },
  );

  /** GET /v1/auth/users — admin: list accounts. */
  router.get('/users', auth, async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role);
      const users = await service.listUsers();
      res.json({ users });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/auth/users/:id — admin: change role / custom claims. */
  router.patch('/users/:id', auth, validateBody(adminPatchSchema), async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role);
      const user = await service.updateUser(req.params.id!, req.body);
      res.json({ user });
    } catch (err) {
      next(err);
    }
  });

  /** DELETE /v1/auth/users/:id — admin: remove an account. */
  router.delete('/users/:id', auth, async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role);
      await service.deleteUser(req.auth!.sub, req.params.id!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
