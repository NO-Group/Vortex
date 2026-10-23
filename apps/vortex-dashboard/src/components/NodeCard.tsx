import type { ReactNode } from 'react';
import { GlassCard, StatusDot } from './Glass.js';

export interface NodeMetric {
  label: string;
  value: string;
}

/**
 * Microservice "Node" Card — a live engine component on a frosted sheet,
 * showing real-time vitals for one Vortex module.
 */
export function NodeCard({
  name,
  endpoint,
  status,
  metrics,
  icon,
  accent,
  footer,
}: {
  name: string;
  endpoint: string;
  status: 'live' | 'warn' | 'off';
  metrics: NodeMetric[];
  icon: ReactNode;
  accent: string;
  footer?: ReactNode;
}) {
  return (
    <GlassCard className="glass-hover p-5">
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-[12px]"
          style={{
            background: `${accent}1a`,
            border: `1px solid ${accent}44`,
            color: accent,
          }}
        >
          {icon}
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-[10px] uppercase tracking-widest text-slate-400">
            {status === 'live' ? 'online' : status === 'warn' ? 'degraded' : 'offline'}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-[15px] font-semibold text-white">{name}</div>
        <div className="mt-0.5 font-mono text-[10px] text-slate-500">{endpoint}</div>
      </div>

      <div className="mt-4 space-y-2">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-baseline justify-between">
            <span className="text-[11px] text-slate-400">{m.label}</span>
            <span className="font-mono text-[12px] font-medium text-slate-200">{m.value}</span>
          </div>
        ))}
      </div>

      {footer && <div className="mt-4">{footer}</div>}
    </GlassCard>
  );
}

/** Animated throughput bar (decorative engine-load meter). */
export function LoadBar({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full"
        style={{
          width: '42%',
          background: `linear-gradient(90deg, ${color}, ${color}55)`,
          animation: 'glow-breathe 3.2s ease-in-out infinite',
          animationDelay: `${delay}s`,
        }}
      />
    </div>
  );
}
