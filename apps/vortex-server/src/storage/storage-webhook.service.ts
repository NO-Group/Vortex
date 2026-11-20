import { createHmac } from 'node:crypto';
import { ApiError } from '../errors.js';

export interface WebhookEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  success: boolean;
  attempts: number;
  error?: string;
}

const MAX_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

/**
 * Event-Driven Webhooks for storage mutations.
 *
 * Every storage mutation (upload.completed, file.deleted, transform.rendered)
 * dispatches an event to the Vortex Webhook Queue.
 * Payloads are cryptographically signed using HMAC-SHA256 (X-Vortex-Signature)
 * and include retry logic (exponential backoff up to 5 attempts).
 */
export class StorageWebhookDispatcher {
  constructor(private readonly secret: string) {}

  /**
   * Sign a webhook payload with HMAC-SHA256.
   */
  sign(payload: string, timestamp: string): string {
    const signedPayload = `${timestamp}.${payload}`;
    return createHmac('sha256', this.secret).update(signedPayload).digest('hex');
  }

  /**
   * Dispatch a webhook event to a target URL with retry logic.
   * Uses exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts).
   */
  async dispatch(
    url: string,
    event: WebhookEvent,
    signingSecret: string,
  ): Promise<WebhookDeliveryResult> {
    const body = JSON.stringify({
      event: event.event,
      data: event.data,
      timestamp: new Date().toISOString(),
    });
    const timestamp = Date.now().toString();
    const signature = createHmac('sha256', signingSecret).update(`${timestamp}.${body}`).digest('hex');

    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-vortex-signature': signature,
            'x-vortex-timestamp': timestamp,
            'x-vortex-event': event.event,
          },
          body,
        });

        if (res.ok) {
          return { success: true, attempts: attempt };
        }

        lastError = `HTTP ${res.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
      }

      // Exponential backoff before next attempt (except on last attempt)
      if (attempt < MAX_ATTEMPTS) {
        const backoff = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    }

    return { success: false, attempts: MAX_ATTEMPTS, error: lastError };
  }

  /**
   * Dispatch storage mutation events to all registered webhooks.
   * This is called by the storage service on upload/delete/transform.
   */
  async dispatchToWebhooks(
    webhooks: Array<{ url: string; secret: string; events: string[] }>,
    event: WebhookEvent,
  ): Promise<void> {
    const eventType = event.event.split('.')[0];

    const matching = webhooks.filter((w) =>
      w.events.some((e) => e === event.event || e === eventType || e === '*'),
    );

    await Promise.allSettled(
      matching.map((w) => this.dispatch(w.url, event, w.secret)),
    );
  }
}
