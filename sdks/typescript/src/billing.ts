import { HttpClient } from './http.js';

export class Billing {
  constructor(private readonly http: HttpClient) {}

  async status(): Promise<{ enabled: boolean; gateway: string | null; defaultCurrency: string }> {
    return this.http.request('/v1/billing/status');
  }

  async listPlans(): Promise<{ plans: unknown[] }> {
    return this.http.request('/v1/billing/plans');
  }

  async getPlan(name: string): Promise<unknown> {
    return this.http.request(`/v1/billing/plans/${name}`);
  }

  async checkout(input: { planName: string; email: string; successUrl?: string; cancelUrl?: string }): Promise<{
    transactionId: string; reference: string; gateway: string; amountCents: number; currency: string; redirectUrl: string;
  }> {
    return this.http.request('/v1/billing/checkout', { method: 'POST', body: input });
  }

  async listTransactions(limit = 50): Promise<{ transactions: unknown[] }> {
    return this.http.request(`/v1/billing/transactions?limit=${limit}`);
  }

  async getSubscription(): Promise<unknown> {
    return this.http.request('/v1/billing/subscription');
  }

  async cancelSubscription(): Promise<unknown> {
    return this.http.request('/v1/billing/subscription/cancel', { method: 'POST' });
  }

  async getMe(): Promise<{ plan: string | null; credits: number; planExpiresAt: string | null; hasActiveSubscription: boolean }> {
    return this.http.request('/v1/billing/me');
  }
}
