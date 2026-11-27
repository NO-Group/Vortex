import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { api, getToken, type Health, type QueryResult, type StorageObject, type StorageStats } from '../lib/api.js';
import { formatBytes } from '../lib/format.js';
import { PageTitle, Chip, GlassCard, Skeleton } from '../components/Glass.js';
import { NodeCard, LoadBar } from '../components/NodeCard.js';

const iconAuth = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 1 1 8 0v3" />
  </svg>
);
const iconDb = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <ellipse cx="12" cy="5" rx="8" ry="3" />
    <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
    <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
  </svg>
);
const iconRt = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M2 12h4l3-8 4 16 3-8h6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const iconStore = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
    <path d="M2 8l10-5 10 5-10 5L2 8z" strokeLinejoin="round" />
  </svg>
);

/** Command Center — live vitals for every engine module. */
export function Overview({ wsConnections }: { wsConnections: number | null }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [objects, setObjects] = useState<StorageObject[] | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [wsHistory, setWsHistory] = useState<Array<{ t: string; connections: number }>>([]);
  const [storageDist, setStorageDist] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        const h = await api.get<Health>('/healthz');
        if (alive) setHealth(h);
      } catch {
        if (alive) setHealth(null);
      }
      try {
        const q = await api.post<QueryResult>('/v1/db/notes/query', {
          select: ['id'],
          limit: 500,
        });
        if (alive) setNoteCount(q.count);
      } catch {
        if (alive) setNoteCount(null);
      }
      try {
        const list = await api.get<{ objects: StorageObject[] }>('/v1/storage/list');
        if (alive) setObjects(list.objects);
      } catch {
        if (alive) setObjects(null);
      }
      try {
        const stats = await api.get<StorageStats>('/v1/storage/stats');
        if (alive) {
          setStorageStats(stats);
          // Build storage distribution pie chart
          const buckets: Array<{ name: string; value: number }> = [];
          if (stats.byBucket) {
            for (const [name, data] of Object.entries(stats.byBucket)) {
              buckets.push({ name, value: data.count });
            }
          } else {
            buckets.push({ name: 'objects', value: objects?.length ?? 0 });
          }
          setStorageDist(buckets);
        }
      } catch {
        if (alive) setStorageStats(null);
      }

      // Track realtime connection history for line chart
      const connCount = wsConnections ?? health?.realtime.connections ?? 0;
      if (alive && connCount > 0) {
        const now = new Date();
        setWsHistory((prev) => {
          const entry = { t: now.toLocaleTimeString(), connections: connCount };
          const next = [...prev, entry];
          return next.slice(-30); // keep last 30 samples
        });
      }
    };

    void load();
    const timer = window.setInterval(load, 5000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  const loading = health === null && noteCount === null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageTitle
          title="Vortex"
          accent="Command Center"
          subtitle="All backend microservices, one engine core — live vitals below."
        />
        <div className="flex items-center gap-2">
          <Chip tone="green">
            <span className="status-dot status-live" /> engine {health?.version ?? '—'}
          </Chip>
          <Chip tone="cyan">{wsConnections ?? 0} ws clients</Chip>
          {getToken() && <Chip tone="blue">jwt active</Chip>}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[228px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <NodeCard
            name="Auth Gateway"
            endpoint="POST /v1/auth/*"
            status="live"
            icon={iconAuth}
            accent="#3379FF"
            metrics={[
              { label: 'hashing', value: 'bcrypt · 12 rounds' },
              { label: 'tokens', value: 'JWT · HS256' },
              { label: 'session', value: 'active' },
            ]}
            footer={<LoadBar color="#3379FF" />}
          />
          <NodeCard
            name="Database Engine"
            endpoint="ANY /v1/db/:table"
            status={noteCount === null ? 'warn' : 'live'}
            icon={iconDb}
            accent="#00E6A6"
            metrics={[
              { label: 'driver', value: 'postgresql · knex' },
              { label: 'notes rows', value: noteCount === null ? 'n/a' : String(noteCount) },
              { label: 'rbac', value: 'owner-scoped' },
            ]}
            footer={<LoadBar color="#00E6A6" delay={0.4} />}
          />
          <NodeCard
            name="Realtime Hub"
            endpoint="WS /v1/realtime"
            status={health ? 'live' : 'warn'}
            icon={iconRt}
            accent="#00D2FF"
            metrics={[
              { label: 'connections', value: String(wsConnections ?? health?.realtime.connections ?? 0) },
              { label: 'fan-out', value: 'pub/sub · ~4ms' },
              { label: 'heartbeat', value: '30s sweep' },
            ]}
            footer={<LoadBar color="#00D2FF" delay={0.8} />}
          />
          <NodeCard
            name="Storage Gateway"
            endpoint="ANY /v1/storage"
            status={objects === null ? 'warn' : 'live'}
            icon={iconStore}
            accent="#FFA1C5"
            metrics={[
              { label: 'driver', value: 'local disk' },
              { label: 'objects', value: objects === null ? 'n/a' : String(objects.length) },
              { label: 'usage', value: storageStats ? formatBytes(storageStats.totalSize) : 'n/a' },
              { label: 'presign', value: 'HMAC · 15 min' },
            ]}
            footer={<LoadBar color="#FFA1C5" delay={1.2} />}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Line chart: realtime connection history */}
        <GlassCard className="p-5 lg:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Realtime Connections — Live Trend
          </div>
          {wsHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={wsHistory} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="t" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="connections"
                  stroke="#00D2FF"
                  strokeWidth={2}
                  dot={{ fill: '#00D2FF', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">
              Waiting for realtime connections…
            </div>
          )}
        </GlassCard>

        {/* Pie chart: storage distribution */}
        <GlassCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Storage Distribution
          </div>
          {storageDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={storageDist}
                  cx="50%"
                  cy="50%"
                  outerRadius={75}
                  innerRadius={40}
                  dataKey="value"
                  label={(entry: { name?: string; value?: number }) => `${entry.name ?? ''}: ${entry.value ?? 0}`}
                >
                  {storageDist.map((_, i) => (
                    <Cell key={i} fill={['#3379FF', '#00E6A6', '#00D2FF', '#FFA1C5', '#8b5cf6', '#f59e0b'][i % 6]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-12 text-center text-xs text-slate-500">No storage data</div>
          )}
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Engine Stack
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'runtime', v: 'node · esm' },
              { k: 'database', v: 'postgres 16' },
              { k: 'realtime', v: 'ws pub/sub' },
              { k: 'storage', v: 's3-compatible' },
            ].map((x) => (
              <div
                key={x.k}
                className="rounded-[12px] border border-white/[0.07] bg-surface px-3.5 py-3"
              >
                <div className="text-[10px] uppercase tracking-widest text-slate-500">{x.k}</div>
                <div className="mt-1 font-mono text-[12px] text-slate-200">{x.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-[12px] border border-white/[0.07] bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-slate-400">
            <span className="text-spectrum-green">➜</span> ready — mutate any table and watch the
            Live Stream page. <span className="text-spectrum-cyan">vortex:subscribe</span> to{' '}
            <span className="text-spectrum-coral">table:*</span> for the full firehose.
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Quick Actions
          </div>
          <div className="mt-4 space-y-2.5">
            {[
              { label: 'Open database console', hash: '#/database' },
              { label: 'Watch live event stream', hash: '#/realtime' },
              { label: 'Upload an object', hash: '#/storage' },
              { label: 'Configure OAuth providers', hash: '#/oauth' },
              { label: 'Send a push notification', hash: '#/notifications' },
              { label: 'Deploy an app', hash: '#/apps' },
              { label: 'Inspect access token', hash: '#/auth' },
            ].map((a) => (
              <a
                key={a.hash}
                href={a.hash}
                className="block rounded-[12px] border border-white/[0.07] bg-white/[0.02] px-4 py-2.5 text-[13px] text-slate-300 transition hover:border-interactive-focus/40 hover:bg-interactive-focus/10 hover:text-white"
              >
                {a.label}
                <span className="float-right text-slate-600">→</span>
              </a>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Platform status */}
      <GlassCard className="p-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Platform Status
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          {[
            { label: 'Auth', value: health ? 'Online' : 'Offline', tone: 'green' as const },
            { label: 'Database', value: noteCount !== null ? `${noteCount} rows` : 'Offline', tone: 'green' as const },
            { label: 'Realtime', value: `${wsConnections ?? 0} clients`, tone: 'cyan' as const },
            { label: 'Storage', value: storageStats ? formatBytes(storageStats.totalSize) : 'Offline', tone: 'green' as const },
            { label: 'Edge Cache', value: 'Active', tone: 'green' as const },
            { label: 'Functions', value: 'Ready', tone: 'green' as const },
            { label: 'Push', value: 'Web Push', tone: 'green' as const },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-[12px] border border-white/[0.07] bg-surface px-3 py-3"
            >
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{s.label}</div>
              <div className={`mt-1 text-[12px] font-medium text-${s.tone}-400`}>{s.value}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
