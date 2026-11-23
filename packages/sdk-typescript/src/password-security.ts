import type { HttpClient } from './http.js';
import type {
  PasswordSecurityStatus,
  PasswordValidationResult,
  PasswordHistoryEntry,
} from './types.js';

/**
 * Password security client — `/v1/auth/password-security`.
 */
export class PasswordSecurity {
  constructor(private readonly http: HttpClient) {}

  /** Check if a password is in a known breached list. */
  async checkBreached(password: string): Promise<{ breached: boolean }> {
    const params = new URLSearchParams({ password });
    return this.http.request<{ breached: boolean }>(`/v1/auth/password-security/check?${params}`);
  }

  /** Get password history for the authenticated user. */
  async getHistory(): Promise<{ history: PasswordHistoryEntry[]; count: number }> {
    return this.http.request<{ history: PasswordHistoryEntry[]; count: number }>(
      '/v1/auth/password-security/history',
    );
  }

  /** Get lockout status for the authenticated user. */
  async getLockoutStatus(): Promise<PasswordSecurityStatus> {
    return this.http.request<PasswordSecurityStatus>('/v1/auth/password-security/lockout');
  }

  /** Validate a new password for strength, breaches, and reuse. */
  async validatePassword(password: string): Promise<PasswordValidationResult> {
    return this.http.request<PasswordValidationResult>('/v1/auth/password-security/validate', {
      method: 'POST',
      body: { password },
    });
  }
}
