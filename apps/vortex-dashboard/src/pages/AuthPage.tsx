import { useCallback, useEffect, useState } from 'react';
import {
  api,
  getToken,
  type StoredUser,
} from '../lib/api.js';
import { decodeJwt, formatDateTime } from '../lib/format.js';
import { Banner, Chip, GlassCard, PageTitle, StatusDot } from '../components/Glass.js';

import { TwoFactorSection } from './TwoFactorSection.js';

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

      <UserAdmin isAdmin={profile?.role === 'admin'} />

      <TwoFactorSection />
    </div>
  );
}

interface AdminUserRow {
  id: string;
  email: string;
  role: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/** Admin-only account management: roles + custom claims. */
function UserAdmin({ isAdmin }: { isAdmin: boolean }) {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [claimsDrafts, setClaimsDrafts] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ users: AdminUserRow[] }>('/v1/auth/users');
      setUsers(res.users);
    } catch (err) {
      setUsers([]);
      setError(err instanceof Error ? err.message : 'Could not list users');
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin, refresh]);

  if (!isAdmin) {
    return (
      <div className="glass flex h-24 items-center justify-center text-[12px] text-slate-500">
        account administration unlocks for <b className="mx-1 text-slate-300">admin</b> roles
      </div>
    );
  }

  const setRole = async (u: AdminUserRow, role: string) => {
    try {
      await api.patch(`/v1/auth/users/${u.id}`, { role });
      setNotice(`${u.email} → ${role}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const saveClaims = async (u: AdminUserRow) => {
    const raw = claimsDrafts[u.id];
    if (raw === undefined) return;
    try {
      const metadata = JSON.parse(raw) as Record<string, unknown>;
      await api.patch(`/v1/auth/users/${u.id}`, { metadata });
      setNotice(`Claims updated for ${u.email} — they land in new JWTs as "meta".`);
      setError(null);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Claims must be valid JSON');
    }
  };

  const remove = async (u: AdminUserRow) => {
    try {
      await api.del(`/v1/auth/users/${u.id}`);
      setNotice(`Deleted ${u.email}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Account administration
        </div>
        <Chip tone="green">admin</Chip>
      </div>

      {error && <Banner tone="error">{error}</Banner>}
      {notice && <Banner tone="ok">{notice}</Banner>}

      <div className="glass overflow-hidden">
        {users === null ? (
          <div className="p-5 text-[12px] text-slate-500">loading accounts…</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>email</th>
                <th>role</th>
                <th>claims</th>
                <th>created</th>
                <th aria-label="actions" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-mono">{u.email}</td>
                  <td>
                    <select
                      value={u.role}
                      onChange={(e) => void setRole(u, e.target.value)}
                      className="input-vortex px-2 py-1 text-[11px]"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <input
                        value={
                          claimsDrafts[u.id] ??
                          (Object.keys(u.metadata ?? {}).length
                            ? JSON.stringify(u.metadata)
                            : '')
                        }
                        onChange={(e) =>
                          setClaimsDrafts((d) => ({ ...d, [u.id]: e.target.value }))
                        }
                        placeholder='{"plan":"pro"}'
                        className="input-vortex w-56 px-2 py-1 font-mono text-[10px]"
                      />
                      <button
                        onClick={() => void saveClaims(u)}
                        className="btn-glass px-2 py-1 text-[10px]"
                      >
                        save
                      </button>
                    </div>
                  </td>
                  <td className="text-slate-500">{formatDateTime(u.createdAt)}</td>
                  <td>
                    <div className="flex justify-end">
                      <button
                        onClick={() => void remove(u)}
                        className="rounded-md px-2 py-0.5 text-[10px] text-slate-500 transition hover:bg-spectrum-coral/10 hover:text-spectrum-coral"
                      >
                        delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
