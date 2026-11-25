import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { ApiError } from '../errors.js';

interface SessionRow {
  id: string;
  user_id: string;
  session_id: string;
  user_agent: string | null;
  ip_address: string | null;
  device_type: string | null;
  last_active_at: Date;
  created_at: Date;
  revoked: boolean;
  revoked_at: Date | null;
}

function detectDeviceType(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android')) return 'mobile';
  if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) return 'mobile';
  if (ua.includes('bot') || ua.includes('crawler')) return 'bot';
  return 'desktop';
}

/**
 * Session management — tracks active sessions per user, enables
 * listing, individual revocation, and revoke-all.
 */
export class SessionService {
  constructor(private readonly db: Knex) {}

  /** Record a new session. */
  async create(
    userId: string,
    info: { userAgent?: string; ipAddress?: string; sessionId: string },
  ): Promise<SessionRow> {
    const [row] = await this.db<SessionRow>('user_sessions')
      .insert({
        user_id: userId,
        session_id: info.sessionId,
        user_agent: info.userAgent ?? null,
        ip_address: info.ipAddress ?? null,
        device_type: detectDeviceType(info.userAgent ?? null),
      })
      .returning('*');
    return row!;
  }

  /** Touch a session's last_active_at. */
  async touch(sessionId: string): Promise<void> {
    await this.db('user_sessions')
      .where({ session_id: sessionId, revoked: false })
      .update({ last_active_at: new Date() });
  }

  /** Get-or-create a session. Touches if exists, creates if not. */
  async ensure(
    userId: string,
    sessionId: string,
    info: { userAgent?: string; ipAddress?: string },
  ): Promise<SessionRow> {
    const existing = await this.db<SessionRow>('user_sessions')
      .where({ session_id: sessionId })
      .first();
    if (existing && !existing.revoked) {
      await this.touch(sessionId);
      return existing;
    }
    return this.create(userId, { ...info, sessionId });
  }

  /** List active sessions for a user. */
  async list(userId: string): Promise<SessionRow[]> {
    return this.db<SessionRow>('user_sessions')
      .where({ user_id: userId, revoked: false })
      .orderBy('last_active_at', 'desc');
  }

  /** Revoke a single session. */
  async revoke(userId: string, sessionId: string): Promise<boolean> {
    const updated = await this.db('user_sessions')
      .where({ user_id: userId, session_id: sessionId, revoked: false })
      .update({ revoked: true, revoked_at: new Date() });
    return updated > 0;
  }

  /** Revoke all sessions for a user (optionally except one). */
  async revokeAll(userId: string, exceptSessionId?: string): Promise<number> {
    const query = this.db('user_sessions')
      .where({ user_id: userId, revoked: false });
    if (exceptSessionId) {
      query.where('session_id', '!=', exceptSessionId);
    }
    const updated = await query.update({ revoked: true, revoked_at: new Date() });
    return updated;
  }

  /** Check if a session is still active. */
  async isActive(sessionId: string): Promise<boolean> {
    const row = await this.db<SessionRow>('user_sessions')
      .where({ session_id: sessionId })
      .first();
    return !!row && !row.revoked;
  }
}

export { detectDeviceType };
