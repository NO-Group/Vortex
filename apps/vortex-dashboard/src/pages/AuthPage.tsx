import { useEffect, useState } from 'react';
import {
  api,
  getToken,
  type StoredUser,
} from '../lib/api.js';
import { decodeJwt, formatDateTime } from '../lib/format.js';
import { Banner, Chip, GlassCard, PageTitle, StatusDot } from '../components/Glass.js';

export function AuthPage({ user, onLogout }: { user: StoredUser | null; onLogout: () => void }) {
  const [profile, setProfile] = useState<StoredUser | null>(user);
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    setClaims(token ? decodeJwt(token) : null);
    void (async () => {
      try {
        const res = await api.get<{ user: StoredUser }>('/v1/auth/me');
        setProfile(res.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load profile');
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Auth &"
        accent="Token"
        subtitle="JWT identity, claims, and session state for this console connection."
      />

      {error && <Banner tone="error">{error}</Banner>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Session
            </div>
            <Chip tone="green">
              <StatusDot status="live" /> authenticated
            </Chip>
          </div>

          {profile && (
            <div className="mt-4 space-y-3">
              {[
                { label: 'user id', value: profile.id },
                { label: 'email', value: profile.email },
                { label: 'role', value: profile.role },
                { label: 'created', value: formatDateTime(profile.createdAt) },
              ].map((row) => (
                <div key={row.label} className="rounded-[12px] border border-white/[0.07] bg-surface px-4 py-2.5">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">{row.label}</div>
                  <div className="mt-0.5 break-all font-mono text-[12px] text-slate-200">{row.value}</div>
                </div>
              ))}
              {Object.keys(profile.metadata ?? {}).length > 0 && (
                <div className="rounded-[12px] border border-white/[0.07] bg-surface px-4 py-2.5">
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">metadata</div>
                  <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px] text-spectrum-mint">
                    {JSON.stringify(profile.metadata, null, 2)}
                  </pre>
                </div>
              )}
              <button
                onClick={onLogout}
                className="btn-glass w-full px-4 py-2.5 text-sm text-spectrum-coral"
              >
                End session & sign out
              </button>
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            JWT Claims (decoded, unverified)
          </div>
          <div className="console-core mt-4 p-4">
            <pre className="whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-spectrum-cyan">
              {claims ? JSON.stringify(claims, null, 2) : '// no token in session'}
            </pre>
          </div>
          <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-slate-500">
            <p>
              Access tokens are signed HS256 JWTs issued by{' '}
              <span className="font-mono text-slate-400">/v1/auth</span> and verified by every
              gateway before a request touches data.
            </p>
            <p>
              The realtime hub accepts the same token via{' '}
              <span className="font-mono text-slate-400">?token=</span> or a{' '}
              <span className="font-mono text-slate-400">vortex:auth</span> frame.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
