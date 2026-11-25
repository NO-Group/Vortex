import { useState, useEffect, useCallback } from 'react';
import { GlassCard, PageTitle, GlassInput } from '../components/Glass.js';

interface PasswordSecurityStatus {
  locked: boolean;
  lockedUntil: string | null;
  failedCount: number;
  attemptsRemaining: number;
}

interface PasswordHistoryEntry {
  id: string;
  createdAt: string;
}

export function PasswordSecurityPage() {
  const [status, setStatus] = useState<PasswordSecurityStatus | null>(null);
  const [history, setHistory] = useState<PasswordHistoryEntry[]>([]);
  const [testPassword, setTestPassword] = useState('');
  const [checkResult, setCheckResult] = useState<{ breached: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('vortex_token');
      const headers = { Authorization: `Bearer ${token}` };

      const [lockRes, histRes] = await Promise.all([
        fetch('/v1/auth/password-security/lockout', { headers }),
        fetch('/v1/auth/password-security/history', { headers }),
      ]);
      if (lockRes.ok) setStatus(await lockRes.json());
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.history || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const checkPassword = async () => {
    if (!testPassword) return;
    const token = localStorage.getItem('vortex_token');
    const res = await fetch(
      `/v1/auth/password-security/check?password=${encodeURIComponent(testPassword)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    setCheckResult(await res.json());
  };

  return (
    <div className="space-y-6">
      <PageTitle title="Password Security" subtitle="Breach detection, password history, and account lockout" />

      {loading ? (
        <GlassCard><div className="p-8 text-center text-gray-500">Loading password security…</div></GlassCard>
      ) : (
        <>
          {/* Lockout Status */}
          {status && (
            <GlassCard>
              <h3 className="text-lg font-semibold text-white mb-3">Account Lockout Status</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className={`text-sm font-semibold ${status.locked ? 'text-red-400' : 'text-green-400'}`}>
                    {status.locked ? 'Locked' : 'Active'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Failed Attempts</div>
                  <div className="text-sm text-white">{status.failedCount}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Attempts Remaining</div>
                  <div className="text-sm text-white">{status.attemptsRemaining}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Locked Until</div>
                  <div className="text-sm text-white">
                    {status.lockedUntil ? new Date(status.lockedUntil).toLocaleString() : '—'}
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Breach Check */}
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-3">Breach Detection</h3>
            <div className="flex gap-2 mb-3">
              <GlassInput
                type="password"
                value={testPassword}
                onChange={e => setTestPassword(e.target.value)}
                placeholder="Enter a password to check…"
              />
              <button
                onClick={checkPassword}
                className="px-4 py-2 rounded-lg text-sm bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition whitespace-nowrap"
              >
                Check
              </button>
            </div>
            {checkResult && (
              <div
                className={`p-3 rounded-lg text-sm font-medium ${
                  checkResult.breached
                    ? 'bg-red-500/10 text-red-400'
                    : 'bg-green-500/10 text-green-400'
                }`}
              >
                {checkResult.breached
                  ? '⚠ This password has been found in a known data breach. Do not use it.'
                  : '✓ This password was not found in any known breach.'}
              </div>
            )}
          </GlassCard>

          {/* Password History */}
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-3">Password History ({history.length})</h3>
            {history.length === 0 ? (
              <p className="text-sm text-gray-500">No password changes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {history.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                  >
                    <span className="text-sm text-gray-300">Password changed</span>
                    <span className="text-xs text-gray-500">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
