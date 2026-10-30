import { createHash, randomBytes } from 'node:crypto';
import type { Knex } from 'knex';

export type OneTimeKind = 'magic' | 'reset' | '2fa' | 'qr';

interface AuthTokenRow {
  id: string;
  user_id: string;
  kind: OneTimeKind;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

/** SHA-256 hex — tokens are stored hashed, never in the clear. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

/**
 * One-time auth tokens (magic sign-in links, password resets).
 * Single-use: consuming marks `used_at`, late replays are rejected.
 */
export class OneTimeTokens {
  constructor(private readonly db: Knex) {}

  /** Issue a fresh one-time token for a user. */
  async issue(userId: string, kind: OneTimeKind, ttlMinutes: number): Promise<IssuedToken> {
    // Invalidate any outstanding tokens of the same kind.
    await this.db('auth_tokens')
      .where({ user_id: userId, kind, used_at: null })
      .update({ used_at: new Date() });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
    await this.db('auth_tokens').insert({
      user_id: userId,
      kind,
      token_hash: hashToken(token),
      expires_at: expiresAt,
    });
    return { token, expiresAt };
  }

  /**
   * Consume a token. Returns the user id it belongs to, or null when the
   * token is unknown, expired, already used, or of the wrong kind.
   */
  async consume(token: string, kind: OneTimeKind): Promise<string | null> {
    const row = await this.db<AuthTokenRow>('auth_tokens')
      .where({ token_hash: hashToken(token), kind })
      .first();
    if (!row) return null;
    if (row.used_at) return null;
    if (row.expires_at.getTime() < Date.now()) return null;

    const updated = await this.db('auth_tokens')
      .where({ id: row.id, used_at: null })
      .update({ used_at: new Date() });
    return updated > 0 ? row.user_id : null;
  }
}
