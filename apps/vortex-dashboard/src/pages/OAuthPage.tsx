import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { GlassCard, GlassButton, PageTitle, Chip, Banner, StatusDot } from '../components/Glass.js';

const ALL_PROVIDERS = [
  { name: 'google', label: 'Google', color: '#EA4335', icon: 'G' },
  { name: 'github', label: 'GitHub', color: '#333', icon: '' },
  { name: 'gitlab', label: 'GitLab', color: '#FC6D26', icon: '' },
  { name: 'discord', label: 'Discord', color: '#5865F2', icon: '' },
  { name: 'apple', label: 'Apple', color: '#333', icon: '' },
  { name: 'microsoft', label: 'Microsoft', color: '#0078D4', icon: '' },
];

interface Provider {
  id: string;
  name: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  scopes: string;
  extra: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Account {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  providerEmail: string | null;
  linkedAt: string;
}

const blankProvider = () => ({
  name: 'google' as string,
  clientId: '',
  clientSecret: '',
  scopes: '',
  extra: {} as Record<string, unknown>,
  enabled: true,
  displayName: '',
});

export function OAuthPage({ isAdmin }: { isAdmin: boolean }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState(blankProvider());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [providersRes, accountsRes] = await Promise.all([
        isAdmin
          ? api.get<{ providers: Provider[] }>('/v1/auth/oauth/admin/providers')
          : Promise.resolve({ providers: [] }),
        api.get<{ accounts: Account[] }>('/v1/auth/oauth/accounts'),
      ]);
      setProviders(providersRes.providers ?? []);
      setAccounts(accountsRes.accounts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    if (!form.clientId.trim() || !form.clientSecret.trim()) {
      setError('Client ID and Client Secret are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/v1/auth/oauth/admin/providers', {
        name: form.name,
        clientId: form.clientId,
        clientSecret: form.clientSecret,
        scopes: form.scopes || undefined,
        extra: form.extra,
        enabled: form.enabled,
        displayName: form.displayName || undefined,
      });
      setNotice(`Provider "${form.name}" saved`);
      setForm(blankProvider());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (name: string) => {
    if (!window.confirm(`Remove ${name} provider? Linked accounts will be unlinked.`)) return;
    try {
      await api.del(`/v1/auth/oauth/admin/providers/${name}`);
      setNotice(`Provider "${name}" removed`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const unlink = async (provider: string) => {
    if (!window.confirm(`Unlink ${provider} from your account?`)) return;
    try {
      await api.del(`/v1/auth/oauth/accounts/${provider}`);
      setNotice(`${provider} unlinked`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink');
    }
  };

  const startLogin = (provider: string) => {
    window.location.href = `/v1/auth/oauth/${provider}/start?redirect=${encodeURIComponent('/#/auth')}`;
  };

  const configuredNames = new Set(providers.map((p) => p.name));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageTitle
        title="OAuth Providers"
        accent="Engine"
        subtitle="/v1/auth/oauth — sign in with Google, GitHub, GitLab, Discord, Apple, Microsoft"
      />

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      {/* ── Configured providers ──────────────────────────────────────── */}
      <GlassCard className="rounded-[18px] p-6">
        <h2 className="mb-5 text-sm font-semibold tracking-wide text-white">
          Configured Providers {isAdmin && `(${providers.length})`}
        </h2>

        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-12 w-full rounded-xl" />
            <div className="skeleton h-12 w-full rounded-xl" />
          </div>
        ) : providers.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
            <p className="text-[13px] text-slate-400">
              {isAdmin ? 'No providers configured yet. Add one below.' : 'No providers configured by the admin.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {providers.map((p) => {
              const def = ALL_PROVIDERS.find((d) => d.name === p.name);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold text-white"
                    style={{ backgroundColor: def?.color ?? '#333' }}
                  >
                    {def?.icon ?? p.displayName[0]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-white">{p.displayName}</span>
                      {p.enabled ? (
                        <Chip tone="green"><StatusDot status="live" /> enabled</Chip>
                      ) : (
                        <Chip tone="default"><StatusDot status="off" /> disabled</Chip>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-slate-500">
                      client: {p.clientId.slice(0, 20)}… · scopes: {p.scopes}
                    </span>
                  </div>
                  {isAdmin && (
                    <GlassButton onClick={() => void remove(p.name)} className="px-3 py-1 text-[11px]">
                      remove
                    </GlassButton>
                  )}
                  {!isAdmin && p.enabled && (
                    <GlassButton onClick={() => startLogin(p.name)} className="px-3 py-1 text-[11px]">
                      Sign in
                    </GlassButton>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* ── Your linked accounts ──────────────────────────────────────── */}
      <GlassCard className="rounded-[18px] p-6">
        <h2 className="mb-5 text-sm font-semibold tracking-wide text-white">
          Your Linked Accounts
        </h2>

        {accounts.length === 0 ? (
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-6 text-center">
            <p className="text-[13px] text-slate-400">
              No OAuth accounts linked yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acc) => {
              const def = ALL_PROVIDERS.find((d) => d.name === acc.provider);
              return (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"
                >
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold text-white"
                    style={{ backgroundColor: def?.color ?? '#333' }}
                  >
                    {def?.icon ?? acc.provider[0]}
                  </div>
                  <div className="flex-1">
                    <span className="text-[13px] font-medium text-white">{def?.label ?? acc.provider}</span>
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      {acc.providerEmail ?? acc.providerUserId}
                    </span>
                  </div>
                  <GlassButton onClick={() => void unlink(acc.provider)} className="px-3 py-1 text-[11px]">
                    unlink
                  </GlassButton>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {/* ── Admin: Add provider form ───────────────────────────────────── */}
      {isAdmin && (
        <GlassCard className="rounded-[18px] p-6">
          <h2 className="mb-5 text-sm font-semibold tracking-wide text-white">
            Add / Update Provider
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Provider</span>
              <select
                value={form.name}
                onChange={(e) => {
                  const def = ALL_PROVIDERS.find((d) => d.name === e.target.value);
                  setForm({ ...form, name: e.target.value, displayName: def?.label ?? '' });
                }}
                className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
              >
                {ALL_PROVIDERS.map((d) => (
                  <option key={d.name} value={d.name}>{d.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Display Name</span>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="Google"
                className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Client ID</span>
              <input
                type="text"
                value={form.clientId}
                onChange={(e) => setForm({ ...form, clientId: e.target.value })}
                placeholder="xxxxxxxx.apps.googleusercontent.com"
                className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Client Secret</span>
              <input
                type="password"
                value={form.clientSecret}
                onChange={(e) => setForm({ ...form, clientSecret: e.target.value })}
                placeholder="••••••••••••••••"
                className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Scopes (optional — defaults to provider default)</span>
              <input
                type="text"
                value={form.scopes}
                onChange={(e) => setForm({ ...form, scopes: e.target.value })}
                placeholder="openid profile email"
                className="input-vortex w-full rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <GlassButton onClick={() => void save()} disabled={saving} className="px-5 py-2">
              {saving ? 'Saving…' : 'Save Provider'}
            </GlassButton>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Available:</span>
            {ALL_PROVIDERS.map((d) => (
              <span
                key={d.name}
                className={`rounded-md border px-2 py-0.5 font-mono text-[10px] ${
                  configuredNames.has(d.name)
                    ? 'border-spectrum-green/30 bg-spectrum-green/10 text-spectrum-green'
                    : 'border-white/[0.07] bg-white/[0.02] text-slate-500'
                }`}
              >
                {d.label}
              </span>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
