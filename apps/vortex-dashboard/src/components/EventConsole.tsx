import { useEffect, useRef, useState } from 'react';
import type { TableEvent } from '../lib/api.js';
import { formatTime } from '../lib/format.js';

const actionColor: Record<TableEvent['action'], string> = {
  INSERT: 'text-spectrum-green',
  UPDATE: 'text-spectrum-cyan',
  DELETE: 'text-spectrum-coral',
};

const actionBg: Record<TableEvent['action'], string> = {
  INSERT: 'bg-spectrum-green/15 border-spectrum-green/40',
  UPDATE: 'bg-spectrum-cyan/15 border-spectrum-cyan/40',
  DELETE: 'bg-spectrum-coral/15 border-spectrum-coral/40',
};

/**
 * Live Stream Engine Console — pitch-black legibility core wrapped in a
 * frosted frame. Auto-scrolls unless paused.
 */
export function EventConsole({
  events,
  latencyMs,
  onClear,
}: {
  events: TableEvent[];
  latencyMs: number | null;
  onClear: () => void;
}) {
  const [paused, setPaused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, paused]);

  return (
    <div className="glass flex h-full flex-col p-3">
      <div className="flex items-center justify-between px-2 pb-3">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            engine stream
          </span>
          {latencyMs !== null && (
            <span className="font-mono text-[10px] text-spectrum-mint">
              last fan-out {latencyMs}ms
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            className="rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[10px] text-slate-400 transition hover:border-interactive-focus/50 hover:text-blue-300"
          >
            {paused ? '▶ resume' : '⏸ pause'}
          </button>
          <button
            onClick={onClear}
            className="rounded-lg border border-white/10 px-2.5 py-1 font-mono text-[10px] text-slate-400 transition hover:border-spectrum-coral/50 hover:text-spectrum-coral"
          >
            clear
          </button>
        </div>
      </div>

      <div className="console-core flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
        {events.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-600">
            <span className="text-center">
              awaiting database events…
              <br />
              <span className="text-[10px]">subscribe to a channel and mutate a table</span>
            </span>
          </div>
        ) : (
          events.map((evt, i) => (
            <div
              key={`${evt.id}-${i}`}
              className="animate-fade-in flex items-start gap-2 border-b border-white/[0.04] py-1.5 last:border-0"
            >
              <span className="text-slate-600">{formatTime(evt.timestamp)}</span>
              <span
                className={`rounded border px-1.5 py-px text-[9px] font-bold tracking-wider ${actionBg[evt.action]} ${actionColor[evt.action]}`}
              >
                {evt.action}
              </span>
              <span className="text-slate-500">{evt.table}</span>
              <span className="flex-1 truncate text-slate-300">
                {JSON.stringify(evt.rows)}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
