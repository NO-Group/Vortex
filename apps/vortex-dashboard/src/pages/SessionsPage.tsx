import { useState, useEffect, useCallback } from 'react';
import { GlassCard, PageTitle } from '../components/Glass.js';

interface UserSession {
  id: string;
  sessionId: string;
  userAgent: string | null;
  ipAddress: string | null;
  deviceType: string | null;
  lastActiveAt: string;
  createdAt: string;
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('vortex_token');
      const res = await fetch('/v1/auth/sessions', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      } else {
        setError('Failed to load sessions');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const revokeSession = async (sessionId: string) => {
    const token = localStorage.getItem('vortex_token');
    await fetch('/v1/auth/sessions/revoke', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });
    setSessions(s => s.filter(s => s.sessionId !== sessionId));
  };

  const revokeAll = async () => {
    const token = localStorage.getItem('vortex_token');
    await fetch('/v1/auth/sessions/revoke-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchSessions();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageTitle title="Active Sessions" subtitle="Manage and revoke your active sessions" />
        {sessions.length > 1 && (
          <button
            onClick={revokeAll}
            className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
          >
            Revoke All Other Sessions
          </button>
        )}
      </div>

      {loading ? (
        <GlassCard><div className="p-8 text-center text-gray-500">Loading sessions…</div></GlassCard>
      ) : error ? (
        <GlassCard>
          <div className="p-4 text-red-400 text-sm">{error}</div>
        </GlassCard>
      ) : sessions.length === 0 ? (
        <GlassCard>
          <div className="p-8 text-center text-gray-500">No active sessions found</div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((s) => (
            <GlassCard key={s.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-white">{s.deviceType ?? 'Unknown Device'}</div>
                <button
                  onClick={() => revokeSession(s.sessionId)}
                  className="px-3 py-1 rounded-md text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition"
                >
                  Revoke
                </button>
              </div>
              <div className="space-y-1 text-sm">
                <div className="text-gray-400">IP: <span className="text-gray-300 font-mono">{s.ipAddress ?? 'Unknown'}</span></div>
                <div className="text-gray-400">Browser: <span className="text-gray-300">{s.userAgent ?? 'Unknown'}</span></div>
                <div className="text-gray-500 text-xs">Last active: {formatRelative(s.lastActiveAt)}</div>
                <div className="text-gray-500 text-xs">Created: {formatRelative(s.createdAt)}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
