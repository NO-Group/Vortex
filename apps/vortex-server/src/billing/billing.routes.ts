import { Router, raw } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.js';
import { ApiError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { BillingService, type BillingServiceOptions } from './billing.service.js';
import type { TokenConfig } from '../auth/tokens.js';

const checkoutSchema = z.object({
  planName: z.string().min(1).max(100),
  email: z.string().email(),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

const cancelSchema = z.object({});

const createPlanSchema = z.object({
  name: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/, 'Plan name must be lowercase letters, digits, dashes, underscores'),
  displayName: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(0).max(1_000_000_00),
  currency: z.string().min(3).max(3).default('ngn'),
  interval: z.enum(['month', 'year', 'one_time']).default('month'),
  intervalCount: z.number().int().min(1).max(12).default(1),
  features: z.record(z.unknown()).optional(),
});

const updatePlanSchema = z.object({
  displayName: z.string().min(1).max(64).optional(),
  description: z.string().max(500).optional(),
  priceCents: z.number().int().min(0).max(1_000_000_00).optional(),
  currency: z.string().min(3).max(3).optional(),
  interval: z.enum(['month', 'year', 'one_time']).optional(),
  intervalCount: z.number().int().min(1).max(12).optional(),
  features: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

/**
 * `/v1/billing` — native payments & subscription sync.
 *
 * Developers configure a gateway (Paystack/Flutterwave/Stripe) and get
 * checkout, webhook verification, plan management, and automatic user
 * plan/credits sync in one SDK call.
 */
export function createBillingRoutes(ctx: AppContext): Router {
  const router = Router();
  const auth = requireAuth(ctx.env.jwt as TokenConfig);

  const billingOpts: BillingServiceOptions = {
    gateway: ctx.env.billing.gateway,
    paystackSecretKey: ctx.env.billing.paystackSecretKey,
    flutterwaveSecretKey: ctx.env.billing.flutterwaveSecretKey,
    stripeSecretKey: ctx.env.billing.stripeSecretKey,
    stripeWebhookSecret: ctx.env.billing.stripeWebhookSecret,
    defaultCurrency: ctx.env.billing.defaultCurrency,
  };
  const service = new BillingService(ctx.db, billingOpts);

  const SUPER_ADMIN_EMAIL = process.env.VORTEX_SUPER_ADMIN?.trim().toLowerCase();

  function requireAdmin(role: string | undefined, email?: string): void {
    if (email?.toLowerCase() === SUPER_ADMIN_EMAIL) return;
    if (role !== 'admin') throw ApiError.forbidden('Admin access required');
  }

  // ── Plans ─────────────────────────────────────────────────────────────

  /** GET /v1/billing/plans — list active plans. */
  router.get('/plans', auth, async (req, res, next) => {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const isAdmin = req.auth!.role === 'admin';
      if (includeInactive && !isAdmin) {
        throw ApiError.forbidden('Only admins can see inactive plans');
      }
      const plans = await service.listPlans(includeInactive);
      res.json({ plans });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/billing/plans/:name — get a single plan. */
  router.get('/plans/:name', auth, async (req, res, next) => {
    try {
      const plan = await service.getPlan(req.params.name!);
      if (!plan) throw ApiError.notFound(`Plan "${req.params.name}" not found`);
      res.json({ plan });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/billing/plans — create a plan (admin). */
  router.post('/plans', auth, validateBody(createPlanSchema), async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role, req.auth!.email);
      const plan = await service.createPlan(req.body);
      res.status(201).json({ plan });
    } catch (err) {
      next(err);
    }
  });

  /** PATCH /v1/billing/plans/:name — update a plan (admin). */
  router.patch('/plans/:name', auth, validateBody(updatePlanSchema), async (req, res, next) => {
    try {
      requireAdmin(req.auth!.role, req.auth!.email);
      const plan = await service.updatePlan(req.params.name!, req.body);
      res.json({ plan });
    } catch (err) {
      next(err);
    }
  });

  // ── Checkout ─────────────────────────────────────────────────────────

  /** POST /v1/billing/checkout — create a checkout for a plan. */
  router.post('/checkout', auth, validateBody(checkoutSchema), async (req, res, next) => {
    try {
      const user = await ctx.db('users').where({ id: req.auth!.sub }).first();
      if (!user) throw ApiError.notFound('User not found');

      const result = await service.checkout(req.auth!.sub, {
        planName: req.body.planName,
        email: user.email,
        successUrl: req.body.successUrl,
        cancelUrl: req.body.cancelUrl,
      });

      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  // ── Webhooks (public — signature verified by service) ────────────────

  /**
   * POST /v1/billing/webhooks/:gateway — receive payment gateway webhooks.
   *
   * This endpoint is public (no auth) but the gateway signature is verified
   * before any processing. Raw body is required for signature verification.
   */
  router.post(
    '/webhooks/:gateway',
    raw({ type: () => true, limit: '2mb' }),
    async (req, res, next) => {
      try {
        const gateway = req.params.gateway!;
        const payload = req.body;

        if (typeof payload !== 'string') {
          throw ApiError.badRequest('Expected raw body for webhook verification');
        }

        // Collect headers
        const headers: Record<string, string | undefined> = {};
        const allHeaders = req.headers as Record<string, string | string[] | undefined>;
        for (const [key, value] of Object.entries(allHeaders)) {
          if (typeof value === 'string') {
            headers[key.toLowerCase()] = value;
          } else if (Array.isArray(value)) {
            headers[key.toLowerCase()] = value[0];
          }
        }

        const result = await service.handleWebhook(gateway, payload, headers);

        if (result.processed) {
          res.status(200).json({ received: true, processed: true, event: result.event });
        } else {
          res.status(200).json({ received: true, processed: false, event: result.event });
        }
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Transactions ─────────────────────────────────────────────────────

  /** GET /v1/billing/transactions — list user's transactions. */
  router.get('/transactions', auth, async (req, res, next) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const transactions = await service.listTransactions(req.auth!.sub, limit);
      res.json({ transactions });
    } catch (err) {
      next(err);
    }
  });

  /** GET /v1/billing/transactions/:id — get a single transaction. */
  router.get('/transactions/:id', auth, async (req, res, next) => {
    try {
      const transaction = await service.getTransaction(req.auth!.sub, req.params.id!);
      if (!transaction) throw ApiError.notFound('Transaction not found');
      res.json({ transaction });
    } catch (err) {
      next(err);
    }
  });

  // ── Subscription ────────────────────────────────────────────────────

  /** GET /v1/billing/subscription — get current subscription. */
  router.get('/subscription', auth, async (req, res, next) => {
    try {
      const subscription = await service.getSubscription(req.auth!.sub);
      res.json({ subscription });
    } catch (err) {
      next(err);
    }
  });

  /** POST /v1/billing/subscription/cancel — cancel subscription. */
  router.post('/subscription/cancel', auth, validateBody(cancelSchema), async (req, res, next) => {
    try {
      const subscription = await service.cancelSubscription(req.auth!.sub);
      res.json({ subscription });
    } catch (err) {
      next(err);
    }
  });

  // ── User Billing Info ────────────────────────────────────────────────

  /** GET /v1/billing/me — get current plan, credits, and subscription status. */
  router.get('/me', auth, async (req, res, next) => {
    try {
      const billing = await service.getUserBilling(req.auth!.sub);
      const subscription = await service.getSubscription(req.auth!.sub);
      res.json({ ...billing, subscription });
    } catch (err) {
      next(err);
    }
  });

  // ── Gateway Status ──────────────────────────────────────────────────

  /** GET /v1/billing/status — check if billing is configured and which gateway. */
  router.get('/status', async (_req, res, next) => {
    try {
      res.json({
        enabled: service.isEnabled(),
        gateway: service.getGateway(),
        defaultCurrency: billingOpts.defaultCurrency,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
