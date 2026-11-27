import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import { api } from '../lib/api.js';

interface Capability {
  id: string;
  category: string;
  name: string;
  status: string;
  version?: string;
}

interface CapabilitySummary {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
}

interface AnalyticsEventStat {
  eventName: string;
  count: number;
}

interface ApiUsageStats {
  byMethod: Array<{ method: string; count: number }>;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  errorCount: number;
  avgDurationMs: number;
}

const STATUS_COLORS: Record<string, string> = {
  available: '#10b981',
  beta: '#3b82f6',
  planned: '#f59e0b',
  experimental: '#8b5cf6',
};

const CATEGORY_COLORS = [
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#6366f1', '#0ea5e9', '#f97316', '#14b8a6',
  '#a855f7', '#ef4444', '#22c55e', '#eab308', '#64748b',
];

export function PlatformPage() {
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [summary, setSummary] = useState<CapabilitySummary | null>(null);
  const [eventStats, setEventStats] = useState<AnalyticsEventStat[]>([]);
  const [apiUsage, setApiUsage] = useState<ApiUsageStats | null>(null);
  const [queueStats, setQueueStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [caps, sum, evts, usage, qstats] = await Promise.all([
          api.get<{ capabilities: Capability[] }>('/v1/platform/capabilities'),
          api.get<CapabilitySummary>('/v1/platform/capabilities/summary'),
          api.get<{ stats: AnalyticsEventStat[] }>('/v1/platform/analytics/stats?eventType=app_event').catch(() => null),
          api.get<ApiUsageStats>('/v1/platform/analytics/api-usage').catch(() => null),
          api.get<Record<string, number>>('/v1/platform/queue/stats').catch(() => null),
        ]);
        if (!alive) return;
        if (caps.capabilities) setCapabilities(caps.capabilities);
        if (sum) setSummary(sum);
        if (evts?.stats) setEventStats(evts.stats.slice(0, 10));
        if (usage) setApiUsage(usage);
        if (qstats) setQueueStats(qstats);
      } catch {
        /* platform endpoints may not be seeded yet */
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => { alive = false; };
  }, []);

  // ── Pie chart data: capability status distribution ──
  const statusData = summary?.byStatus
    ? Object.entries(summary.byStatus).map(([name, value]) => ({ name, value }))
    : [];

  // ── Bar chart data: capabilities by category ──
  const categoryData = summary?.byCategory
    ? Object.entries(summary.byCategory).map(([name, value]) => ({ name, value }))
    : [];

  // ── Line chart data: event counts over categories (simulated trend) ──
  const lineData = eventStats.map((e) => ({ name: e.eventName, count: e.count }));

  // ── Queue bar chart ──
  const queueData = Object.entries(queueStats).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Capabilities</h1>
        <p className="mt-1 text-sm text-slate-400">
          Unified engine layer — all 15 capability categories synchronized
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <div className="text-2xl font-bold text-spectrum-cyan">{summary?.total ?? 0}</div>
          <div className="text-xs text-slate-500">Total Capabilities</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <div className="text-2xl font-bold text-emerald-400">{summary?.byStatus?.available ?? 0}</div>
          <div className="text-xs text-slate-500">Available</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <div className="text-2xl font-bold text-blue-400">{summary?.byStatus?.beta ?? 0}</div>
          <div className="text-xs text-slate-500">Beta</div>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 backdrop-blur-xl">
          <div className="text-2xl font-bold text-amber-400">{summary?.byStatus?.planned ?? 0}</div>
          <div className="text-xs text-slate-500">Planned</div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-12 text-center text-slate-500">
          Loading platform data…
        </div>
      ) : (
        <>
          {/* Pie chart: status distribution */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Capability Status Distribution
            </h2>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    innerRadius={50}
                    dataKey="value"
                    label={(entry: { name?: string; value?: number }) => `${entry.name ?? ''}: ${entry.value ?? 0}`}
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#64748b'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center text-slate-500">No capability data seeded yet</div>
            )}
          </div>

          {/* Bar chart: capabilities by category */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              Capabilities by Category
            </h2>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={categoryData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="name"
                    angle={-35}
                    textAnchor="end"
                    height={70}
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    interval={0}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="py-16 text-center text-slate-500">No category data</div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Line chart: event activity */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Analytics — Event Activity
              </h2>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={lineData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <defs>
                      <linearGradient id="eventGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#eventGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-16 text-center text-slate-500">No analytics events recorded</div>
              )}
            </div>

            {/* Bar chart: API usage by method */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                API Usage by Method
              </h2>
              {apiUsage && apiUsage.byMethod.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={apiUsage.byMethod} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="method" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(15, 23, 42, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {apiUsage.byMethod.map((_, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="py-16 text-center text-slate-500">No API usage data</div>
              )}
            </div>
          </div>

          {/* Queue stats bar chart */}
          {queueData.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
                Job Queue Status
              </h2>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={queueData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                    }}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {queueData.map((_, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Capability table */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 backdrop-blur-xl">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              All Capabilities
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] text-left text-xs text-slate-500">
                    <th className="py-2 pr-4 font-medium">ID</th>
                    <th className="py-2 pr-4 font-medium">Category</th>
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {capabilities.slice(0, 50).map((cap) => (
                    <tr key={cap.id} className="border-b border-white/[0.04]">
                      <td className="py-2 pr-4 font-mono text-xs text-slate-400">{cap.id}</td>
                      <td className="py-2 pr-4 text-slate-300">{cap.category}</td>
                      <td className="py-2 pr-4 text-slate-200">{cap.name}</td>
                      <td className="py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: `${STATUS_COLORS[cap.status] ?? '#64748b'}20`,
                            color: STATUS_COLORS[cap.status] ?? '#64748b',
                          }}
                        >
                          {cap.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
