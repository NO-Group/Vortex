import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  api,
  clearToken,
  getStoredUser,
  getToken,
  isTokenExpired,
  markSignIn,
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
import { SqlPage } from './pages/SqlPage.js';
import { RealtimePage } from './pages/RealtimePage.js';
import { StoragePage } from './pages/StoragePage.js';
import { AppsPage } from './pages/AppsPage.js';
import { FunctionsPage } from './pages/FunctionsPage.js';
import { AuthPage } from './pages/AuthPage.js';
import { PolicyPage } from './pages/PolicyPage.js';

const PAGES: PageKey[] = [
  'overview',
  'database',
  'sql',
  'realtime',
  'storage',
  'apps',
  'functions',
  'auth',
  'policies',
];

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
    markSignIn();
    setSession({ user: next.user, token: next.token });
    setNotice(null);
  }, []);

  const signOut = useCallback((reason?: string, detail?: string) => {
    clearToken();
    setSession(null);
    setEvents([]);
    setRtStatus('offline');
    setClient(null);
    setNotice(
      reason === 'expired'
        ? `Session ended: ${detail ?? 'your session expired'} — please sign in again.`
        : null,
    );
    window.location.hash = '#/overview';
  }, []);

  // Auto-logout events (401 with the current token) land here.
  useEffect(() => {
    const onLogout = (e: Event) => {
      const d = (e as CustomEvent<{ reason?: string; path?: string; message?: string }>).detail;
      signOut(d?.reason, d?.path ? `${d.message ?? 'unauthorized'} (${d.path})` : d?.message);
    };
    window.addEventListener('vortex:logout', onLogout);
    return () => window.removeEventListener('vortex:logout', onLogout);
  }, [signOut]);

  // ── Email sign-in links (?magic=<token>) verify themselves on load ─────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('magic');
    if (!token) return;
    params.delete('magic');
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', clean);

    void (async () => {
      try {
        const session = await api.post<AuthSession>('/v1/auth/magic-link/verify', { token });
        if (session?.token && session?.user) {
          signIn(session);
          setNotice('Signed in via email link.');
        }
      } catch (err) {
        setNotice(
          `Sign-in link failed: ${err instanceof Error ? err.message : 'invalid or expired'}`,
        );
      }
    })();
  }, [signIn]);

  const clearEvents = useCallback(() => setEvents([]), []);

  const content = useMemo(() => {
    switch (page) {
      case 'database':
        return <DatabasePage />;
      case 'sql':
        return <SqlPage isAdmin={session?.user.role === 'admin'} />;
      case 'realtime':
        return client ? (
          <RealtimePage client={client} status={rtStatus} events={events} onClear={clearEvents} />
        ) : null;
      case 'storage':
        return <StoragePage />;
      case 'apps':
        return <AppsPage />;
      case 'functions':
        return <FunctionsPage />;
      case 'auth':
        return <AuthPage user={session?.user ?? null} onLogout={() => signOut()} />;
      case 'policies':
        return <PolicyPage isAdmin={session?.user.role === 'admin'} />;
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
