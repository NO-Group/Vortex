import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  api,
  ApiError,
  type ApiKey,
  type ApiKeyCreateResult,
} from '../lib/api.js';
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
import { formatDateTime, shortId } from '../lib/format.js';

const SCOPES = [
  'database:read',
  'database:write',
  'storage:read',
  'storage:write',
  'functions:read',
  'functions:write',
  'apps:read',
  'apps:write',
  'notifications:read',
  'notifications:write',
  'webhooks:read',
  'webhooks:write',
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Create form
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // New key display
  const [newKey, setNewKey] = useState<ApiKeyCreateResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get<{ apiKeys: ApiKey[] }>('/v1/api-keys');
      setKeys(res.apiKeys);
      setError('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleScopeToggle = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await api.post<{ apiKey: ApiKeyCreateResult }>('/v1/api-keys', {
        name: name.trim(),
        scopes: selectedScopes.length > 0 ? selectedScopes : undefined,
      });
      setNewKey(res.apiKey);
      setName('');
      setSelectedScopes([]);
      setNotice('API key created. Copy it now — it won\'t be shown again.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create API key');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await api.del(`/v1/api-keys/${id}`);
      setNotice('API key revoked.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to revoke API key');
    }
  };

  const handleCopyKey = () => {
    if (!newKey) return;
    navigator.clipboard?.writeText(newKey.key);
    setNotice('Key copied to clipboard.');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <PageTitle title="API Keys" subtitle="Server-to-server authentication. Create keys for automated systems and backend services." />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* New key display */}
      {newKey && (
        <GlassCard className="p-5 border-spectrum-green/40 bg-spectrum-green/5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>New API Key</h3>
            <GlassButton onClick={handleCopyKey} className="btn-secondary">
              Copy
            </GlassButton>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '13px', padding: '10px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', wordBreak: 'break-all' }}>
            {newKey.key}
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)' }}>
            Copy this key now. It will not be shown again.
          </p>
        </GlassCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Create form */}
        <GlassCard className="p-5">
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600 }}>Create API Key</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>Name</label>
              <GlassInput
                type="text"
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                placeholder="production-server"
                maxLength={100}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', display: 'block', marginBottom: '6px' }}>
                Scopes (optional)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {SCOPES.map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => handleScopeToggle(scope)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11px',
                      borderRadius: '20px',
                      border: '1px solid',
                      borderColor: selectedScopes.includes(scope)
                        ? 'var(--vt-accent, #6366f1)'
                        : 'var(--vt-border, rgba(255,255,255,0.1))',
                      background: selectedScopes.includes(scope)
                        ? 'var(--vt-accent-bg, rgba(99,102,241,0.15))'
                        : 'transparent',
                      color: selectedScopes.includes(scope)
                        ? 'var(--vt-accent, #6366f1)'
                        : 'var(--vt-text-dim, #9ca3af)',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      transition: 'all 0.15s',
                    }}
                  >
                    {scope}
                  </button>
                ))}
              </div>
            </div>
            <GradientButton type="submit" disabled={busy || !name.trim()} className="w-full">
              {busy ? 'Creating…' : 'Create Key'}
            </GradientButton>
          </form>
        </GlassCard>

        {/* Keys list */}
        <GlassCard className="p-5">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Active Keys</h3>
            <GlassButton onClick={load} className="btn-secondary">Refresh</GlassButton>
          </div>

          {loading ? (
            <Skeleton className="h-24" />
          ) : keys.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--vt-text-dim, #9ca3af)' }}>
              No API keys yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {keys.map((key) => (
                <div
                  key={key.id}
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
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{key.name}</span>
                      {key.scopes && key.scopes.length > 0 && (
                        <span style={{ display: 'flex', gap: '4px' }}>
                          {key.scopes.slice(0, 2).map((s) => (
                            <Chip key={s} tone="cyan">{s}</Chip>
                          ))}
                          {key.scopes.length > 2 && (
                            <Chip tone="default">+{key.scopes.length - 2}</Chip>
                          )}
                        </span>
                      )}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--vt-text-dim, #9ca3af)', marginTop: '4px' }}>
                      {key.key_prefix}… · {formatDateTime(key.created_at)}
                      {key.last_used_at && ` · last used ${formatDateTime(key.last_used_at)}`}
                    </div>
                  </div>
                  <GlassButton
                    onClick={() => handleRevoke(key.id)}
                    className="btn-secondary"
                    style={{ color: 'var(--spectrum-coral, #f87171)' }}
                  >
                    Revoke
                  </GlassButton>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
