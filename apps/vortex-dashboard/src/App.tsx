import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  clearToken,
  getStoredUser,
  getToken,
  type AuthSession,
  type Health,
  type StoredUser,
  type TableEvent,
} from './lib/api.js';
import { RealtimeClient, type RealtimeStatus } from './lib/realtime.js';
import { Background } from './components/Background.js';
import { Sidebar, type PageKey } from './components/Sidebar.js';
import { Login } from './pages/Login.js';
import { Overview } from './pages/Overview.js';
import { DatabasePage } from './pages/DatabasePage.js';
import { RealtimePage } from './pages/RealtimePage.js';
import { StoragePage } from './pages/StoragePage.js';
import { AuthPage } from './pages/AuthPage.js';

const PAGES: PageKey[] = ['overview', 'database', 'realtime', 'storage', 'auth'];

function pageFromHash(): PageKey {
  const key = window.location.hash.replace(/^#\/?/, '') as PageKey;
  return PAGES.includes(key) ? key : 'overview';
}

export default function App() {
  const [user, setUser] = useState<StoredUser | null>(() => getStoredUser());
  const [page, setPage] = useState<PageKey>(pageFromHash);
  const [events, setEvents] = useState<TableEvent[]>([]);
  const [rtStatus, setRtStatus] = useState<RealtimeStatus>('offline');
  const [wsConnections, setWsConnections] = useState<number | null>(null);
  const [client, setClient] = useState<RealtimeClient | null>(null);

  const authed = user !== null && getToken() !== null;

  // ── Realtime client — one WS for the whole session ─────────────────────
  useEffect(() => {
    const token = getToken();
    if (!authed || !token) return;

    const rt = new RealtimeClient({
      onStatus: setRtStatus,
      onEvent: (evt) => setEvents((prev) => [...prev.slice(-299), evt]),
    });
    rt.connect(token);
    rt.subscribe('table:*');
    setClient(rt);

    return () => {
      rt.disconnect();
      setClient(null);
    };
  }, [authed]);

  // ── Engine health polling (live ws-connection vitals) ──────────────────
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    const poll = async () => {
      try {
        const h = await api.get<Health>('/healthz');
        if (alive) setWsConnections(h.realtime.connections);
      } catch {
        /* engine unreachable — sidebar indicator goes dark */
      }
    };
    void poll();
    const t = window.setInterval(poll, 4000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [authed]);

  // ── Hash routing ──────────────────────────────────────────────────────
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((key: PageKey) => {
    window.location.hash = `#/${key}`;
    setPage(key);
  }, []);

  // ── Session lifecycle ─────────────────────────────────────────────────
  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    setEvents([]);
    setRtStatus('offline');
    window.location.hash = '#/overview';
  }, []);

  useEffect(() => {
    const onLogout = () => logout();
    window.addEventListener('vortex:logout', onLogout);
    return () => window.removeEventListener('vortex:logout', onLogout);
  }, [logout]);

  const onLogin = useCallback((session: AuthSession) => {
    setUser(session.user);
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const content = useMemo(() => {
    switch (page) {
      case 'database':
        return <DatabasePage />;
      case 'realtime':
        return client ? (
          <RealtimePage client={client} status={rtStatus} events={events} onClear={clearEvents} />
        ) : null;
      case 'storage':
        return <StoragePage />;
      case 'auth':
        return <AuthPage user={user} onLogout={logout} />;
      default:
        return <Overview wsConnections={wsConnections} />;
    }
  }, [page, client, rtStatus, events, clearEvents, user, logout, wsConnections]);

  return (
    <>
      <Background />
      {!authed ? (
        <Login onLogin={onLogin} />
      ) : (
        <div className="min-h-screen">
          <Sidebar
            active={page}
            onNavigate={navigate}
            email={user?.email ?? ''}
            engineOnline={rtStatus === 'online'}
            onLogout={logout}
          />
          <main className="ml-[248px] min-h-screen p-8">{content}</main>
        </div>
      )}
    </>
  );
}
