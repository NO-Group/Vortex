import type { Knex } from 'knex';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { ApiError } from '../errors.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type GatewayName = 'paystack' | 'flutterwave' | 'stripe';

export interface BillingPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  features: Record<string, unknown> | null;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface BillingTransaction {
  id: string;
  user_id: string;
  gateway: string;
  gateway_transaction_id: string | null;
  plan_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  reference: string;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  completed_at: string | null;
  created_at: string;
}

export interface BillingSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  gateway: string;
  gateway_subscription_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: string | null;
  last_renewal_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  cancelled_at: string | null;
}

interface PlanRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  interval_count: number;
  features: Record<string, unknown> | null;
  is_active: boolean;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

interface TransactionRow {
  id: string;
  user_id: string;
  gateway: string;
  gateway_transaction_id: string | null;
  plan_id: string | null;
  amount_cents: number;
  currency: string;
  status: string;
  reference: string;
  failure_reason: string | null;
  metadata: Record<string, unknown> | null;
  completed_at: Date | null;
  created_at: Date;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  gateway: string;
  gateway_subscription_id: string | null;
  status: string;
  current_period_start: Date | null;
  current_period_end: Date | null;
  cancel_at_period_end: Date | null;
  last_renewal_transaction_id: string | null;
  created_at: Date;
  updated_at: Date;
  cancelled_at: Date | null;
}

interface UserBillingRow {
  id: string;
  plan: string | null;
  credits: number;
  plan_expires_at: Date | null;
  active_subscription_id: string | null;
}

// ── Gateway Adapters ──────────────────────────────────────────────────────

interface GatewayAdapter {
  name: GatewayName;
  /** Create a transaction/checkout on the gateway. Returns the gateway's redirect URL or transaction ID. */
  createTransaction(opts: {
    amountCents: number;
    currency: string;
    reference: string;
    email: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ gatewayTransactionId: string; redirectUrl?: string }>;
  /** Verify the webhook signature. */
  verifyWebhook(payload: string, headers: Record<string, string | undefined>): boolean;
  /** Parse the webhook payload into a normalized event. */
  parseWebhookEvent(payload: Record<string, unknown>): {
    event: string;
    transactionId: string | null;
    status: string;
    amountCents: number | null;
    planName?: string | null;
    subscriptionId?: string | null;
  } | null;
}

// ── Paystack Adapter ─────────────────────────────────────────────────────

function createPaystackAdapter(secretKey: string): GatewayAdapter {
  return {
    name: 'paystack',

    async createTransaction(opts) {
      const body = JSON.stringify({
        amount: opts.amountCents,
        currency: opts.currency,
        reference: opts.reference,
        email: opts.email,
        metadata: opts.metadata ?? {},
      });

      const res = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${secretKey}`,
        },
        body,
      });

      const data = await res.json() as {
        status: boolean;
        data?: { reference?: string; access_code?: string; redirect_url?: string };
        message?: string;
      };

      if (!data.status || !data.data?.reference) {
        throw ApiError.badRequest(`Paystack transaction failed: ${data.message ?? 'unknown error'}`);
      }

      return {
        gatewayTransactionId: data.data.reference ?? opts.reference,
        redirectUrl: data.data.redirect_url,
      };
    },

    verifyWebhook(payload, headers) {
      const signature = headers['x-paystack-signature'];
      if (!signature) return false;
      const expected = createHmac('sha256', secretKey).update(payload).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    },

    parseWebhookEvent(payload) {
      const event = String(payload.event ?? payload.type ?? '');
      const data = (payload.data ?? payload) as Record<string, unknown>;
      const reference = String(data.reference ?? data.id ?? '');
      const status = String(data.status ?? '').toLowerCase();
      const amount = typeof data.amount === 'number' ? Math.round(data.amount) : null;
      const planName = data.plan ? String(data.plan) : null;

      return {
        event,
        transactionId: reference || null,
        status: status || 'unknown',
        amountCents: amount,
        planName,
        subscriptionId: null,
      };
    },
  };
}

// ── Flutterwave Adapter ───────────────────────────────────────────────────

function createFlutterwaveAdapter(secretKey: string): GatewayAdapter {
  return {
    name: 'flutterwave',

    async createTransaction(opts) {
      const body = JSON.stringify({
        tx_ref: opts.reference,
        amount: opts.amountCents,
        currency: opts.currency,
        redirect_url: undefined,
        customer: { email: opts.email },
        metadata: opts.metadata ?? {},
      });

      const res = await fetch('https://api.flutterwave.com/v3/transactions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': `Bearer ${secretKey}`,
        },
        body,
      });

      const data = await res.json() as {
        status?: string;
        data?: { tx_ref?: string; link?: string; id?: number };
        message?: string;
      };

      if (data.status !== 'success' || !data.data?.tx_ref) {
        throw ApiError.badRequest(`Flutterwave transaction failed: ${data.message ?? 'unknown error'}`);
      }

      return {
        gatewayTransactionId: data.data.tx_ref ?? opts.reference,
        redirectUrl: data.data.link,
      };
    },

    verifyWebhook(payload, headers) {
      const signature = headers['x-flw-signature'];
      if (!signature) return false;
      const expected = createHmac('sha512', secretKey).update(payload).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const expBuf = Buffer.from(expected, 'hex');
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    },

    parseWebhookEvent(payload) {
      const event = String(payload.event ?? payload.type ?? '');
      const data = (payload.data ?? payload) as Record<string, unknown>;
      const reference = String(data.tx_ref ?? data.reference ?? data.id ?? '');
      const status = String(data.status ?? '').toLowerCase();
      const amount = typeof data.amount === 'number' ? Math.round(data.amount) : null;

      return {
        event,
        transactionId: reference || null,
        status: status || 'unknown',
        amountCents: amount,
        planName: null,
        subscriptionId: null,
      };
    },
  };
}

// ── Stripe Adapter ────────────────────────────────────────────────────────

function createStripeAdapter(secretKey: string): GatewayAdapter {
  return {
    name: 'stripe',

    async createTransaction(opts) {
      const body = JSON.stringify({
        amount: opts.amountCents,
        currency: opts.currency,
        reference: opts.reference,
        email: opts.email,
        metadata: opts.metadata ?? {},
      });

      const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          authorization: `Bearer ${secretKey}`,
        },
        body: new URLSearchParams({
          mode: 'payment',
          success_url: `${opts.metadata?.successUrl as string ?? 'https://example.com'}`,
          cancel_url: `${opts.metadata?.cancelUrl as string ?? 'https://example.com'}`,
          line_items: JSON.stringify([{
            price_data: {
              currency: opts.currency,
              unit_amount: opts.amountCents,
              product_data: { name: String(opts.metadata?.planName ?? 'Vortex Plan') },
            },
            quantity: 1,
          }]),
          customer_email: opts.email,
          metadata: JSON.stringify(opts.metadata ?? {}),
        }).toString(),
      });

      const data = await res.json() as {
        id?: string;
        url?: string;
        error?: { message?: string };
      };

      if (data.error) {
        throw ApiError.badRequest(`Stripe transaction failed: ${data.error.message ?? 'unknown error'}`);
      }

      return {
        gatewayTransactionId: data.id ?? opts.reference,
        redirectUrl: data.url,
      };
    },

    verifyWebhook(payload, headers) {
      // Stripe uses a signing secret in the payload header.
      // For simplicity, we check the stripe-signature header pattern.
      const signature = headers['stripe-signature'];
      if (!signature) return false;
      // Full Stripe signature verification requires parsing the timestamped
      // signature header. We verify the HMAC of the raw payload with the
      // signing secret as a fallback for the standard case.
      const parts = signature.split(',');
      const tsPart = parts.find((p) => p.startsWith('t='));
      const sigPart = parts.find((p) => p.startsWith('v1='));
      if (!tsPart || !sigPart) return false;
      const timestamp = tsPart.split('=')[1]!;
      const expectedSig = createHmac('sha256', secretKey)
        .update(`${timestamp}.${payload}`)
        .digest('hex');
      const sigBuf = Buffer.from(sigPart.split('=')[1]!, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');
      if (sigBuf.length !== expBuf.length) return false;
      return timingSafeEqual(sigBuf, expBuf);
    },

    parseWebhookEvent(payload) {
      const event = String(payload.type ?? '');
      const dataObj = (payload.data as Record<string, unknown> | undefined)?.object;
      const data = (dataObj ?? payload) as Record<string, unknown>;
      const reference = String(data.id ?? data.reference ?? '');
      let status = 'unknown';
      if (event === 'checkout.session.completed') status = 'success';
      else if (event === 'checkout.session.expired') status = 'failed';
      else if (event === 'payment_intent.payment_failed') status = 'failed';
      else if (event === 'invoice.payment_succeeded') status = 'success';

      const amount = typeof data.amount_total === 'number'
        ? data.amount_total
        : typeof data.amount === 'number' ? Math.round(data.amount) : null;
      const metadata = data.metadata as Record<string, unknown> | undefined;
      const planName = metadata?.planName ? String(metadata.planName) : null;

      return {
        event,
        transactionId: reference || null,
        status,
        amountCents: amount,
        planName,
        subscriptionId: data.subscription ? String(data.subscription) : null,
      };
    },
  };
}

// ── Billing Service ──────────────────────────────────────────────────────

export interface BillingServiceOptions {
  gateway: GatewayName | null;
  paystackSecretKey?: string;
  flutterwaveSecretKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  defaultCurrency: string;
}

export class BillingService {
  private readonly adapter: GatewayAdapter | null;
  private readonly defaultCurrency: string;

  constructor(
    private readonly db: Knex,
    opts: BillingServiceOptions,
  ) {
    this.defaultCurrency = opts.defaultCurrency || 'ngn';

    if (opts.gateway === 'paystack' && opts.paystackSecretKey) {
      this.adapter = createPaystackAdapter(opts.paystackSecretKey);
    } else if (opts.gateway === 'flutterwave' && opts.flutterwaveSecretKey) {
      this.adapter = createFlutterwaveAdapter(opts.flutterwaveSecretKey);
    } else if (opts.gateway === 'stripe' && opts.stripeSecretKey) {
      this.adapter = createStripeAdapter(opts.stripeSecretKey);
    } else {
      this.adapter = null;
    }
  }

  /** Check if billing is available (gateway configured). */
  isEnabled(): boolean {
    return this.adapter !== null;
  }

  /** Get the configured gateway name. */
  getGateway(): GatewayName | null {
    return this.adapter?.name ?? null;
  }

  // ── Plans ─────────────────────────────────────────────────────────────

  /** List all active plans. */
  async listPlans(includeInactive = false): Promise<BillingPlan[]> {
    const query = this.db<PlanRow>('billing_plans').orderBy('price_cents', 'asc');
    if (!includeInactive) query.where('is_active', true);
    const rows = await query;
    return rows.map(toBillingPlan);
  }

  /** Get a plan by name. */
  async getPlan(name: string): Promise<BillingPlan | null> {
    const row = await this.db<PlanRow>('billing_plans')
      .where({ name, is_active: true })
      .first();
    return row ? toBillingPlan(row) : null;
  }

  // ── Checkout ─────────────────────────────────────────────────────────

  /**
   * Create a checkout for a plan. Creates a transaction record, calls the
   * gateway to initialize the payment, and returns the redirect URL or
   * gateway reference for the client.
   */
  async checkout(
    userId: string,
    input: { planName: string; email: string; successUrl?: string; cancelUrl?: string },
  ): Promise<{
    transactionId: string;
    reference: string;
    gateway: GatewayName;
    amountCents: number;
    currency: string;
    redirectUrl: string | null;
  }> {
    if (!this.adapter) {
      throw ApiError.badRequest('Billing is not configured. Set BILLING_GATEWAY and the gateway secret key.');
    }

    const plan = await this.getPlan(input.planName);
    if (!plan) {
      throw ApiError.notFound(`Plan "${input.planName}" not found`);
    }

    const reference = `vtx_${randomUUID().replace(/-/g, '')}`;
    const metadata: Record<string, unknown> = {
      planName: plan.name,
      planDisplayName: plan.display_name,
      userId,
    };
    if (input.successUrl) metadata.successUrl = input.successUrl;
    if (input.cancelUrl) metadata.cancelUrl = input.cancelUrl;

    // Create the transaction record first.
    const [txRow] = await this.db<TransactionRow>('billing_transactions')
      .insert({
        user_id: userId,
        gateway: this.adapter.name,
        plan_id: plan.id,
        amount_cents: plan.price_cents,
        currency: plan.currency || this.defaultCurrency,
        status: 'pending',
        reference,
        metadata,
      })
      .returning('*');

    if (!txRow) throw ApiError.badRequest('Failed to create transaction record');

    // Call the gateway to initialize the payment.
    const gatewayResult = await this.adapter.createTransaction({
      amountCents: plan.price_cents,
      currency: plan.currency || this.defaultCurrency,
      reference,
      email: input.email,
      metadata,
    });

    // Update the transaction with the gateway transaction ID.
    await this.db('billing_transactions')
      .where({ id: txRow.id })
      .update({ gateway_transaction_id: gatewayResult.gatewayTransactionId });

    return {
      transactionId: txRow.id,
      reference,
      gateway: this.adapter.name,
      amountCents: plan.price_cents,
      currency: plan.currency || this.defaultCurrency,
      redirectUrl: gatewayResult.redirectUrl ?? null,
    };
  }

  // ── Webhooks ─────────────────────────────────────────────────────────

  /**
   * Verify and process an incoming webhook from a payment gateway.
   * Returns the normalized event result.
   */
  async handleWebhook(
    gateway: string,
    payload: string,
    headers: Record<string, string | undefined>,
  ): Promise<{ processed: boolean; event: string }> {
    if (!this.adapter) {
      throw ApiError.badRequest('Billing is not configured');
    }
    if (gateway !== this.adapter.name) {
      throw ApiError.badRequest(`Expected gateway "${this.adapter.name}", got "${gateway}"`);
    }

    // Verify signature
    if (!this.adapter.verifyWebhook(payload, headers)) {
      throw ApiError.unauthorized('Invalid webhook signature');
    }

    const parsed = JSON.parse(payload) as Record<string, unknown>;
    const event = this.adapter.parseWebhookEvent(parsed);
    if (!event) {
      throw ApiError.badRequest('Could not parse webhook event');
    }

    // Look up the transaction by reference.
    const txRow = await this.db<TransactionRow>('billing_transactions')
      .where({ reference: event.transactionId ?? '' })
      .orWhere({ gateway_transaction_id: event.transactionId ?? '' })
      .first();

    if (!txRow) {
      // Transaction not found — possibly a test event or duplicate.
      return { processed: false, event: event.event };
    }

    const isSuccess = event.status === 'success' || event.status === 'completed';
    const isFailure = event.status === 'failed' || event.status === 'cancelled' || event.status === 'expired';

    if (isSuccess && txRow.status !== 'success') {
      // Mark transaction successful and update user's plan.
      await this.db('billing_transactions')
        .where({ id: txRow.id })
        .update({
          status: 'success',
          completed_at: new Date(),
          gateway_transaction_id: event.transactionId ?? txRow.gateway_transaction_id,
        });

      // Update the user's plan and credits.
      const plan = await this.getPlan(
        (txRow.metadata?.planName as string) ?? '',
      );
      if (plan) {
        const periodEnd = new Date(Date.now() + plan.interval_count * 30 * 24 * 60 * 60 * 1000);

        // Determine the plan's credit grant from features.
        const features = plan.features as Record<string, unknown> | null;
        const credits = typeof features?.apiCalls === 'number'
          ? features.apiCalls
          : 0;

        await this.db('users')
          .where({ id: txRow.user_id })
          .update({
            plan: plan.name,
            credits,
            plan_expires_at: plan.interval === 'one_time' ? null : periodEnd,
          });

        // If there's an active subscription, update it.
        const existingSub = await this.db<SubscriptionRow>('billing_subscriptions')
          .where({ user_id: txRow.user_id, status: 'active' })
          .first();

        if (existingSub) {
          await this.db('billing_subscriptions')
            .where({ id: existingSub.id })
            .update({
              status: 'active',
              current_period_start: new Date(),
              current_period_end: plan.interval === 'one_time' ? null : periodEnd,
              last_renewal_transaction_id: txRow.id,
            });
        } else {
          // Create a new subscription record.
          await this.db('billing_subscriptions').insert({
            user_id: txRow.user_id,
            plan_id: plan.id,
            gateway: this.adapter.name,
            status: 'active',
            current_period_start: new Date(),
            current_period_end: plan.interval === 'one_time' ? null : periodEnd,
            last_renewal_transaction_id: txRow.id,
          });
        }
      }
    } else if (isFailure && txRow.status === 'pending') {
      await this.db('billing_transactions')
        .where({ id: txRow.id })
        .update({
          status: 'failed',
          failure_reason: event.status,
        });
    }

    return { processed: true, event: event.event };
  }

  // ── Transactions ─────────────────────────────────────────────────────

  /** List a user's transactions. */
  async listTransactions(userId: string, limit = 50): Promise<BillingTransaction[]> {
    const rows = await this.db<TransactionRow>('billing_transactions')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 200));
    return rows.map(toBillingTransaction);
  }

  /** Get a single transaction. */
  async getTransaction(userId: string, transactionId: string): Promise<BillingTransaction | null> {
    const row = await this.db<TransactionRow>('billing_transactions')
      .where({ id: transactionId, user_id: userId })
      .first();
    return row ? toBillingTransaction(row) : null;
  }

  // ── Subscriptions ────────────────────────────────────────────────────

  /** Get the user's active subscription. */
  async getSubscription(userId: string): Promise<BillingSubscription | null> {
    const row = await this.db<SubscriptionRow>('billing_subscriptions')
      .where({ user_id: userId, status: 'active' })
      .orderBy('created_at', 'desc')
      .first();
    return row ? toBillingSubscription(row) : null;
  }

  /** Cancel a user's subscription at the end of the current period. */
  async cancelSubscription(userId: string): Promise<BillingSubscription> {
    const sub = await this.getSubscription(userId);
    if (!sub) {
      throw ApiError.notFound('No active subscription found');
    }

    const [row] = await this.db<SubscriptionRow>('billing_subscriptions')
      .where({ id: sub.id })
      .update({
        status: 'cancel_at_period_end',
        cancel_at_period_end: sub.current_period_end ? new Date(sub.current_period_end) : new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    if (!row) throw ApiError.notFound('Subscription not found');
    return toBillingSubscription(row);
  }

  // ── User Billing Info ────────────────────────────────────────────────

  /** Get the user's current billing info (plan, credits, expiry). */
  async getUserBilling(userId: string): Promise<{
    plan: string | null;
    credits: number;
    planExpiresAt: string | null;
    hasActiveSubscription: boolean;
  }> {
    const row = await this.db<UserBillingRow>('users')
      .where({ id: userId })
      .select(['plan', 'credits', 'plan_expires_at', 'active_subscription_id'])
      .first();

    if (!row) throw ApiError.notFound('User not found');

    return {
      plan: row.plan,
      credits: row.credits ?? 0,
      planExpiresAt: row.plan_expires_at?.toISOString() ?? null,
      hasActiveSubscription: Boolean(row.active_subscription_id),
    };
  }

  // ── Admin: Plan Management ───────────────────────────────────────────

  /** Create a new plan (admin). */
  async createPlan(
    input: {
      name: string;
      displayName: string;
      description?: string;
      priceCents: number;
      currency: string;
      interval: string;
      intervalCount: number;
      features?: Record<string, unknown>;
    },
  ): Promise<BillingPlan> {
    const [row] = await this.db<PlanRow>('billing_plans')
      .insert({
        name: input.name,
        display_name: input.displayName,
        description: input.description ?? null,
        price_cents: input.priceCents,
        currency: input.currency,
        interval: input.interval,
        interval_count: input.intervalCount,
        features: input.features ?? null,
        is_active: true,
        is_public: true,
      })
      .returning('*');
    if (!row) throw ApiError.badRequest('Failed to create plan');
    return toBillingPlan(row);
  }

  /** Update a plan (admin). */
  async updatePlan(
    name: string,
    patch: {
      displayName?: string;
      description?: string;
      priceCents?: number;
      currency?: string;
      interval?: string;
      intervalCount?: number;
      features?: Record<string, unknown>;
      isActive?: boolean;
      isPublic?: boolean;
    },
  ): Promise<BillingPlan> {
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (patch.displayName !== undefined) updates.display_name = patch.displayName;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.priceCents !== undefined) updates.price_cents = patch.priceCents;
    if (patch.currency !== undefined) updates.currency = patch.currency;
    if (patch.interval !== undefined) updates.interval = patch.interval;
    if (patch.intervalCount !== undefined) updates.interval_count = patch.intervalCount;
    if (patch.features !== undefined) updates.features = patch.features;
    if (patch.isActive !== undefined) updates.is_active = patch.isActive;
    if (patch.isPublic !== undefined) updates.is_public = patch.isPublic;

    const [row] = await this.db<PlanRow>('billing_plans')
      .where({ name })
      .update(updates)
      .returning('*');
    if (!row) throw ApiError.notFound(`Plan "${name}" not found`);
    return toBillingPlan(row);
  }
}

// ── Row mappers ───────────────────────────────────────────────────────────

function toBillingPlan(row: PlanRow): BillingPlan {
  return {
    id: row.id,
    name: row.name,
    display_name: row.display_name,
    description: row.description,
    price_cents: row.price_cents,
    currency: row.currency,
    interval: row.interval,
    interval_count: row.interval_count,
    features: row.features,
    is_active: row.is_active,
    is_public: row.is_public,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function toBillingTransaction(row: TransactionRow): BillingTransaction {
  return {
    id: row.id,
    user_id: row.user_id,
    gateway: row.gateway,
    gateway_transaction_id: row.gateway_transaction_id,
    plan_id: row.plan_id,
    amount_cents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    reference: row.reference,
    failure_reason: row.failure_reason,
    metadata: row.metadata,
    completed_at: row.completed_at?.toISOString() ?? null,
    created_at: row.created_at.toISOString(),
  };
}

function toBillingSubscription(row: SubscriptionRow): BillingSubscription {
  return {
    id: row.id,
    user_id: row.user_id,
    plan_id: row.plan_id,
    gateway: row.gateway,
    gateway_subscription_id: row.gateway_subscription_id,
    status: row.status,
    current_period_start: row.current_period_start?.toISOString() ?? null,
    current_period_end: row.current_period_end?.toISOString() ?? null,
    cancel_at_period_end: row.cancel_at_period_end?.toISOString() ?? null,
    last_renewal_transaction_id: row.last_renewal_transaction_id,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
    cancelled_at: row.cancelled_at?.toISOString() ?? null,
  };
}
