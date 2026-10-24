import type { Knex } from 'knex';
import { createHmac } from 'node:crypto';
import { ApiError } from '../errors.js';
import { randomUUID } from 'node:crypto';

interface WebhookRow {
  id: string;
  user_id: string;
  url: string;
  events: string;
  secret: string;
  active: boolean;
  success_count: number;
  failure_count: number;
  last_delivered_at: Date | string | null;
  created_at: Date | string;
}

interface WebhookLogRow {
  id: string;
  webhook_id: string;
  event: string;
  payload: Record<string, unknown> | null;
  status: string;
  http_status: number | null;
  error: string | null;
  created_at: Date | string;
}

export interface WebhookServiceOptions {
  /** Base URL for the webhook delivery (used in event payloads). */
  publicAppUrl?: string;
}

export class WebhookService {
  constructor(
    private readonly db: Knex,
    private readonly options: WebhookServiceOptions = {},
  ) {}

  /** Create a new webhook endpoint. */
  async createWebhook(
    userId: string,
    input: { url: string; events: string[] },
  ): Promise<WebhookRow> {
    const secret = randomUUID();
    const [row] = await this.db<WebhookRow>('vortex_webhooks')
      .insert({
        user_id: userId,
        url: input.url,
        events: input.events.join(','),
        secret,
        active: true,
      })
      .returning('*');
    if (!row) throw ApiError.notFound('Webhook creation failed');
    return row;
  }

  /** List webhooks for a user. */
  async listWebhooks(userId: string): Promise<WebhookRow[]> {
    return this.db<WebhookRow>('vortex_webhooks')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc');
  }

  /** Update a webhook (url, events, active status). */
  async updateWebhook(
    webhookId: string,
    patch: { url?: string; events?: string[]; active?: boolean },
  ): Promise<WebhookRow> {
    const updates: Record<string, unknown> = {};
    if (patch.url !== undefined) updates.url = patch.url;
    if (patch.events !== undefined) updates.events = patch.events.join(',');
    if (patch.active !== undefined) updates.active = patch.active;
    if (!Object.keys(updates).length) {
      throw ApiError.badRequest('Nothing to update');
    }
    const [row] = await this.db<WebhookRow>('vortex_webhooks')
      .where({ id: webhookId })
      .update(updates)
      .returning('*');
    if (!row) throw ApiError.notFound('Webhook not found');
    return row;
  }

  /** Delete a webhook. */
  async deleteWebhook(webhookId: string): Promise<void> {
    const deleted = await this.db('vortex_webhooks').where({ id: webhookId }).del();
    if (!deleted) throw ApiError.notFound('Webhook not found');
  }

  /** Regenerate the signing secret for a webhook. */
  async regenerateSecret(webhookId: string): Promise<{ secret: string }> {
    const secret = randomUUID();
    await this.db('vortex_webhooks').where({ id: webhookId }).update({ secret });
    return { secret };
  }

  /** List delivery log entries for a webhook. */
  async listLog(webhookId: string, limit = 50): Promise<WebhookLogRow[]> {
    return this.db<WebhookLogRow>('vortex_webhook_log')
      .where({ webhook_id: webhookId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /** Deliver an event to all matching webhooks. */
  async deliver(
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const eventType = event.split('.')[0]; // e.g. 'database' from 'database.insert'
    const webhooks = await this.db<WebhookRow>('vortex_webhooks')
      .where({ active: true })
      .select('*');

    for (const webhook of webhooks) {
      const subscribed = webhook.events.split(',').some((e) => {
        return e === event || e === eventType || e === '*';
      });
      if (!subscribed) continue;

      await this.deliverToWebhook(webhook, event, payload);
    }
  }

  /** Deliver a single event to a single webhook with HMAC signature. */
  private async deliverToWebhook(
    webhook: WebhookRow,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify({
      event,
      data: payload,
      timestamp: new Date().toISOString(),
    });
    const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vortex-signature': signature,
          'x-vortex-event': event,
        },
        body,
      });

      const success = res.ok;
      await this.db('vortex_webhook_log').insert({
        webhook_id: webhook.id,
        event,
        payload,
        status: success ? 'delivered' : 'failed',
        http_status: res.status,
        error: success ? null : `HTTP ${res.status}`,
      });
      await this.db('vortex_webhooks')
        .where({ id: webhook.id })
        .increment(success ? 'success_count' : 'failure_count', 1)
        .update({ last_delivered_at: new Date() });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.db('vortex_webhook_log').insert({
        webhook_id: webhook.id,
        event,
        payload,
        status: 'failed',
        http_status: null,
        error: message,
      });
      await this.db('vortex_webhooks')
        .where({ id: webhook.id })
        .increment('failure_count', 1);
    }
  }
}
