import { useState, useEffect } from 'react';
import { api } from '../../api';

/**
 * Vortex Dashboard — Overview view.
 *
 * Service health check and quick stats in glassmorphic node cards.
 */

interface HealthInfo {
  status: string;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

export function Overview() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.health()
      .then((h) => setHealth({ ...h, uptime: 0, timestamp: new Date().toISOString() }))
      .catch(() => setError('Server not reachable. Is the Vortex server running on port 4000?'));
  }, []);

  return (
    <div>
      <PageHeader title="Overview" subtitle="System health and service status" />

      {error ? (
        <div className="glass p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      ) : health ? (
        <>
          {/* Status node cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatusCard
              label="Server Status"
              value={health.status === 'ok' ? 'Operational' : 'Down'}
              status={health.status === 'ok' ? 'success' : 'error'}
              icon="◉"
            />
            <StatusCard
              label="Service"
              value={health.service}
              status="neutral"
              icon="◈"
            />
            <StatusCard
              label="Version"
              value={health.version}
              status="neutral"
              icon="⬡"
            />
          </div>

          {/* Feature cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FeatureCard
              title="Auth Engine"
              description="JWT-based authentication with bcrypt password hashing and role-based access control."
              icon="🔐"
            />
            <FeatureCard
              title="Database Gateway"
              description="Dynamic CRUD over PostgreSQL with RBAC enforcement on every query."
              icon="🗄️"
            />
            <FeatureCard
              title="Storage Controller"
              description="Cloudflare R2 or local disk storage with HMAC-signed presigned URLs."
              icon="📦"
            />
            <FeatureCard
              title="Realtime Hub"
              description="WebSocket pub/sub for live table change events with sub-50ms broadcast."
              icon="⚡"
            />
          </div>
        </>
      ) : (
        <div className="glass p-6">
          <div className="skeleton h-6 w-32" />
          <div className="mt-4 skeleton h-4 w-full" />
        </div>
      )}
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
      <p className="mt-1 text-sm text-white/30">{subtitle}</p>
    </div>
  );
}

function StatusCard({
  label,
  value,
  status,
  icon,
}: {
  label: string;
  value: string;
  status: 'success' | 'error' | 'neutral';
  icon: string;
}) {
  const statusColor =
    status === 'success' ? 'text-success' : status === 'error' ? 'text-red-400' : 'text-white/60';
  const dotColor =
    status === 'success' ? 'bg-success' : status === 'error' ? 'bg-red-400' : 'bg-white/30';

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-white/30">{label}</span>
        <span className={`h-2 w-2 rounded-full ${dotColor} ${status === 'success' ? 'animate-glow-pulse' : ''}`} />
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <span className={`text-lg font-semibold ${statusColor}`}>{value}</span>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="glass p-5 transition-all duration-200 hover:bg-white/[0.05]">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-white/40">{description}</p>
        </div>
      </div>
    </div>
  );
}
