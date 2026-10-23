import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  clearToken,
  getStoredUser,
  getToken,
  isTokenExpired,
  setStoredUser,
  setToken,
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

interface Session {
  user: StoredUser;
  token: string;
}

function pageFromHash(): PageKey {
  const key = window.location.hash.replace(/^#\/?/, '') as PageKey;
  return PAGES.includes(key) ? key : 'overview';
}

/**
 * Restore a persisted session — but only if the JWT is still alive.
 * An expired token is cleared up front so we never flash the dashboard
 * only to 401-storm the user back to login.
 */
function restoreSession(): Session | null {
  const token = getToken();
  const user = getStoredUser();
  if (!token || !user) return null;
  if (isTokenExpired(token)) {
    clearToken();
    return null;
  }
  return { user, token };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => restoreSession());
  const [page, setPage] = useState<PageKey>(pageFromHash);
  const [events, setEvents] = useState<TableEvent[]>([]);
  const [rtStatus, setRtStatus] = useState<RealtimeStatus>('offline');
  const [wsConnections, setWsConnections] = useState<number | null>(null);
  const [client, setClient] = useState<RealtimeClient | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const authed = session !== null;

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
  const signIn = useCallback((next: AuthSession) => {
    setToken(next.token);
    setStoredUser(next.user);
    setSession({ user: next.user, token: next.token });
    setNotice(null);
  }, []);

  const signOut = useCallback((reason?: string) => {
    clearToken();
    setSession(null);
    setEvents([]);
    setRtStatus('offline');
    setClient(null);
    setNotice(
      reason === 'expired'
        ? 'Your session expired — please sign in again.'
        : null,
    );
    window.location.hash = '#/overview';
  }, []);

  // Auto-logout events (401 with the current token) land here.
  useEffect(() => {
    const onLogout = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: string }>).detail?.reason;
      signOut(reason);
    };
    window.addEventListener('vortex:logout', onLogout);
    return () => window.removeEventListener('vortex:logout', onLogout);
  }, [signOut]);

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
        return <AuthPage user={session?.user ?? null} onLogout={() => signOut()} />;
      default:
        return <Overview wsConnections={wsConnections} />;
    }
  }, [page, client, rtStatus, events, clearEvents, session, signOut, wsConnections]);

  return (
    <>
      <Background />
      {!authed ? (
        <Login onLogin={signIn} notice={notice} />
      ) : (
        <div className="min-h-screen">
          <Sidebar
            active={page}
            onNavigate={navigate}
            email={session.user.email}
            engineOnline={rtStatus === 'online'}
            onLogout={() => signOut()}
          />
          <main className="ml-[248px] min-h-screen p-8">{content}</main>
        </div>
      )}
    </>
  );
}
