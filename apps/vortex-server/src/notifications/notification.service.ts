import type { Knex } from 'knex';
import { createSign } from 'node:crypto';
import webPush from 'web-push';
const { generateVAPIDKeys, setVapidDetails, sendNotification: webPushSend } = webPush;
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

export interface NotificationServiceOptions {
  /** FCM HTTP v1: Firebase project ID + service account private key. */
  fcmProjectId?: string;
  fcmPrivateKey?: string;
  /** APNs: Apple team ID (10-character). */
  apnsTeamId?: string;
  /** APNs: Key ID (10-character identifier from Apple Developer portal). */
  apnsKeyId?: string;
  /** APNs: App bundle ID (e.g. com.example.app). */
  apnsBundleId?: string;
  /** APNs: AuthKey .p8 file contents (base64 PKCS#8). */
  apnsPrivateKey?: string;
  /** APNs: use sandbox endpoint (default: false = production). */
  apnsSandbox?: boolean;
  /** VAPID keys for Web Push. Auto-generated if not provided. */
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
  vapidSubject?: string;
  publicAppUrl: string;
}

/**
 * Notification service — device registration + push delivery.
 *
 * Three delivery transports:
 *
 * 1. **Web Push (VAPID)** — the browser-native push standard. Works in
 *    Chrome, Firefox, Edge, and Safari. No external setup needed. The browser
 *    subscribes via `pushManager.subscribe()` with Vortex's VAPID public key,
 *    and the server sends push messages signed with the VAPID private key.
 *
 * 2. **APNs** — Apple Push Notification service for native iOS apps. Uses
 *    HTTP/2 + ES256 JWT auth (the .p8 auth-key flow). Requires an Apple
 *    Developer account with push notifications enabled. This is the only push
 *    channel that works on iOS — no alternative exists.
 *
 * 3. **FCM HTTP v1** — for Android apps using Firebase Cloud Messaging.
 *    Uses the current OAuth2 bearer-token API. Requires a Firebase project
 *    with a service account. This is the only push channel that works on
 *    Android — no alternative exists.
 *
 * If FCM/APNs credentials are not configured, deliveries to those platforms
 * are marked "pending" (the notification is recorded for history but not
 * pushed). Web Push works without any external setup.
 *
 * **Why native push requires FCM/APNs:** Android and iOS only allow push
 * notifications through their OS-level push services. Every backend (Supabase,
 * Firebase, custom) routes through FCM/APNs for native apps. Vortex provides
 * the transport layer to both — same as any backend, but with Vortex identity.
 */
export class NotificationService {
  private vapidKeys: { publicKey: string; privateKey: string } | null = null;
  private fcmAccessToken: string | null = null;
  private fcmTokenExpiry: number = 0;
  private apnsJwt: string | null = null;
  private apnsJwtExpiry: number = 0;

  constructor(
    private readonly db: Knex,
    private readonly opts: NotificationServiceOptions,
  ) {
    // Initialize VAPID keys.
    if (opts.vapidPublicKey && opts.vapidPrivateKey) {
      this.vapidKeys = {
        publicKey: opts.vapidPublicKey,
        privateKey: opts.vapidPrivateKey,
      };
    } else {
      const keys = generateVAPIDKeys();
      this.vapidKeys = {
        publicKey: keys.publicKey,
        privateKey: keys.privateKey,
      };
    }

    if (this.vapidKeys) {
      setVapidDetails(
        'mailto:' + (opts.vapidSubject ?? 'noreply@vortex.local'),
        this.vapidKeys.publicKey,
        this.vapidKeys.privateKey,
      );
    }
  }

  /** Get the VAPID public key (for browser pushManager.subscribe()). */
  getVapidPublicKey(): string | null {
    return this.vapidKeys?.publicKey ?? null;
  }

  // ── Device registration ──────────────────────────────────────────────

  /** Register or update a device for push notifications. */
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
        push_service: input.pushService ?? 'web_push',
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
        push_service: input.pushService ?? 'web_push',
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
   * Send a push notification to a user's devices.
   *
   * Routes each device to the appropriate transport:
   *   - `web_push` devices → Web Push (VAPID) via the browser's push service
   *   - `fcm` devices → FCM HTTP v1 (if FCM credentials configured)
   *   - `apns` devices → APNs HTTP/2 (if APNs credentials configured)
   *
   * If a transport's credentials aren't configured, that delivery is marked
   * "pending" (recorded for history, not pushed).
   */
  async sendNotification(input: {
    userId?: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    target?: 'all' | 'web' | 'ios' | 'android';
  }): Promise<{
    notification: { id: string; status: string; deliveredAt: string | null };
    results: Array<{ deviceId: string; transport: string; status: string }>;
  }> {
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

    const results: Array<{ deviceId: string; transport: string; status: string }> = [];
    let anySent = false;

    if (input.userId) {
      const devices = await this.db<DeviceRow>('vortex_devices')
        .where({ user_id: input.userId, active: true });

      for (const device of devices) {
        // Filter by target if specified.
        if (input.target && input.target !== 'all') {
          if (input.target === 'web' && device.platform !== 'web') continue;
          if (input.target === 'ios' && device.platform !== 'ios') continue;
          if (input.target === 'android' && device.platform !== 'android') continue;
        }

        const result = await this.deliver(device, input.title, input.body, input.data);
        results.push({ deviceId: device.id, transport: device.push_service, status: result });
        if (result === 'sent') anySent = true;
      }
    }

    const status = anySent ? 'sent' : results.length > 0 ? 'failed' : 'pending';
    const deliveredAt = anySent ? new Date().toISOString() : null;

    await this.db('vortex_notifications')
      .where({ id: row!.id })
      .update({ status, delivered_at: deliveredAt });

    return {
      notification: { id: row!.id, status, deliveredAt },
      results,
    };
  }

  /** Deliver a notification to a single device via its transport. */
  private async deliver(
    device: DeviceRow,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<'sent' | 'failed' | 'pending'> {
    try {
      if (device.push_service === 'web_push') {
        return this.deliverWebPush(device.token, JSON.stringify({
          notification: { title, body },
          data: data ?? {},
          url: '/',
        }));
      }
      if (device.push_service === 'fcm') {
        return this.deliverFCM(device.token, { title, body, data: data ?? {} });
      }
      if (device.push_service === 'apns') {
        return this.deliverAPNs(device.token, { title, body, data: data ?? {} });
      }
      return 'pending';
    } catch (err) {
      console.warn(`[vortex] push delivery failed for ${device.push_service}: ${(err as Error).message}`);
      return 'failed';
    }
  }

  // ── Web Push (VAPID) ─────────────────────────────────────────────────

  /** Deliver via Web Push (VAPID) — the browser-native transport. */
  private async deliverWebPush(subscriptionEndpoint: string, payload: string): Promise<'sent' | 'failed'> {
    if (!this.vapidKeys) {
      throw new Error('VAPID keys not configured');
    }

    // Parse the subscription endpoint URL into the subscription object format
    // expected by web-push.
    const url = new URL(subscriptionEndpoint);
    const sub = {
      endpoint: subscriptionEndpoint,
      keys: {
        p256dh: url.searchParams.get('p256dh') ?? '',
        auth: url.searchParams.get('auth') ?? '',
      },
    };

    await webPushSend(sub, payload);
    return 'sent';
  }

  // ── FCM HTTP v1 (Android) ─────────────────────────────────────────────

  /** Deliver via FCM HTTP v1 (OAuth2 bearer token). */
  private async deliverFCM(
    deviceToken: string,
    payload: { title: string; body: string; data: Record<string, unknown> },
  ): Promise<'sent' | 'failed' | 'pending'> {
    if (!this.opts.fcmProjectId || !this.opts.fcmPrivateKey) {
      return 'pending';
    }

    const accessToken = await this.getFCMAccessToken();
    if (!accessToken) return 'failed';

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${this.opts.fcmProjectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: payload.data,
          },
        }),
      },
    );

    if (res.ok) return 'sent';
    return 'failed';
  }

  /** Get (or refresh) an FCM access token via OAuth2. */
  private async getFCMAccessToken(): Promise<string | null> {
    if (this.fcmAccessToken && Date.now() < this.fcmTokenExpiry - 60_000) {
      return this.fcmAccessToken;
    }

    if (!this.opts.fcmPrivateKey) return null;

    // Sign a JWT with the service account private key (RS256).
    const header = Buffer.from(
      JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
    ).toString('base64url');
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiry = issuedAt + 3600;
    const claims = Buffer.from(
      JSON.stringify({
        iss: `firebase-robot@${this.opts.fcmProjectId}.iam.gserviceaccount.com`,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: issuedAt,
        exp: expiry,
      }),
    ).toString('base64url');

    const jwt = `${header}.${claims}`;
    const sign = createSign('RSA-SHA256');
    sign.update(jwt);
    const signature = sign.sign(this.opts.fcmPrivateKey, 'base64url');
    const signedJwt = `${jwt}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }),
    });

    if (!tokenRes.ok) return null;

    const tokenBody = (await tokenRes.json()) as { access_token: string; expires_in: number };
    this.fcmAccessToken = tokenBody.access_token;
    this.fcmTokenExpiry = Date.now() + tokenBody.expires_in * 1000;
    return this.fcmAccessToken;
  }

  // ── APNs (iOS) ───────────────────────────────────────────────────────

  /**
   * Deliver via APNs (Apple Push Notification service).
   *
   * Uses HTTP/2 + ES256 JWT auth (the .p8 auth-key flow). This is the only
   * push channel that works on iOS — Apple does not allow third-party push
   * services on the platform.
   */
  private async deliverAPNs(
    deviceToken: string,
    payload: { title: string; body: string; data: Record<string, unknown> },
  ): Promise<'sent' | 'failed' | 'pending'> {
    if (!this.opts.apnsTeamId || !this.opts.apnsKeyId || !this.opts.apnsBundleId || !this.opts.apnsPrivateKey) {
      return 'pending';
    }

    const jwt = await this.getAPNsJwt();
    if (!jwt) return 'failed';

    const host = this.opts.apnsSandbox
      ? 'api-sandbox.push.apple.com'
      : 'api.push.apple.com';

    // APNs requires HTTP/2. Node's fetch doesn't support HTTP/2 natively,
    // so we use the http2 module directly.
    const { default: http2 } = await import('node:http2');
    const client = http2.connect(`https://${host}`);

    return new Promise<'sent' | 'failed'>((resolve) => {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${deviceToken}`,
        'content-type': 'application/json',
        authorization: `bearer ${jwt}`,
        'apns-topic': this.opts.apnsBundleId,
        'apns-push-type': 'alert',
        'apns-priority': '10',
      });

      req.on('response', (headers) => {
        const status = headers[':status'] as number;
        // 200 = success
        if (status === 200) {
          resolve('sent');
        } else {
          // APNs error — read the body for details
          req.resume();
          resolve('failed');
        }
      });

      req.on('error', () => resolve('failed'));

      req.write(JSON.stringify({
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: 'default',
          badge: 1,
        },
        data: payload.data,
      }));

      req.end();
    });
  }

  /**
   * Get (or generate) an APNs JWT.
   *
   * APNs auth keys use ES256 (ECDSA with P-256). The .p8 file contains a
   * PKCS#8 private key in base64. The JWT is valid for up to 1 hour.
   */
  private async getAPNsJwt(): Promise<string | null> {
    if (this.apnsJwt && Date.now() < this.apnsJwtExpiry - 60_000) {
      return this.apnsJwt;
    }

    if (!this.opts.apnsPrivateKey) return null;

    // The .p8 file is a base64-encoded PKCS#8 private key.
    // Decode it to get the raw PEM.
    const pem = `-----BEGIN PRIVATE KEY-----\n${this.opts.apnsPrivateKey}\n-----END PRIVATE KEY-----`;

    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', typ: 'JWT', kid: this.opts.apnsKeyId }),
    ).toString('base64url');

    const issuedAt = Math.floor(Date.now() / 1000);
    const expiry = issuedAt + 3600; // 1 hour
    const claims = Buffer.from(
      JSON.stringify({ iss: this.opts.apnsTeamId, iat: issuedAt, exp: expiry }),
    ).toString('base64url');

    const unsignedJwt = `${header}.${claims}`;

    // Sign with ES256 (ECDSA P-256).
    const { createSign } = await import('node:crypto');
    const sign = createSign('SHA256');
    sign.update(unsignedJwt);
    const signature = sign.sign({ key: pem, dsaEncoding: 'ieee-p1363' }, 'base64url');

    const jwt = `${unsignedJwt}.${signature}`;
    this.apnsJwt = jwt;
    this.apnsJwtExpiry = Date.now() + 3600_000;
    return jwt;
  }

  // ── Notification queries ─────────────────────────────────────────────

  /** List notifications for a user. */
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
