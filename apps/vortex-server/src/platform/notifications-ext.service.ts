import type { Knex } from 'knex';

export interface NotificationPreference {
  user_id: string;
  channel: 'in_app' | 'push' | 'email' | 'sms' | 'webhook';
  event_type: string;
  enabled: boolean;
}

/**
 * NotificationsExtService — Extended notification layer.
 * Manages user preferences, enqueues notifications, tracks delivery, and retries.
 */
export class NotificationsExtService {
  constructor(private readonly db: Knex) {}

  async setPreference(userId: string, channel: string, eventType: string, enabled: boolean) {
    await this.db('notification_preferences')
      .insert({ user_id: userId, channel: channel as string, event_type: eventType, enabled })
      .onConflict(['user_id', 'channel', 'event_type'])
      .merge({ enabled });
  }

  async listPreferences(userId: string, channel?: string) {
    const q = this.db('notification_preferences').where({ user_id: userId });
    if (channel) q.where({ channel });
    return q;
  }

  async enqueue(userId: string, eventType: string, payload: Record<string, unknown>, priority = 5) {
    const [id] = await this.db('notification_queue').insert({
      user_id: userId,
      event_type: eventType,
      channel: 'in_app',
      payload,
      priority,
      status: 'queued',
    });
    return { id };
  }

  async enqueueBulk(userIds: string[], eventType: string, payload: Record<string, unknown>) {
    const rows = userIds.map((userId) => ({
      user_id: userId,
      event_type: eventType,
      channel: 'in_app',
      payload,
      priority: 5,
      status: 'queued' as const,
    }));
    await this.db('notification_queue').insert(rows).returning('id');
  }

  /** Dequeue notifications for delivery, respecting user preferences. */
  async dequeueForDelivery(channel: string, limit = 50) {
    // Only get notifications where the user has enabled this channel
    return this.db('notification_queue')
      .where({ status: 'queued', channel })
      .whereExists(function() {
        this.select(1).from('notification_preferences')
          .whereRaw('notification_preferences.user_id = notification_queue.user_id')
          .whereRaw('notification_preferences.channel = notification_queue.channel')
          .whereRaw('notification_preferences.event_type = notification_queue.event_type')
          .where('notification_preferences.enabled', true);
      })
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc')
      .limit(limit);
  }

  async markDelivered(id: string, channel: string) {
    await this.db('notification_queue').where({ id }).update({
      status: 'delivered',
      delivered_at: this.db.fn.now(),
      attempts: this.db.raw('notification_queue.attempts + 1'),
    });
  }

  async markFailed(id: string, error: string) {
    const row = await this.db('notification_queue').where({ id }).first();
    if (!row) return;
    const newAttempts = row.attempts + 1;
    if (newAttempts < 3) {
      await this.db('notification_queue').where({ id }).update({
        attempts: newAttempts,
        status: 'queued',
        last_error: error,
      });
    } else {
      await this.db('notification_queue').where({ id }).update({
        status: 'failed',
        last_error: error,
      });
    }
  }

  async list(userId: string, status?: string, limit = 50) {
    const q = this.db('notification_queue').where({ user_id: userId }).orderBy('created_at', 'desc').limit(limit);
    if (status) q.where({ status });
    return q;
  }
}
