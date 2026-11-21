import { useState, useEffect, useCallback } from 'react';
import type { AuthUser } from '../api';
import { api, type StorageObject } from '../api';
import { Sidebar } from './Sidebar';
import { Overview } from './views/Overview';
import { DatabaseView } from './views/DatabaseView';
import { StorageView } from './views/StorageView';
import { RealtimeView } from './views/RealtimeView';

/**
 * Vortex Dashboard — Post-auth console.
 *
 * A glassmorphic command center with sidebar navigation for:
 *  - Overview: service health and quick stats
 *  - Database: table explorer with CRUD
 *  - Storage: object browser with upload/delete
 *  - Realtime: WebSocket connection monitor and event stream
 */

type View = 'overview' | 'database' | 'storage' | 'realtime';

export function Dashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const [view, setView] = useState<View>('overview');

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <BackgroundGlow />

      <div className="relative z-10 flex min-h-screen">
        <Sidebar
          user={user}
          currentView={view}
          onNavigate={setView}
          onLogout={onLogout}
        />

        <main className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="mx-auto max-w-6xl animate-fade-in">
            {view === 'overview' && <Overview />}
            {view === 'database' && <DatabaseView />}
            {view === 'storage' && <StorageView />}
            {view === 'realtime' && <RealtimeView />}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ── Background Glow ──────────────────────────────────────────────────────── */

function BackgroundGlow() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="grid-bg absolute inset-0 opacity-40" />
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '500px',
          height: '500px',
          top: '-150px',
          right: '-150px',
          background: 'radial-gradient(circle, #004BFF 0%, transparent 70%)',
          opacity: 0.1,
        }}
      />
      <div
        className="orb animate-glow-pulse"
        style={{
          width: '400px',
          height: '400px',
          bottom: '-100px',
          left: '-100px',
          background: 'radial-gradient(circle, #00D2FF 0%, transparent 70%)',
          opacity: 0.08,
          animationDelay: '3s',
        }}
      />
    </div>
  );
}
