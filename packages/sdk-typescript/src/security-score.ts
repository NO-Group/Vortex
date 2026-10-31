import type { HttpClient } from './http.js';
import type { SecurityPostureScore, SecurityScoreEntry, EncryptionInfo } from './types.js';

/**
 * Security scoring client — `/v1/security`.
 */
export class SecurityScore {
  constructor(private readonly http: HttpClient) {}

  /** Get security posture score for the authenticated user. */
  async get(): Promise<SecurityPostureScore> {
    return this.http.request<SecurityPostureScore>('/v1/security/score');
  }

  /** Get historical security scores. */
  async getHistory(): Promise<{ history: SecurityScoreEntry[] }> {
    return this.http.request<{ history: SecurityScoreEntry[] }>('/v1/security/history');
  }

  /** Get encryption at rest information. */
  async getEncryptionInfo(): Promise<EncryptionInfo> {
    return this.http.request<EncryptionInfo>('/v1/security/encryption');
  }
}
