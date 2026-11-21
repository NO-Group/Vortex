import { useState, useEffect, useRef } from 'react';

/**
 * Vortex Dashboard — Realtime Console view.
 *
 * WebSocket connection monitor and live event stream for table changes.
 */

interface RealtimeEvent {
  type: string;
  table?: string;
  row?: Record<string, unknown> | null;
  timestamp: number;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://localhost:4000/v1';

function getToken(): string | null {
  return localStorage.getItem('vortex_token');
}

export function RealtimeView() {
  const [connected, setConnected] = useState(false);
  const [table, setTable] = useState('users');
  const [subscribed, setSubscribed] = useState(false);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const token = getToken();
    const wsUrl = `${API_BASE.replace('/v1', '').replace('http', 'ws')}/v1/realtime?token=${token ?? ''}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'subscribed' || msg.type === 'unsubscribed' || msg.type === 'connected') return;
        if (msg.type && (msg.type === 'insert' || msg.type === 'update' || msg.type === 'delete')) {
          setEvents((prev) => [msg, ...prev].slice(0, 50));
        }
      } catch {
        // ignore malformed
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setSubscribed(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const subscribe = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', table }));
      setSubscribed(true);
    }
  };

  const unsubscribe = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', table }));
      setSubscribed(false);
    }
  };

  useEffect(() => {
    return () => disconnect();
  }, []);

  return (
    <div>
      <PageHeader title="Realtime" subtitle="Live table change events via WebSocket" />

      {/* Connection controls */}
      <div className="glass mb-4 p-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${connected ? 'bg-success animate-glow-pulse' : 'bg-white/20'}`} />
            <span className={`text-sm font-medium ${connected ? 'text-success' : 'text-white/40'}`}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div className="h-4 w-px bg-white/10" />

          <input
            type="text"
            value={table}
            onChange={(e) => setTable(e.target.value)}
            placeholder="Table name"
            className="glass-input !py-2 w-40 text-sm"
          />

          {connected && !subscribed ? (
            <button onClick={subscribe} className="btn-primary !py-2 !px-4 text-sm">Subscribe</button>
          ) : connected && subscribed ? (
            <button onClick={unsubscribe} className="btn-glass !py-2 !px-4 text-sm">Unsubscribe</button>
          ) : null}

          {!connected ? (
            <button onClick={connect} className="btn-primary !py-2 !px-4 text-sm">Connect</button>
          ) : (
            <button onClick={disconnect} className="btn-glass !py-2 !px-4 text-sm">Disconnect</button>
          )}
        </div>
      </div>

      {/* Event stream */}
      <div className="glass p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/60">Event Stream</h3>
          <span className="text-xs text-white/20">{events.length} events</span>
        </div>

        {events.length === 0 ? (
          <div className="py-8 text-center text-sm text-white/25">
            Waiting for events… subscribe to a table to start receiving updates.
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((evt, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2 text-xs"
              >
                <span className="rounded-md bg-anchor/20 px-2 py-0.5 font-medium text-cyber">
                  {evt.type}
                </span>
                <span className="text-white/40">{evt.table}</span>
                <span className="ml-auto text-white/20">
                  {new Date(evt.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
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
