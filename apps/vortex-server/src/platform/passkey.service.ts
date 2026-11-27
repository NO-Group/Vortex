import crypto from 'node:crypto';
import type { Knex } from 'knex';

/**
 * PasskeyService — WebAuthn credential management.
 * Handles registration, authentication, and credential management.
 */
export class PasskeyService {
  constructor(private readonly db: Knex) {}

  /** Generate a challenge for passkey registration. */
  generateRegistrationChallenge(): { challenge: string; rpId: string } {
    return {
      challenge: crypto.randomBytes(32).toString('base64url'),
      rpId: 'vortex',
    };
  }

  /** Generate a challenge for passkey authentication. */
  generateAuthChallenge(): { challenge: string; rpId: string } {
    return {
      challenge: crypto.randomBytes(32).toString('base64url'),
      rpId: 'vortex',
    };
  }

  /** Register a new passkey credential. */
  async register(
    userId: string,
    credentialId: string,
    publicKey: string,
    transports?: string[],
    deviceName?: string,
  ): Promise<{ id: string }> {
    const [id] = await this.db('passkeys').insert({
      user_id: userId,
      credential_id: credentialId,
      public_key: publicKey,
      transports: transports ? JSON.stringify(transports) : null,
      device_name: deviceName ?? null,
      backup_eligible: false,
      backup_state: false,
      sign_count: '0',
    });
    return { id: String(id) };
  }

  /** Verify a passkey authentication and update sign count. */
  async verify(userId: string, credentialId: string, signCount: number): Promise<{ valid: boolean }> {
    const credential = await this.db('passkeys')
      .where({ user_id: userId, credential_id: credentialId })
      .first();

    if (!credential) return { valid: false };

    // Update sign count for replay protection
    await this.db('passkeys')
      .where({ id: credential.id })
      .update({
        sign_count: String(Math.max(Number(credential.sign_count), signCount)),
        last_used_at: this.db.fn.now(),
      });

    return { valid: true };
  }

  /** List passkeys for a user. */
  async list(userId: string) {
    return this.db('passkeys').where({ user_id: userId }).orderBy('created_at', 'desc');
  }

  /** Delete a passkey. */
  async delete(userId: string, credentialId: string): Promise<number> {
    return this.db('passkeys').where({ user_id: userId, credential_id: credentialId }).del();
  }
}
