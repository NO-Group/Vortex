import type { HttpClient } from './http.js';
import type { Webhook, WebhookLogEntry } from './types.js';

/**
 * Vortex Webhooks — deliver events to external services.
 *
 * Register a webhook endpoint and Vortex will POST events to it with an
 * HMAC-SHA256 signature. Verify the signature on your end using the
 * `verifySignature` helper.
 *
 * ```ts
 * const webhook = await vortex.webhooks.create({
 *   url: 'https://example.com/webhooks',
 *   events: ['database.insert', 'database.update', 'database.delete'],
 * });
 * // ... Vortex delivers events with x-vortex-signature header
 *
 * // On your server:
 * const isValid = Webhook.verifySignature(
 *   req.headers['x-vortex-signature'],
 *   rawBody,
 *   webhook.secret,
 * );
 * ```
 */
export class Webhooks {
  constructor(private readonly http: HttpClient) {}

  /** Register a new webhook endpoint. */
  async create(input: {
    url: string;
    events: string[];
  }): Promise<Webhook & { secret: string }> {
    const { webhook } = await this.http.request<{
      webhook: Webhook & { secret: string };
    }>('/v1/webhooks', {
      method: 'POST',
      body: input,
    });
    return webhook;
  }

  /** List your webhooks. */
  async list(): Promise<Webhook[]> {
    const { webhooks } = await this.http.request<{ webhooks: Webhook[] }>(
      '/v1/webhooks',
    );
    return webhooks;
  }

  /** Update a webhook (URL, events, or active status). */
  async update(
    webhookId: string,
    patch: { url?: string; events?: string[]; active?: boolean },
  ): Promise<Webhook> {
    const { webhook } = await this.http.request<{ webhook: Webhook }>(
      `/v1/webhooks/${webhookId}`,
      { method: 'PATCH', body: patch },
    );
    return webhook;
  }

  /** Delete a webhook. */
  async delete(webhookId: string): Promise<void> {
    await this.http.request(`/v1/webhooks/${webhookId}`, { method: 'DELETE' });
  }

  /** Regenerate the signing secret for a webhook. */
  async regenerateSecret(webhookId: string): Promise<{ secret: string }> {
    return this.http.request(`/v1/webhooks/${webhookId}/secret`, {
      method: 'POST',
    });
  }

  /** View delivery history for a webhook. */
  async log(webhookId: string, limit = 50): Promise<WebhookLogEntry[]> {
    const { log } = await this.http.request<{ log: WebhookLogEntry[] }>(
      `/v1/webhooks/${webhookId}/log?limit=${limit}`,
    );
    return log;
  }

  /**
   * Verify an incoming webhook's HMAC signature.
   *
   * Use this on your server to validate that a webhook request came
   * from Vortex.
   *
   * ```ts
   * const rawBody = Buffer.from(req.body).toString();
   * const signature = req.headers['x-vortex-signature'];
   * if (!Webhooks.verifySignature(signature, rawBody, secret)) {
   *   return res.status(401).json({ error: 'Invalid signature' });
   * }
   * ```
   */
  static verifySignature(
    signature: string | string[] | undefined,
    body: string,
    secret: string,
  ): boolean {
    if (!signature) return false;
    const sig = Array.isArray(signature) ? signature[0] : signature;
    const expected = Webhooks.computeSignature(body, secret);
    return sig === expected;
  }

  /** Compute the expected HMAC signature for a body and secret. */
  static computeSignature(body: string, secret: string): string {
    const crypto = require('node:crypto');
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }
}
