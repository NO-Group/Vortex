import type { Knex } from 'knex';
import { ApiError } from '../errors.js';

interface DeviceRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  push_service: string;
  metadata: Record<string, unknown> | null;
  active: boolean;
  last_used_at: Date | string | null;
  created_at: Date | string;
}

interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: string;
  target: string | null;
  created_at: Date | string;
  delivered_at: Date | string | null;
}

/**
 * Notification service — device registration + push delivery.
 *
 * Supports FCM (Firebase Cloud Messaging) as the delivery transport,
 * with a pluggable interface for APNS and Web Push.
 *
 * The actual push delivery is delegated to the configured push provider.
 * In development without FCM credentials, notifications are recorded
 * but delivery is marked as "pending" (the notification still appears
 * in the history, just not pushed to a device).
 */
export class NotificationService {
  constructor(
    private readonly db: Knex,
    private readonly opts: {
      fcmServerKey?: string;
      publicAppUrl: string;
    },
  ) {}

  // ── Device registration ──────────────────────────────────────────────

  /** Register or update a device token for push notifications. */
  async registerDevice(input: {
    userId: string;
    token: string;
    platform?: string;
    pushService?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ device: { id: string; platform: string; active: boolean } }> {
    if (!input.token?.trim()) {
      throw ApiError.badRequest('Device token is required');
    }

    const [device] = await this.db<DeviceRow>('vortex_devices')
      .insert({
        user_id: input.userId,
        token: input.token,
        platform: input.platform ?? 'web',
        push_service: input.pushService ?? 'fcm',
        metadata: input.metadata ?? null,
        active: true,
        last_used_at: this.db.fn.now(),
      })
      .onConflict(['user_id', 'token'])
      .ignore()
      .returning(['id', 'platform', 'active']);

    // Update existing device if it was already registered.
    await this.db('vortex_devices')
      .where({ user_id: input.userId, token: input.token })
      .update({
        platform: input.platform ?? 'web',
        push_service: input.pushService ?? 'fcm',
        metadata: input.metadata ?? null,
        active: true,
        last_used_at: this.db.fn.now(),
      });

    return { device: { id: device!.id, platform: device!.platform, active: device!.active } };
  }

  /** List a user's registered devices. */
  async listDevices(userId: string): Promise<Array<{
    id: string;
    platform: string;
    pushService: string;
    active: boolean;
    createdAt: string;
  }>> {
    const rows = await this.db<DeviceRow>('vortex_devices')
      .where({ user_id: userId })
      .orderBy('created_at');
    return rows.map((r) => ({
      id: r.id,
      platform: r.platform,
      pushService: r.push_service,
      active: r.active,
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }

  /** Deactivate a device token. */
  async deactivateDevice(userId: string, deviceId: string): Promise<void> {
    const deleted = await this.db('vortex_devices')
      .where({ id: deviceId, user_id: userId })
      .update({ active: false });
    if (!deleted) throw ApiError.notFound('Device not found');
  }

  // ── Notification delivery ────────────────────────────────────────────

  /**
   * Send a push notification to a user (or broadcast to all).
   *
   * If FCM credentials are configured, the notification is delivered
   * to the user's registered devices. Otherwise it's recorded with
   * status "pending" (available for later delivery or history).
   */
  async sendNotification(input: {
    userId?: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    target?: 'all' | 'web' | 'ios' | 'android';
  }): Promise<{ notification: { id: string; status: string; deliveredAt: string | null } }> {
    if (!input.title?.trim() || !input.body?.trim()) {
      throw ApiError.badRequest('Notification title and body are required');
    }

    const [row] = await this.db<NotificationRow>('vortex_notifications')
      .insert({
        user_id: input.userId ?? null,
        title: input.title.trim(),
        body: input.body.trim(),
        data: input.data ?? null,
        target: input.target ?? null,
        status: 'pending',
      })
      .returning('*');

    // Try to deliver via FCM if configured.
    let status = 'pending';
    let deliveredAt: string | null = null;

    if (this.opts.fcmServerKey && input.userId) {
      try {
        const devices = await this.db<DeviceRow>('vortex_devices')
          .where({ user_id: input.userId, active: true })
          .where('push_service', 'fcm');

        if (devices.length) {
          const tokens = devices.map((d) => d.token);
          const fcmPayload = {
            notification: {
              title: input.title,
              body: input.body,
            },
            data: input.data ?? {},
            registration_ids: tokens,
          };

          const res = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `key=${this.opts.fcmServerKey}`,
            },
            body: JSON.stringify(fcmPayload),
          });

          if (res.ok) {
            status = 'sent';
            deliveredAt = new Date().toISOString();
          }
        }
      } catch (err) {
        console.warn(`[vortex] FCM delivery failed: ${(err as Error).message}`);
        status = 'failed';
      }
    }

    await this.db('vortex_notifications')
      .where({ id: row!.id })
      .update({ status, delivered_at: deliveredAt });

    return {
      notification: {
        id: row!.id,
        status,
        deliveredAt,
      },
    };
  }

  /** List notifications for a user (or all, for admins). */
  async listNotifications(userId: string, limit = 50): Promise<Array<{
    id: string;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    status: string;
    createdAt: string;
    deliveredAt: string | null;
  }>> {
    const rows = await this.db<NotificationRow>('vortex_notifications')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(Math.min(limit, 200));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      data: r.data ?? null,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      deliveredAt: r.delivered_at ? new Date(r.delivered_at).toISOString() : null,
    }));
  }

  /** Count notifications for stats. */
  async notificationStats(userId: string): Promise<{ total: number; sent: number; pending: number; failed: number }> {
    const [total] = await this.db('vortex_notifications')
      .select(this.db.raw('count(*)::int as count'))
      .where({ user_id: userId });

    const [sent] = await this.db('vortex_notifications')
      .select(this.db.raw('count(*)::int as count'))
      .where({ user_id: userId, status: 'sent' });

    const [pending] = await this.db('vortex_notifications')
      .select(this.db.raw('count(*)::int as count'))
      .where({ user_id: userId, status: 'pending' });

    const [failed] = await this.db('vortex_notifications')
      .select(this.db.raw('count(*)::int as count'))
      .where({ user_id: userId, status: 'failed' });

    return {
      total: Number(total?.count ?? 0),
      sent: Number(sent?.count ?? 0),
      pending: Number(pending?.count ?? 0),
      failed: Number(failed?.count ?? 0),
    };
  }
}
