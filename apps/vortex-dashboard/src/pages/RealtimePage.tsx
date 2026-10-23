import { useEffect, useState } from 'react';
import type { TableEvent } from '../lib/api.js';
import type { RealtimeClient, RealtimeStatus } from '../lib/realtime.js';
import { Banner, Chip, GradientButton, PageTitle, StatusDot } from '../components/Glass.js';
import { EventConsole } from '../components/EventConsole.js';

const MAX_EVENTS = 300;

export function RealtimePage({
  client,
  status,
  events,
  onClear,
}: {
  client: RealtimeClient;
  status: RealtimeStatus;
  events: TableEvent[];
  onClear: () => void;
}) {
  const [channelInput, setChannelInput] = useState('table:notes');
  const [channels, setChannels] = useState<string[]>(client.getChannels());
  const [error, setError] = useState<string | null>(null);

  const sync = () => setChannels(client.getChannels());

  const subscribe = () => {
    const channel = channelInput.trim();
    if (!channel) return;
    client.subscribe(channel);
    sync();
    setError(null);
  };

  const unsubscribe = (channel: string) => {
    client.unsubscribe(channel);
    sync();
  };

  // Keep the displayed event list bounded.
  useEffect(() => {
    if (events.length > MAX_EVENTS) onClear();
  }, [events, onClear]);

  const latency = client.getLastLatency();

  return (
    <div className="flex h-full flex-col space-y-6">
      <PageTitle
        title="Live Stream"
        accent="Engine"
        subtitle="vortex:subscribe to table channels — database mutations arrive in real time."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`glass flex items-center gap-2 px-3.5 py-2 ${
            status === 'online' ? 'border-spectrum-green/30' : ''
          }`}
        >
          <StatusDot status={status === 'online' ? 'live' : status === 'connecting' ? 'warn' : 'off'} />
          <span className="text-[12px] text-slate-300">
            websocket {status}
            {latency !== null && status === 'online' && (
              <span className="ml-2 font-mono text-[10px] text-spectrum-mint">{latency}ms ago</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && subscribe()}
            placeholder="table:notes or table:*"
            className="input-vortex w-52 px-3 py-2 font-mono text-[12px]"
          />
          <GradientButton onClick={subscribe} className="px-4 py-2">
            Subscribe
          </GradientButton>
        </div>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {channels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">joined:</span>
          {channels.map((ch) => (
            <button key={ch} onClick={() => unsubscribe(ch)} title="Click to leave">
              <Chip tone="cyan">
                {ch}
                <span className="ml-1 text-slate-500">✕</span>
              </Chip>
            </button>
          ))}
        </div>
      )}

      <div className="min-h-[420px] flex-1">
        <EventConsole
          events={events.slice(-MAX_EVENTS)}
          latencyMs={latency}
          onClear={onClear}
        />
      </div>
    </div>
  );
}
