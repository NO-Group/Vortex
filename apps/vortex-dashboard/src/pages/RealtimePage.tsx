import { useEffect, useRef, useState } from 'react';
import { getToken, type TableEvent } from '../lib/api.js';
import { RealtimeClient, type RealtimeStatus, type PresencePeerInfo } from '../lib/realtime.js';
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

      <RoomLab />
    </div>
  );
}

/**
 * Room lab — a second live connection for trying broadcast + presence.
 * (Open the console twice to see peers join and leave in real time.)
 */
function RoomLab() {
  const [room, setRoom] = useState('lobby');
  const [joined, setJoined] = useState(false);
  const [peers, setPeers] = useState<PresencePeerInfo[]>([]);
  const [frames, setFrames] = useState<Array<{ event: string; from?: string; text: string }>>([]);
  const [draft, setDraft] = useState('');
  const [presenceNote, setPresenceNote] = useState('looking glass');
  const clientRef = useRef<RealtimeClient | null>(null);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  const join = () => {
    const token = getToken();
    if (!token) return;
    clientRef.current?.disconnect();

    const channel = room.startsWith('room:') ? room : `room:${room}`;
    const peerMap = new Map<string, PresencePeerInfo>();
    const client = new RealtimeClient({
      onBroadcast: (b) =>
        setFrames((f) =>
          [
            ...f,
            {
              event: b.event,
              from: b.from,
              text: typeof b.payload === 'string' ? b.payload : JSON.stringify(b.payload),
            },
          ].slice(-50),
        ),
      onPresence: (info) => {
        if (info.kind === 'sync') {
          peerMap.clear();
          for (const p of info.peers) peerMap.set(p.clientId, p);
        } else if (info.kind === 'joins') {
          for (const p of info.peers) peerMap.set(p.clientId, p);
        } else {
          for (const p of info.peers) peerMap.delete(p.clientId);
        }
        setPeers([...peerMap.values()]);
      },
    });
    client.connect(token);
    client.subscribe(channel);
    client.track(channel, { note: presenceNote });
    clientRef.current = client;
    setJoined(true);
  };

  const leave = () => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setJoined(false);
    setPeers([]);
  };

  const send = () => {
    if (!draft.trim() || !clientRef.current) return;
    const channel = room.startsWith('room:') ? room : `room:${room}`;
    clientRef.current.broadcast(channel, 'chat', draft.trim());
    setDraft('');
  };

  const channel = room.startsWith('room:') ? room : `room:${room}`;

  return (
    <div className="glass p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500">
          rooms — broadcast + presence
        </div>
        <input
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          placeholder="lobby"
          className="input-vortex w-36 px-3 py-1.5 font-mono text-[11px]"
          disabled={joined}
        />
        <input
          value={presenceNote}
          onChange={(e) => setPresenceNote(e.target.value)}
          placeholder="presence state"
          className="input-vortex w-40 px-3 py-1.5 text-[11px]"
          disabled={joined}
        />
        {joined ? (
          <button onClick={leave} className="btn-glass px-3 py-1.5 text-[11px] text-spectrum-coral">
            Leave
          </button>
        ) : (
          <GradientButton onClick={join} className="px-3 py-1.5 text-[11px]">
            Join & track
          </GradientButton>
        )}
        {joined && <Chip tone="green">{channel}</Chip>}
      </div>

      {joined && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              presence · {peers.length} peer{peers.length === 1 ? '' : 's'}
            </div>
            <div className="mt-2 space-y-1.5">
              {peers.map((p) => (
                <div
                  key={p.clientId}
                  className="flex items-center gap-2 rounded-[10px] border border-white/[0.07] bg-surface px-3 py-1.5 text-[11px]"
                >
                  <StatusDot status="live" />
                  <span className="font-mono text-slate-300">{p.clientId.slice(0, 8)}</span>
                  <span className="text-slate-500">{p.state.note ? String(p.state.note) : ''}</span>
                </div>
              ))}
              {peers.length === 0 && (
                <div className="text-[11px] text-slate-500">nobody tracked yet — open a second tab!</div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="broadcast a message…"
                className="input-vortex flex-1 px-3 py-1.5 text-[11px]"
              />
              <GradientButton onClick={send} className="px-3 py-1.5 text-[11px]">
                Send
              </GradientButton>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">broadcasts</div>
            <div className="console-core mt-2 max-h-52 overflow-auto p-3">
              {frames.length === 0 ? (
                <div className="text-[11px] text-slate-500">// nothing yet</div>
              ) : (
                frames.map((f, i) => (
                  <div key={i} className="font-mono text-[11px] leading-relaxed text-spectrum-mint">
                    <span className="text-slate-500">{f.event}</span>{' '}
                    <span className="text-slate-400">{f.from?.slice(0, 8)}</span> {f.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
