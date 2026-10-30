import type { ReactElement } from 'react';
import { StatusDot } from './Glass.js';

export type PageKey =
  | 'overview'
  | 'database'
  | 'sql'
  | 'realtime'
  | 'storage'
  | 'apps'
  | 'functions'
  | 'auth'
  | 'policies'
  | 'oauth'
  | 'notifications'
  | 'webhooks'
  | 'audit'
  | 'api-keys'
  | 'flags'
  | 'vector'
  | 'cron'
  | 'shield'
  | 'media';

interface NavItem {
  key: PageKey;
  label: string;
  hint: string;
  icon: ReactElement;
}

const icons: Record<PageKey, ReactElement> = {
  overview: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="7" height="9" rx="2" />
      <rect x="14" y="3" width="7" height="5" rx="2" />
      <rect x="14" y="12" width="7" height="9" rx="2" />
      <rect x="3" y="16" width="7" height="5" rx="2" />
    </svg>
  ),
  database: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  ),
  realtime: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12h4l3-8 4 16 3-8h6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  storage: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8" />
      <path d="M2 8l10-5 10 5-10 5L2 8z" strokeLinejoin="round" />
    </svg>
  ),
  apps: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <circle cx="17" cy="17" r="4" />
    </svg>
  ),
  sql: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  ),
  functions: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" strokeLinejoin="round" />
    </svg>
  ),
  policies: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 12c0 5-3.5 7.5-8.5 9C7.5 19.5 4 17 4 12V6l8.5-3L21 6v6z" strokeLinejoin="round" />
    </svg>
  ),
  oauth: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" strokeLinecap="round" />
    </svg>
  ),
  auth: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 1 1 8 0v3" />
    </svg>
  ),
  notifications: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  webhooks: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  ),
  audit: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  'api-keys': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3" />
    </svg>
  ),
  flags: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  vector: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M19 5l-2.5 2.5M7.5 16.5L5 19" />
    </svg>
  ),
  cron: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" />
    </svg>
  ),
  shield: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5l8-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  media: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none" />
    </svg>
  ),
};

const items: Array<{ key: PageKey; label: string; hint: string }> = [
  { key: 'overview', label: 'Command Center', hint: 'engine vitals' },
  { key: 'database', label: 'Database', hint: '/v1/db' },
  { key: 'sql', label: 'SQL Console', hint: '/v1/sql' },
  { key: 'realtime', label: 'Live Stream', hint: '/v1/realtime' },
  { key: 'storage', label: 'Storage', hint: '/v1/storage' },
  { key: 'apps', label: 'Apps', hint: 'hosting' },
  { key: 'functions', label: 'Functions', hint: '/functions' },
  { key: 'auth', label: 'Auth & Token', hint: '/v1/auth' },
  { key: 'policies', label: 'Policies', hint: '/v1/policies' },
  { key: 'oauth', label: 'OAuth', hint: '/v1/auth/oauth' },
  { key: 'notifications', label: 'Push', hint: '/v1/notifications' },
  { key: 'webhooks', label: 'Webhooks', hint: '/v1/webhooks' },
  { key: 'audit', label: 'Audit Trail', hint: '/v1/audit' },
  { key: 'api-keys', label: 'API Keys', hint: '/v1/api-keys' },
  { key: 'flags', label: 'Feature Flags', hint: '/v1/flags' },
  { key: 'vector', label: 'Vector Search', hint: '/v1/vector' },
  { key: 'cron', label: 'Scheduled Jobs', hint: '/v1/cron' },
  { key: 'shield', label: 'Shield', hint: '/v1/shield' },
  { key: 'media', label: 'Media', hint: '/v1/storage' },
];

export function Sidebar({
  active,
  onNavigate,
  email,
  engineOnline,
  onLogout,
}: {
  active: PageKey;
  onNavigate: (key: PageKey) => void;
  email: string;
  engineOnline: boolean;
  onLogout: () => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[248px] flex-col border-r border-white/[0.07] bg-white/[0.04] backdrop-blur-2xl">
      {/* neon tracking line */}
      <div className="tracking-line absolute inset-y-0 left-0 w-[2.5px]" />

      <div className="flex items-center gap-3 px-5 pb-6 pt-5">
        <div className="gradient-ring h-12 w-12 rounded-[14px]">
          <div className="flex h-full w-full items-center justify-center rounded-[12.5px]">
            <img src="/logo.png" alt="Vortex" className="h-9 w-9 object-contain" />
          </div>
        </div>
        <div>
          <div className="text-[15px] font-bold tracking-[0.18em] text-white">VORTEX</div>
          <div className="font-mono text-[9px] tracking-widest text-slate-500">CONSOLE v0.1.0</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        <div className="px-3 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.22em] text-slate-500">
          Engine Modules
        </div>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`nav-item w-full text-left ${active === item.key ? 'active' : ''}`}
          >
            <span className={active === item.key ? 'text-spectrum-cyan' : ''}>{icons[item.key]}</span>
            <span className="flex-1">
              <span className="block text-[13px] font-medium leading-tight">{item.label}</span>
              <span className="block font-mono text-[9px] text-slate-500">{item.hint}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="m-3 space-y-2 rounded-[14px] border border-white/[0.07] bg-white/[0.03] p-3">
        <div className="flex items-center gap-2">
          <StatusDot status={engineOnline ? 'live' : 'off'} />
          <span className="text-[11px] text-slate-300">
            {engineOnline ? 'Engine connected' : 'Engine offline'}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[10px] text-slate-500">{email}</span>
          <button
            onClick={onLogout}
            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-slate-400 transition hover:border-spectrum-coral/50 hover:text-spectrum-coral"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
