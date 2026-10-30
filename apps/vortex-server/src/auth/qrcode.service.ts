import { randomBytes, createHash } from 'node:crypto';
import type { Knex } from 'knex';
import QRCode from 'qrcode';
import { ApiError } from '../errors.js';
import { hashToken, OneTimeTokens } from '../auth/one-time-tokens.js';

/**
 * QR Code sign-in — generates a one-time token rendered as a QR code
 * data URL. The user scans the code (e.g. from a second device), which
 * calls /v1/auth/qr-code/verify with the token to complete sign-in.
 *
 * Flow:
 *   1. POST /v1/auth/qr-code/init → returns QrCodeSession (token + QR data URL)
 *   2. User scans the QR code, which contains the token
 *   3. POST /v1/auth/qr-code/verify { token } → returns AuthSession
 */
export class QrCodeService {
  private readonly oneTimeTokens: OneTimeTokens;

  constructor(private readonly db: Knex) {
    this.oneTimeTokens = new OneTimeTokens(db);
  }

  /** Generate a QR code sign-in session. */
  async init(userId: string): Promise<{
    token: string;
    qrDataUrl: string;
    expiresAt: Date;
  }> {
    // Issue a one-time token of kind 'qr' (expires in 5 minutes)
    const { token, expiresAt } = await this.oneTimeTokens.issue(userId, 'qr', 5);

    // The QR code encodes a URL the scanning device can hit, or just the
    // token string. We use the token string directly for flexibility.
    const qrDataUrl = await QRCode.toDataURL(token, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
      color: { dark: '#000000', light: '#ffffff' },
    });

    return { token, qrDataUrl, expiresAt };
  }

  /** Verify a QR code token and return the user id. */
  async verify(token: string): Promise<string | null> {
    return this.oneTimeTokens.consume(token, 'qr');
  }

  /** Get the raw QR code PNG buffer for API responses. */
  async toPngBuffer(token: string): Promise<Buffer> {
    return QRCode.toBuffer(token, {
      type: 'png',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
      color: { dark: '#000000', light: '#ffffff' },
    });
  }
}
