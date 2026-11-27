import type { Knex } from 'knex';

/**
 * TypingService — Typing indicators and presence.
 * Tracks typing status for rooms/conversations and cleans up stale entries.
 */
export class TypingService {
  constructor(private readonly db: Knex) {}

  private expiresAt() {
    return this.db.raw("now() + interval '10 seconds'");
  }

  async setTyping(userId: string, room: string, isTyping: boolean) {
    await this.db('typing_indicators')
      .insert({
        user_id: userId,
        room,
        is_typing: isTyping,
        expires_at: this.expiresAt(),
      })
      .onConflict(['user_id', 'room'])
      .merge({
        is_typing: isTyping,
        updated_at: this.db.fn.now(),
        expires_at: this.expiresAt(),
      });
  }

  async getTypingUsers(room: string): Promise<string[]> {
    const rows = await this.db('typing_indicators')
      .where({ room, is_typing: true })
      .where('expires_at', '>=', this.db.fn.now());

    return rows.map((r) => r.user_id);
  }

  async clearTyping(userId: string, room: string): Promise<number> {
    return this.db('typing_indicators')
      .where({ user_id: userId, room, is_typing: true })
      .update({ is_typing: false });
  }

  async cleanup(): Promise<number> {
    return this.db('typing_indicators').where('expires_at', '<', this.db.fn.now()).del();
  }
}
