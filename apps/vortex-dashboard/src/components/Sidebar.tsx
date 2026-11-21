import type { AuthUser } from '../api';

/**
 * Vortex Dashboard — Sidebar navigation.
 *
 * Glassmorphic command center sidebar with the 6-stop gradient accent line.
 */

type View = 'overview' | 'database' | 'storage' | 'realtime';

const NAV_ITEMS: { id: View; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◇' },
  { id: 'database', label: 'Database', icon: '⛁' },
  { id: 'storage', label: 'Storage', icon: '⛁' },
  { id: 'realtime', label: 'Realtime', icon: '⚡' },
];

export function Sidebar({
  user,
  currentView,
  onNavigate,
  onLogout,
}: {
  user: AuthUser;
  currentView: View;
  onNavigate: (view: View) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="glass flex h-screen w-64 flex-shrink-0 flex-col border-r border-white/[0.06] p-4">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-3 px-2">
        <svg className="vortex-logo h-10 w-10" viewBox="0 0 100 100" fill="none">
          <defs>
            <linearGradient id="side-logo" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#004BFF" />
              <stop offset="50%" stopColor="#A38CFF" />
              <stop offset="100%" stopColor="#00D2FF" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="42" stroke="url(#side-logo)" strokeWidth="5" opacity="0.7" />
          <circle cx="50" cy="50" r="24" stroke="url(#side-logo)" strokeWidth="3" opacity="0.5" />
          <circle cx="50" cy="50" r="8" fill="url(#side-logo)" />
        </svg>
        <div>
          <span className="text-gradient text-lg font-bold">Vortex</span>
          <p className="text-[10px] text-white/25">BaaS Console</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`
                group relative flex w-full items-center gap-3 rounded-xl px-4 py-3
                text-sm font-medium transition-all duration-200
                ${active
                  ? 'bg-gradient-to-r from-anchor/15 to-cyber/10 text-white border border-white/10'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.03] border border-transparent'
                }
              `}
            >
              {/* Active gradient accent line */}
              {active && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-anchor to-cyber" />
              )}
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div className="glass mt-4 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-anchor/30 to-cyber/30 text-sm font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-white/30">{user.email}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyber">
            {user.role}
          </span>
          <button
            onClick={onLogout}
            className="text-xs text-white/30 transition-colors hover:text-red-400"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
