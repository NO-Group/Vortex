import type { Knex } from 'knex';
import { createHash } from 'node:crypto';

/**
 * IdempotencyService — Idempotent API requests.
 * Stores request fingerprints (method + path + body hash) and returns
 * the original response when a duplicate is detected.
 */
export class IdempotencyService {
  constructor(private readonly db: Knex) {}

  async check(
    apiKeyId: string,
    method: string,
    path: string,
    bodyHash: string,
  ): Promise<{ idemKey: string; duplicate: boolean; previous?: Record<string, unknown> }> {
    const idemKey = createHash('sha256').update(`${apiKeyId}:${method}:${path}:${bodyHash}`).digest('hex');

    const existing = await this.db('idempotency_keys').where({ idempotency_key: idemKey }).first();

    if (existing) {
      return { idemKey, duplicate: true, previous: existing.response };
    }

    return { idemKey, duplicate: false };
  }

  async record(
    apiKeyId: string,
    method: string,
    path: string,
    bodyHash: string,
    response: Record<string, unknown>,
    statusCode: number,
  ): Promise<void> {
    const idemKey = createHash('sha256').update(`${apiKeyId}:${method}:${path}:${bodyHash}`).digest('hex');

    await this.db('idempotency_keys').insert({
      idempotency_key: idemKey,
      api_key_id: apiKeyId,
      method,
      path,
      request_hash: bodyHash,
      response,
      status_code: statusCode,
      status: 'completed',
    });
  }

  async hashBody(body: unknown): Promise<string> {
    return createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  }

  async listForKey(apiKeyId: string, limit = 50) {
    return this.db('idempotency_keys')
      .where({ api_key_id: apiKeyId })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }
}
