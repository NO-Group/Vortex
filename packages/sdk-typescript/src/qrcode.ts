import type { HttpClient } from './http.js';
import type { AuthSession, QrCodeSession } from './types.js';

/**
 * QR Code sign-in client — `/v1/auth/qr-code`.
 */
export class QrCode {
  constructor(private readonly http: HttpClient) {}

  /** Generate a QR code sign-in session for the authenticated user. */
  async init(): Promise<QrCodeSession> {
    return this.http.request<QrCodeSession>('/v1/auth/qr-code/init', { method: 'POST' });
  }

  /** Verify a scanned QR token and receive a session. */
  async verify(token: string): Promise<AuthSession> {
    return this.http.request<AuthSession>('/v1/auth/qr-code/verify', {
      method: 'POST',
      body: { token },
    });
  }
}
