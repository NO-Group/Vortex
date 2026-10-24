import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  api,
  ApiError,
  type Webhook,
  type WebhookLogEntry,
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
} from '../components/Glass.js';
import { formatDateTime, shortId } from '../lib/format.js';

const EVENT_OPTIONS = [
  'database.insert',
  'database.update',
  'database.delete',
  'storage.upload',
  'storage.delete',
  'auth.signup',
  'auth.login',
  'apps.deploy',
  'functions.deploy',
];

export function WebhookPage() {
  const [webhooks, setWebhooks] = useState<Webhook[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [log, setLog] = useState<WebhookLogEntry[] | null>(null);

  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { webhooks } = await api.get<{ webhooks: Webhook[] }>('/v1/webhooks');
      setWebhooks(webhooks);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  const refreshLog = useCallback(async (webhookId: string) => {
    try {
      const { log } = await api.get<{ log: WebhookLogEntry[] }>(
        `/v1/webhooks/${webhookId}/log?limit=20`,
      );
      setLog(log);
    } catch {
      setLog(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (selectedId) void refreshLog(selectedId);
  }, [selectedId, refreshLog]);

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const createWebhook = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!url.trim()) {
      setError('Webhook URL is required');
      return;
    }
    if (!selectedEvents.length) {
      setError('Select at least one event');
      return;
    }
    setBusy(true);
    try {
      await api.post('/v1/webhooks', { url: url.trim(), events: selectedEvents });
      setUrl('');
      setSelectedEvents([]);
      setNotice('Webhook registered');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      await api.del(`/v1/webhooks/${id}`);
      if (selectedId === id) {
        setSelectedId(null);
        setLog(null);
      }
      setNotice('Webhook deleted');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  const regenerateSecret = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      const { secret } = await api.post<{ secret: string }>(`/v1/webhooks/${id}/secret`);
      setNotice(`New secret: ${secret}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  };

  const selected = webhooks?.find((w) => w.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <PageTitle
        title="Webhooks"
        subtitle="Deliver events to external services with HMAC-signed payloads"
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Webhook list */}
        <GlassCard className="p-5 lg:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Registered Webhooks
          </div>
          <div className="mt-4 space-y-3">
            {webhooks === null ? (
              <Skeleton className="h-24" />
            ) : webhooks.length === 0 ? (
              <div className="rounded-[12px] border border-dashed border-white/[0.08] p-8 text-center text-[13px] text-slate-500">
                No webhooks registered yet
              </div>
            ) : (
              webhooks.map((w) => (
                <div
                  key={w.id}
                  className={`rounded-[12px] border p-4 transition cursor-pointer ${
                    selectedId === w.id
                      ? 'border-interactive-focus/40 bg-interactive-focus/[0.05]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]'
                  }`}
                  onClick={() => setSelectedId(w.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[13px] text-slate-200 truncate">
                        {w.url}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {w.events.map((e) => (
                          <Chip key={e}>{e}</Chip>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-semibold ${
                            w.active ? 'text-spectrum-green' : 'text-slate-500'
                          }`}
                        >
                          {w.active ? '● active' : '○ inactive'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        ✓{w.success_count} ✗{w.failure_count}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">
                      {w.last_delivered_at ? formatDateTime(w.last_delivered_at) : 'never delivered'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void deleteWebhook(w.id);
                      }}
                      className="text-[11px] text-spectrum-coral/70 hover:text-spectrum-coral transition"
                    >
                      delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Create form */}
        <GlassCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Register Webhook
          </div>
          <form onSubmit={createWebhook} className="mt-4 space-y-4">
            <div>
              <label className="text-[11px] font-medium text-slate-400">Endpoint URL</label>
              <GlassInput
                type="url"
                value={url}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUrl(e.target.value)}
                placeholder="https://example.com/webhooks"
                className="mt-1.5 font-mono text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400">Events</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {EVENT_OPTIONS.map((event) => (
                  <button
                    key={event}
                    type="button"
                    onClick={() => toggleEvent(event)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-mono transition ${
                      selectedEvents.includes(event)
                        ? 'border-spectrum-violet/50 bg-spectrum-violet/15 text-spectrum-violet'
                        : 'border-white/[0.08] text-slate-500 hover:border-white/[0.15]'
                    }`}
                  >
                    {event}
                  </button>
                ))}
              </div>
            </div>
            <GradientButton type="submit" disabled={busy} className="w-full">
              {busy ? 'Registering…' : 'Register Webhook'}
            </GradientButton>
          </form>

          {/* Delivery log */}
          {selected && (
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Delivery Log
                </div>
                <GlassButton
                  className="text-[11px] px-2.5 py-1"
                  onClick={() => void regenerateSecret(selected.id)}
                >
                  Regenerate secret
                </GlassButton>
              </div>
              <div className="mt-3 rounded-[12px] border border-white/[0.07] bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
                Secret: {selected.secret}
              </div>
              <div className="mt-3 space-y-2">
                {log === null ? (
                  <Skeleton className="h-16" />
                ) : log.length === 0 ? (
                  <div className="text-center text-[12px] text-slate-600 py-4">
                    No deliveries yet
                  </div>
                ) : (
                  log.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-2 rounded-[10px] border border-white/[0.06] bg-white/[0.02] p-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-semibold ${
                              entry.status === 'delivered'
                                ? 'text-spectrum-green'
                                : 'text-spectrum-coral'
                            }`}
                          >
                            {entry.status}
                          </span>
                          <span className="text-[11px] text-slate-400">{entry.event}</span>
                        </div>
                        {entry.error && (
                          <div className="text-[10px] text-spectrum-coral/70 mt-0.5 truncate">
                            {entry.error}
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-600 shrink-0">
                        {formatDateTime(entry.created_at)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
