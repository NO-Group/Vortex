import type { TableEvent } from './api.js';

export type RealtimeStatus = 'offline' | 'connecting' | 'online';

interface RealtimeHandlers {
  onStatus?: (status: RealtimeStatus) => void;
  onEvent?: (event: TableEvent) => void;
}

/**
 * Vortex realtime client — subscribe to `table:<name>` / `table:*` and
 * receive database-change events with automatic reconnect.
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = 'offline';
  private channels = new Set<string>();
  private reconnectDelay = 500;
  private closedByUser = false;
  private lastLatencyMs: number | null = null;

  constructor(private readonly handlers: RealtimeHandlers = {}) {}

  getStatus(): RealtimeStatus {
    return this.status;
  }

  /** Approximate fan-out latency of the last event (event.timestamp → now). */
  getLastLatency(): number | null {
    return this.lastLatencyMs;
  }

  connect(token: string): void {
    this.closedByUser = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.setStatus('connecting');

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/v1/realtime?token=${encodeURIComponent(token)}`);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 500;
      this.setStatus('online');
      // Rejoin channels after reconnect.
      for (const channel of this.channels) {
        ws.send(JSON.stringify({ type: 'vortex:subscribe', channel }));
      }
    };

    ws.onmessage = (frame) => {
      try {
        const msg = JSON.parse(String(frame.data));
        if (msg.type === 'vortex:event') {
          this.lastLatencyMs = Math.max(0, Date.now() - Date.parse(msg.timestamp));
          this.handlers.onEvent?.(msg as TableEvent);
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      this.setStatus('offline');
      if (!this.closedByUser) {
        window.setTimeout(() => this.connect(token), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10_000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  subscribe(channel: string): void {
    this.channels.add(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:subscribe', channel }));
    }
  }

  unsubscribe(channel: string): void {
    this.channels.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:unsubscribe', channel }));
    }
  }

  getChannels(): string[] {
    return [...this.channels];
  }

  disconnect(): void {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
  }

  private setStatus(status: RealtimeStatus): void {
    this.status = status;
    this.handlers.onStatus?.(status);
  }
}
