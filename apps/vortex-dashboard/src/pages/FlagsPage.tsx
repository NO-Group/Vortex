import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { api, ApiError, type FeatureFlag } from '../lib/api.js';
import {
  Banner,
  Chip,
  GlassCard,
  GlassButton,
  GlassInput,
  GradientButton,
  PageTitle,
  Skeleton,
} from '../components/Glass.js';
import { formatDateTime } from '../lib/format.js';

const STATUS_TONES: Record<string, 'default' | 'cyan' | 'green' | 'coral' | 'blue'> = {
  on: 'green',
  off: 'coral',
  gradual: 'blue',
};

const STATUS_LABELS: Record<string, string> = {
  on: 'On',
  off: 'Off',
  gradual: 'Gradual',
};

export default function FlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create form
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('off');
  const [rolloutPercentage, setRolloutPercentage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ flags: FeatureFlag[] }>('/v1/flags');
      setFlags(res.flags);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load flags');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    try {
      await api.post('/v1/flags', {
        key: key.trim(),
        description: description.trim() || undefined,
        status: status as 'off' | 'on' | 'gradual',
        rolloutPercentage: rolloutPercentage ? Number(rolloutPercentage) : undefined,
      });
      setKey('');
      setDescription('');
      setStatus('off');
      setRolloutPercentage('');
      setNotice('Flag created.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create flag');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (flag: FeatureFlag, newStatus: 'off' | 'on' | 'gradual') => {
    try {
      await api.patch(`/v1/flags/${flag.id}`, { status: newStatus });
      setNotice(`Flag "${flag.key}" set to ${STATUS_LABELS[newStatus]}.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update flag');
    }
  };

  const handleDelete = async (flag: FeatureFlag) => {
    if (!confirm(`Delete flag "${flag.key}"? This cannot be undone.`)) return;
    try {
      await api.del(`/v1/flags/${flag.id}`);
      setNotice(`Flag "${flag.key}" deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete flag');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageTitle
        title="Feature Flags"
        accent=""
        subtitle="Remote config, gradual rollouts, and A/B testing. Toggle features without redeploying."
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Create form */}
        <GlassCard className="p-5">
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Create Flag</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Key</label>
              <GlassInput
                type="text"
                value={key}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setKey(e.target.value)}
                placeholder="new-dashboard"
                maxLength={100}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Description</label>
              <GlassInput
                type="text"
                value={description}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--vt-border, rgba(255,255,255,0.1))',
                    color: 'var(--vt-text, #fff)',
                    fontSize: '13px',
                  }}
                >
                  <option value="off">Off</option>
                  <option value="on">On</option>
                  <option value="gradual">Gradual</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Rollout %</label>
                <GlassInput
                  type="number"
                  value={rolloutPercentage}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setRolloutPercentage(e.target.value)}
                  placeholder="0-100"
                  min="0"
                  max="100"
                  style={{ display: status === 'gradual' ? 'block' : 'none' }}
                />
              </div>
            </div>
            <GradientButton type="submit" disabled={busy || !key.trim()} className="w-full">
              {busy ? 'Creating…' : 'Create Flag'}
            </GradientButton>
          </form>
        </GlassCard>

        {/* Flags list */}
        <GlassCard className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Flags ({flags.length})</h3>
            <GlassButton onClick={load} className="btn-secondary">Refresh</GlassButton>
          </div>

          {loading ? (
            <Skeleton className="h-24" />
          ) : flags.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--vt-text-dim, #9ca3af)' }}>
              No flags yet. Create one to start controlling features.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {flags.map((flag) => (
                <div
                  key={flag.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid var(--vt-border, rgba(255,255,255,0.08))',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 600 }}>{flag.key}</span>
                      <Chip tone={STATUS_TONES[flag.status] ?? 'default'}>
                        {STATUS_LABELS[flag.status]}
                        {flag.status === 'gradual' && flag.rollout_percentage != null && ` ${flag.rollout_percentage}%`}
                      </Chip>
                    </div>
                    {flag.description && (
                      <div style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px' }}>
                        {flag.description}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px' }}>
                      Updated {formatDateTime(flag.updated_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {flag.status !== 'on' && (
                      <GlassButton onClick={() => handleToggle(flag, 'on')} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                        On
                      </GlassButton>
                    )}
                    {flag.status !== 'off' && (
                      <GlassButton onClick={() => handleToggle(flag, 'off')} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                        Off
                      </GlassButton>
                    )}
                    {flag.status !== 'gradual' && (
                      <GlassButton onClick={() => handleToggle(flag, 'gradual')} className="btn-secondary" style={{ fontSize: '11px', padding: '4px 10px' }}>
                        Gradual
                      </GlassButton>
                    )}
                    <GlassButton
                      onClick={() => handleDelete(flag)}
                      className="btn-secondary"
                      style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--spectrum-coral, #f87171)' }}
                    >
                      Delete
                    </GlassButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
