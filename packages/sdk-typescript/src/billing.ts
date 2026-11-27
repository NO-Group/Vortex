import { HttpClient } from './http.js';
import type {
  BillingPlan,
  BillingTransaction,
  BillingSubscription,
  BillingCheckoutResult,
  BillingStatus,
  UserBilling,
  CreatePlanInput,
  UpdatePlanInput,
  CheckoutInput,
} from './types.js';

/**
 * Billing — plans, checkout, transactions, and subscriptions.
 *
 * ```ts
 * const plans = await vortex.billing.listPlans();
 * const checkout = await vortex.billing.checkout({ planName: 'pro', email });
 * const me = await vortex.billing.getMe();
 * ```
 */
export class Billing {
  constructor(private readonly http: HttpClient) {}

  /** Check if billing is configured and which gateway is active. */
  async status(): Promise<BillingStatus> {
    return this.http.request<BillingStatus>('/v1/billing/status');
  }

  /** List all active plans. */
  async listPlans(): Promise<BillingPlan[]> {
    const { plans } = await this.http.request<{ plans: BillingPlan[] }>(
      '/v1/billing/plans',
    );
    return plans;
  }

  /** Get a single plan by name. */
  async getPlan(name: string): Promise<BillingPlan> {
    return this.http.request<BillingPlan>(`/v1/billing/plans/${name}`);
  }

  /** Create a new plan (admin only). */
  async createPlan(input: CreatePlanInput): Promise<BillingPlan> {
    return this.http.request<BillingPlan>('/v1/billing/plans', {
      method: 'POST',
      body: input,
    });
  }

  /** Update an existing plan (admin only). */
  async updatePlan(name: string, input: UpdatePlanInput): Promise<BillingPlan> {
    return this.http.request<BillingPlan>(`/v1/billing/plans/${name}`, {
      method: 'PATCH',
      body: input,
    });
  }

  /** Create a checkout for a plan — returns redirect URL and reference. */
  async checkout(input: CheckoutInput): Promise<BillingCheckoutResult> {
    return this.http.request<BillingCheckoutResult>('/v1/billing/checkout', {
      method: 'POST',
      body: input,
    });
  }

  /** List the current user's transactions. */
  async listTransactions(limit = 50): Promise<BillingTransaction[]> {
    const { transactions } = await this.http.request<{
      transactions: BillingTransaction[];
    }>(`/v1/billing/transactions?limit=${limit}`);
    return transactions;
  }

  /** Get a single transaction by ID. */
  async getTransaction(transactionId: string): Promise<BillingTransaction> {
    return this.http.request<BillingTransaction>(
      `/v1/billing/transactions/${transactionId}`,
    );
  }

  /** Get the current user's subscription. */
  async getSubscription(): Promise<BillingSubscription | null> {
    return this.http.request<BillingSubscription | null>('/v1/billing/subscription');
  }

  /** Cancel the current user's subscription (at end of period). */
  async cancelSubscription(): Promise<BillingSubscription> {
    return this.http.request<BillingSubscription>('/v1/billing/subscription/cancel', {
      method: 'POST',
    });
  }

  /** Get the current user's plan, credits, and subscription summary. */
  async getMe(): Promise<UserBilling> {
    return this.http.request<UserBilling>('/v1/billing/me');
  }
}
