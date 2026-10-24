import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import {
  api,
  ApiError,
  type NotificationDevice,
  type Notification as NotificationType,
  type NotificationStats,
} from '../lib/api.js';
import {
  Banner,
  GlassButton,
  GradientButton,
  PageTitle,
  Chip,
  Skeleton,
  GlassCard,
  GlassInput,
  GlassTextArea,
} from '../components/Glass.js';
import { formatDateTime, shortId } from '../lib/format.js';

export function NotificationPage() {
  const [devices, setDevices] = useState<NotificationDevice[] | null>(null);
  const [notifications, setNotifications] = useState<NotificationType[] | null>(null);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  // Send form
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [target, setTarget] = useState<'all' | 'web' | 'ios' | 'android'>('all');

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [deviceRes, notifRes, statsRes, vapidRes] = await Promise.all([
        api.get<{ devices: NotificationDevice[] }>('/v1/notifications/devices'),
        api.get<{ notifications: NotificationType[] }>('/v1/notifications'),
        api.get<NotificationStats>('/v1/notifications/stats'),
        api.get<{ publicKey: string }>('/v1/notifications/vapid-key'),
      ]);
      setDevices(deviceRes.devices);
      setNotifications(notifRes.notifications);
      setStats(statsRes);
      setVapidKey(vapidRes.publicKey);
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Could not load notifications');
    }
  }, []);

  useEffect(() => {
    void refresh();
    if ('serviceWorker' in navigator && 'Notification' in window) {
      navigator.serviceWorker.ready.then((reg: ServiceWorkerRegistration) => {
        // pushSubscription may not be in the DOM lib types
        const sub = (reg as unknown as { pushSubscription?: unknown }).pushSubscription;
        if (sub) setSubscribed(true);
      });
    }
  }, [refresh]);

  /** Subscribe the browser to Web Push. */
  const subscribe = async () => {
    if (!vapidKey) {
      setError('VAPID key not available');
      return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Web Push not supported in this browser');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await navigator.serviceWorker.register('/sw.js');
      const reg = await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied');
        setBusy(false);
        return;
      }

      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      };

      const applicationServerKey = urlBase64ToUint8Array(vapidKey);
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      await api.post('/v1/notifications/devices', {
        token: subscription.endpoint,
        platform: 'web',
        pushService: 'web_push',
        metadata: { keys: (subscription as unknown as { keys: Record<string, string> }).keys },
      });

      setSubscribed(true);
      setNotice('Web Push enabled — you will receive notifications in this browser');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to subscribe to push');
    } finally {
      setBusy(false);
    }
  };

  /** Unsubscribe from Web Push. */
  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setNotice('Unsubscribed from Web Push');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unsubscribe');
    } finally {
      setBusy(false);
    }
  };

  /** Send a notification. */
  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = dataUrl.trim() ? { url: dataUrl.trim() } : undefined;
      await api.post('/v1/notifications', {
        title: title.trim(),
        body: body.trim(),
        data,
        target,
      });
      setNotice(`Notification sent to ${target} devices`);
      setTitle('');
      setBody('');
      setDataUrl('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Failed to send notification');
    } finally {
      setBusy(false);
    }
  };

  /** Broadcast to all users (admin only). */
  const broadcast = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post('/v1/notifications/broadcast', {
        title: title.trim(),
        body: body.trim(),
        target: 'all',
      });
      setNotice('Broadcast sent to all users');
      setTitle('');
      setBody('');
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Failed to broadcast');
    } finally {
      setBusy(false);
    }
  };

  const onTitleChange = (e: ChangeEvent<HTMLInputElement>) => setTitle(e.target.value);
  const onBodyChange = (e: ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value);
  const onDataUrlChange = (e: ChangeEvent<HTMLInputElement>) => setDataUrl(e.target.value);

  const statCards = [
    { label: 'Total', value: stats?.total ?? '—', accent: '#5E8CFF' },
    { label: 'Sent', value: stats?.sent ?? '—', accent: '#10B981' },
    { label: 'Pending', value: stats?.pending ?? '—', accent: '#F59E0B' },
    { label: 'Failed', value: stats?.failed ?? '—', accent: '#EF4444' },
  ];

  return (
    <div className="page-content">
      <PageTitle
        title="Push Notifications"
        subtitle="Web Push (VAPID), APNs, and FCM — send to every platform"
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((s) => (
          <GlassCard key={s.label} style={{ padding: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.5 }}>
              {s.label}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', color: s.accent }}>
              {s.value}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Web Push subscription card */}
      <GlassCard style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>Web Push</div>
            <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '4px' }}>
              {subscribed
                ? 'Subscribed — notifications will appear in this browser'
                : 'Subscribe this browser to receive push notifications'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {subscribed ? (
              <GlassButton className="btn-danger" onClick={unsubscribe} disabled={busy}>
                Unsubscribe
              </GlassButton>
            ) : (
              <GradientButton onClick={subscribe} disabled={busy}>
                Enable Web Push
              </GradientButton>
            )}
          </div>
        </div>
        {vapidKey && (
          <div style={{ fontSize: '11px', opacity: 0.4, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            VAPID: {vapidKey.slice(0, 32)}...
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
          <Chip>Chrome</Chip>
          <Chip>Firefox</Chip>
          <Chip>Edge</Chip>
          <Chip>Safari</Chip>
        </div>
      </GlassCard>

      {/* Send notification */}
      <GlassCard style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Send Notification</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '500px' }}>
          <GlassInput
            placeholder="Notification title"
            value={title}
            onChange={onTitleChange}
            disabled={busy}
          />
          <GlassTextArea
            placeholder="Notification body"
            value={body}
            onChange={onBodyChange}
            disabled={busy}
            rows={3}
          />
          <GlassInput
            placeholder="Open URL (optional)"
            value={dataUrl}
            onChange={onDataUrlChange}
            disabled={busy}
          />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as typeof target)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'inherit',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '13px',
              }}
            >
              <option value="all">All devices</option>
              <option value="web">Web only</option>
              <option value="ios">iOS only</option>
              <option value="android">Android only</option>
            </select>
            <GradientButton onClick={send} disabled={busy}>
              Send Push
            </GradientButton>
            <GlassButton onClick={broadcast} disabled={busy}>
              Broadcast (admin)
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* Registered devices */}
      <GlassCard style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Registered Devices ({devices?.length ?? 0})
        </div>
        {!devices ? (
          <div className="space-y-2">
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12" />
          </div>
        ) : devices.length === 0 ? (
          <div style={{ fontSize: '13px', opacity: 0.5, padding: '16px 0' }}>
            No devices registered. Enable Web Push above or register from your app.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {devices.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: d.platform === 'web' ? 'rgba(94,140,255,0.15)' : d.platform === 'ios' ? 'rgba(132,204,22,0.15)' : 'rgba(255,180,0,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                    }}
                  >
                    {d.platform === 'web' ? '🌐' : d.platform === 'ios' ? '' : '🤖'}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>
                      {d.platform} · {d.pushService}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.4, fontFamily: 'monospace' }}>
                      {shortId(d.id, 8)}
                    </div>
                  </div>
                </div>
                <Chip tone={d.active ? 'green' : 'default'}>
                  {d.active ? 'Active' : 'Inactive'}
                </Chip>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* Notification history */}
      <GlassCard style={{ padding: '24px' }}>
        <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          Notification History ({notifications?.length ?? 0})
        </div>
        {!notifications ? (
          <div className="space-y-2">
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12" />
            <Skeleton className="w-full h-12" />
          </div>
        ) : notifications.length === 0 ? (
          <div style={{ fontSize: '13px', opacity: 0.5, padding: '16px 0' }}>
            No notifications yet. Send one above.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {notifications.slice(0, 20).map((n) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{n.title}</div>
                  <div style={{ fontSize: '12px', opacity: 0.5, marginTop: '2px' }}>{n.body}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Chip tone={n.status === 'sent' ? 'green' : n.status === 'pending' ? 'blue' : 'coral'}>
                    {n.status}
                  </Chip>
                  <span style={{ fontSize: '11px', opacity: 0.4 }}>
                    {formatDateTime(n.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
