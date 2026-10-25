import { useCallback, useEffect, useState } from 'react';
import {
  api,
  ApiError,
  type AuditEntry,
  type AuditStats,
} from '../lib/api.js';
import {
  Banner,
  Chip,
  GlassCard,
  GlassButton,
  PageTitle,
  Skeleton,
} from '../components/Glass.js';
import { formatDateTime, shortId } from '../lib/format.js';

const ACTION_TONES: Record<string, string> = {
  'database.insert': 'green',
  'database.upsert': 'green',
  'database.update': 'blue',
  'database.delete': 'coral',
  'storage.upload': 'green',
  'storage.delete': 'coral',
  'auth.signup': 'blue',
  'apps.deploy': 'green',
  'functions.deploy': 'green',
};

const ACTION_TONES_TYPED: Record<string, 'default' | 'cyan' | 'green' | 'coral' | 'blue'> = {
  'database.insert': 'green',
  'database.upsert': 'green',
  'database.update': 'blue',
  'database.delete': 'coral',
  'storage.upload': 'green',
  'storage.delete': 'coral',
  'auth.signup': 'blue',
  'apps.deploy': 'green',
  'functions.deploy': 'green',
};

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async () => {
    try {
      const [logRes, statsRes] = await Promise.all([
        api.get<{ entries: AuditEntry[] }>('/v1/audit/log?limit=100'),
        api.get<AuditStats>('/v1/audit/stats'),
      ]);
      setEntries(logRes.entries);
      setStats(statsRes);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!autoRefresh) return;
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load, autoRefresh]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <PageTitle title="Audit Trail" subtitle="Every mutation is recorded: who, what, and when." />
        <GlassButton onClick={load} className="btn-secondary">
          Refresh
        </GlassButton>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {/* Stats row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <GlassCard className="p-[18px]">
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--vt-text-dim, #9ca3af)' }}>Total Actions</div>
            <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '6px' }}>{stats.totalActions}</div>
          </GlassCard>

          <GlassCard className="p-[18px]">
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--vt-text-dim, #9ca3af)' }}>Last Active</div>
            <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '6px' }}>
              {stats.lastActive ? formatDateTime(stats.lastActive) : '—'}
            </div>
          </GlassCard>

          <GlassCard className="p-[18px]">
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--vt-text-dim, #9ca3af)' }}>By Action</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
              {Object.entries(stats.byAction).slice(0, 6).map(([action, count]) => (
                <Chip key={action} tone={ACTION_TONES_TYPED[action] ?? 'default'}>{action} ({count})</Chip>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Auto-refresh toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          id="auto-refresh"
          checked={autoRefresh}
          onChange={(e) => setAutoRefresh(e.target.checked)}
          style={{ accentColor: 'var(--vt-accent, #6366f1)' }}
        />
        <label htmlFor="auto-refresh" style={{ fontSize: '13px', color: 'var(--vt-text-dim, #9ca3af)' }}>
          Auto-refresh (15s)
        </label>
      </div>

      {/* Log table */}
      <GlassCard className="overflow-hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--vt-border, rgba(255,255,255,0.08))' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Activity Log</h3>
          <span style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)' }}>{entries.length} entries</span>
        </div>

        {loading ? (
          <div style={{ padding: '18px' }}>
            <Skeleton className="h-24" />
          </div>
        ) : entries.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--vt-text-dim, #9ca3af)' }}>
            No activity yet. Mutations will appear here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--vt-border, rgba(255,255,255,0.08))' }}>
                  <th style={th}>Action</th>
                  <th style={th}>Resource</th>
                  <th style={th}>User</th>
                  <th style={th}>Role</th>
                  <th style={th}>When</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--vt-border, rgba(255,255,255,0.04))' }}>
                    <td>
                      <Chip tone={ACTION_TONES_TYPED[entry.action] ?? 'default'}>{entry.action}</Chip>
                    </td>
                    <td style={td}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{entry.resource_type}</span>
                      {entry.resource_id && <span style={{ color: 'var(--vt-text-dim, #9ca3af)' }}> / {entry.resource_id}</span>}
                    </td>
                    <td style={td}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{shortId(entry.user_id)}</span>
                    </td>
                    <td style={td}>
                      <Chip tone={entry.role === 'admin' ? 'coral' : 'default'}>{entry.role}</Chip>
                    </td>
                    <td style={td}>{formatDateTime(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 18px',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--vt-text-dim, #9ca3af)',
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: '10px 18px',
  verticalAlign: 'middle',
};
