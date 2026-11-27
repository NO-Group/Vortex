import crypto from 'node:crypto';
import type { Knex } from 'knex';

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class PhoneAuthService {
  constructor(
    private readonly db: Knex,
    private readonly smsProvider?: { send: (phone: string, message: string) => Promise<void> },
  ) {}

  /** Generate and send an OTP to a phone number. */
  async requestOTP(phone: string, userId?: string): Promise<{ otp: string; expiresAt: Date; sent: boolean }> {
    const otp = String(crypto.randomInt(100000, 999999));
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Invalidate previous pending OTPs for this phone
    await this.db('phone_auth')
      .where({ phone, status: 'pending' })
      .update({ status: 'expired' });

    await this.db('phone_auth').insert({
      user_id: userId ?? null,
      phone,
      otp_hash: otpHash,
      provider: 'sms',
      status: 'pending',
      expires_at: expiresAt,
    });

    let sent = false;
    if (this.smsProvider) {
      try {
        await this.smsProvider.send(phone, `Your Vortex verification code is: ${otp}`);
        sent = true;
      } catch {
        // SMS failure doesn't fail the request — OTP is still stored
      }
    }

    return { otp, expiresAt, sent };
  }

  /** Verify an OTP and create/update a session. */
  async verifyOTP(phone: string, otp: string): Promise<{ valid: boolean; userId?: string }> {
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

    const row = await this.db('phone_auth')
      .where({ phone, otp_hash: otpHash, status: 'pending' })
      .orderBy('created_at', 'desc')
      .first();

    if (!row) return { valid: false };

    if (new Date(row.expires_at) < new Date()) {
      return { valid: false };
    }

    await this.db('phone_auth')
      .where({ id: row.id })
      .update({ status: 'verified', verified_at: this.db.fn.now() });

    return { valid: true, userId: row.user_id ?? undefined };
  }

  /** List phone auth attempts for a user. */
  async listForUser(userId: string) {
    return this.db('phone_auth').where({ user_id: userId }).orderBy('created_at', 'desc');
  }
}
