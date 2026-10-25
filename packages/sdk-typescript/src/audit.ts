import type { HttpClient } from './http.js';
import type { AuditEntry, AuditStats } from './types.js';

/** Audit trail API — `/v1/audit`. */
export class Audit {
  private readonly _client: HttpClient;

  constructor(client: HttpClient) {
    this._client = client;
  }

  /** List audit log entries. */
  async list(opts?: { action?: string; limit?: number; offset?: number }): Promise<AuditEntry[]> {
    const params = new URLSearchParams();
    if (opts?.action) params.set('action', opts.action);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    const query = params.toString();
    const path = `/v1/audit/log${query ? `?${query}` : ''}`;
    const res = await this._client.request<{ entries: AuditEntry[] }>(path, { method: 'GET' });
    return res.entries;
  }

  /** Get audit statistics for the authenticated user (or a target user if admin). */
  async stats(opts?: { userId?: string }): Promise<AuditStats> {
    const params = new URLSearchParams();
    if (opts?.userId) params.set('userId', opts.userId);
    const query = params.toString();
    const path = `/v1/audit/stats${query ? `?${query}` : ''}`;
    return this._client.request<AuditStats>(path, { method: 'GET' });
  }
}
