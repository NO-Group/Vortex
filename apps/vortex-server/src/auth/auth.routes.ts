import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { AuthService } from './auth.service.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { createMailer } from '../mailer/mailer.js';
import { OneTimeTokens } from './one-time-tokens.js';
import { createOAuthRoutes } from './oauth.routes.js';
import { createTwoFactorRoutes } from './twofactor.routes.js';
import { WebhookService } from '../webhooks/webhook.service.js';
import { createAuditService } from '../audit/audit.service.js';
import type { TokenConfig } from './tokens.js';

let webhookService: WebhookService | null = null;
let auditService: ReturnType<typeof createAuditService> | null = null;

function getAuditService(ctx: AppContext) {
  if (!auditService) {
    auditService = createAuditService(ctx.db);
  }
  return auditService;
}

async function recordAudit(
  ctx: AppContext,
  userId: string,
  role: string,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await getAuditService(ctx).record({ userId, role, action, resourceType, resourceId, metadata });
  } catch {
    // Audit failures must never break the request
  }
}

function getWebhookService(ctx: AppContext): WebhookService {
  if (!webhookService) {
    webhookService = new WebhookService(ctx.db, {
      publicAppUrl: ctx.env.publicAppUrl,
    });
  }
  return webhookService;
}

async function deliverWebhook(
  ctx: AppContext,
  event: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    await getWebhookService(ctx).deliver(event, data);
  } catch {
    // Webhook delivery failures must never break the request
  }
}

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

const profilePatchSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const requireAdmin = (role: string | undefined): void => {
  if (role !== 'admin') throw ApiError.forbidden('Admin access required');
};

export function createAuthRoutes(ctx: AppContext): Router {
  const router = Router();
  const service = new AuthService(ctx.db, ctx.env.jwt as TokenConfig, {
    devLinks: ctx.env.devLinks,
    publicAppUrl: ctx.env.publicAppUrl,
    mailer: createMailer(ctx.env),
  });
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  /** POST /v1/auth/signup — register and receive an access token. */
  router.post('/signup', validateBody(signupSchema), async (req, res, next) => {
    try {
      const session = await service.signup(req.body);
      void recordAudit(ctx, session.user.id, session.user.role, 'auth.signup',
        'user', session.user.id, { email: session.user.email });
      void deliverWebhook(ctx, 'auth.signup', {
        user: session.user,
      });
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/auth/login — exchange credentials for an access token. */
  router.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      const session = await service.login(req.body);

      // Check if 2FA is enabled — return a challenge instead of session
      const userRow = await ctx.db('users').where({ id: session.user.id }).first();
      if (userRow?.two_factor_enabled) {
        const oneTimeTokens = new OneTimeTokens(ctx.db);
        const { token: tempToken } = await oneTimeTokens.issue(session.user.id, '2fa', 5);
        return res.json({ twoFactorRequired: true, tempToken });
      }

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

  // ── User self-service routes ──────────────────────────────────────────
  router.patch(
    '/profile',
    auth,
    validateBody(profilePatchSchema),
    async (req, res, next) => {
      try {
        const user = await service.updateProfile(req.auth!.sub, req.body);
        res.json({ user });
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/password',
    auth,
    validateBody(passwordChangeSchema),
    async (req, res, next) => {
      try {
        const session = await service.changePassword(
          req.auth!.sub,
          req.body.currentPassword,
          req.body.newPassword,
        );
        res.json(session);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete('/account', auth, async (req, res, next) => {
    try {
      await service.deleteAccount(req.auth!.sub);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── OAuth routes ───────────────────────────────────────────────────────
  router.use('/oauth', createOAuthRoutes(ctx));

  // ── 2FA routes ────────────────────────────────────────────────────────
  router.use('/2fa', createTwoFactorRoutes(ctx));

  return router;
}
