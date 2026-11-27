import type { Knex } from 'knex';
import { randomUUID } from 'node:crypto';

export interface StreamSession {
  id: string;
  type: string;
  room: string | null;
  participants: string[];
  status: 'active' | 'ended' | 'failed';
  metadata: Record<string, unknown>;
}

/**
 * StreamService — Real-time streaming sessions (WebRTC, RTMP, HLS).
 * Manages live streaming sessions, participant tracking, and recording.
 */
export class StreamService {
  constructor(private readonly db: Knex) {}

  async createSession(
    type: 'webrtc' | 'rtmp' | 'hls',
    room: string | null,
    ownerId: string,
    metadata: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    const id = randomUUID();
    await this.db('stream_sessions').insert({
      id,
      type,
      room,
      owner_id: ownerId,
      participants: [ownerId],
      status: 'active',
      metadata,
    });
    return { id };
  }

  async getSession(id: string) {
    return this.db('stream_sessions').where({ id }).first();
  }

  async getByRoom(room: string) {
    return this.db('stream_sessions').where({ room, status: 'active' });
  }

  async addParticipant(sessionId: string, userId: string, role: string = 'viewer') {
    const session = await this.db('stream_sessions').where({ id: sessionId }).first();
    if (!session) throw new Error('Stream session not found');

    const participants = session.participants ?? [];
    if (!participants.includes(userId)) {
      participants.push(userId);
    }

    await this.db('stream_sessions').where({ id: sessionId }).update({
      participants,
      last_activity_at: this.db.fn.now(),
    });
    return { participants, role };
  }

  async removeParticipant(sessionId: string, userId: string): Promise<void> {
    const session = await this.db('stream_sessions').where({ id: sessionId }).first();
    if (!session) return;
    const participants = (session.participants ?? []).filter((p: string) => p !== userId);
    await this.db('stream_sessions').where({ id: sessionId }).update({
      participants,
      last_activity_at: this.db.fn.now(),
    });
  }

  async endSession(sessionId: string, reason?: string): Promise<void> {
    await this.db('stream_sessions').where({ id: sessionId }).update({
      status: 'ended',
      ended_at: this.db.fn.now(),
      metadata: this.db.raw('metadata || ?::jsonb', [{ endReason: reason }]),
    });
  }

  async listActive(type?: string, room?: string) {
    const q = this.db('stream_sessions').where({ status: 'active' });
    if (type) q.where({ type });
    if (room) q.where({ room });
    return q;
  }

  async stats() {
    const rows = await this.db('stream_sessions').select('type', 'status').count({ count: '*' }).groupBy('type, status');
    const map: Record<string, Record<string, number>> = {};
    for (const row of rows as Array<{ type: string; status: string; count: string }>) {
      if (!map[row.type]) map[row.type] = {};
      map[row.type]![row.status] = Number(row.count);
    }
    return map;
  }
}
