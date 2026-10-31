import type { HttpClient } from './http.js';
import type { UserSession } from './types.js';

/**
 * Session management client — `/v1/auth/sessions`.
 */
export class Sessions {
  constructor(private readonly http: HttpClient) {}

  /** List active sessions for the authenticated user. */
  async list(): Promise<{ sessions: UserSession[] }> {
    return this.http.request<{ sessions: UserSession[] }>('/v1/auth/sessions');
  }

  /** Revoke a single session. */
  async revoke(sessionId: string): Promise<void> {
    await this.http.request('/v1/auth/sessions/revoke', {
      method: 'POST',
      body: { sessionId },
    });
  }

  /** Revoke all sessions except the current one. */
  async revokeAll(): Promise<{ revoked: number }> {
    return this.http.request<{ revoked: number }>('/v1/auth/sessions/revoke-all', {
      method: 'POST',
    });
  }
}
