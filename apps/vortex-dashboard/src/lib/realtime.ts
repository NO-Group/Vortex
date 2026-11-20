import type { TableEvent } from './api.js';

export type RealtimeStatus = 'offline' | 'connecting' | 'online';

export interface BroadcastFrame {
  channel: string;
  event: string;
  payload: unknown;
  from?: string;
}

export interface PresencePeerInfo {
  clientId: string;
  userId: string | null;
  state: Record<string, unknown>;
}

/** Result of a catch-up burst after the client resumed from a cursor. */
export interface ReplayInfo {
  channel: string;
  /** How many buffered events were replayed. */
  count: number;
  /** True when the gap was longer than the backlog covers. */
  truncated: boolean;
  /** Latest sequence number for the channel. */
  cursor: number;
}

interface RealtimeHandlers {
  onStatus?: (status: RealtimeStatus) => void;
  onEvent?: (event: TableEvent) => void;
  onBroadcast?: (frame: BroadcastFrame) => void;
  onPresence?: (info: {
    channel: string;
    kind: 'sync' | 'joins' | 'leaves';
    peers: PresencePeerInfo[];
  }) => void;
  /** Fired after a reconnect, reporting what was replayed. */
  onReplay?: (info: ReplayInfo) => void;
}

/**
 * Vortex realtime client — subscribe to `table:<name>` / `room:<name>`,
 * receive database-change events, room broadcasts, and presence updates.
 *
 * Durability: the client remembers the last event sequence it saw per channel.
 * On reconnect it re-subscribes with `since: <seq>`, so events that happened
 * while the connection was down are replayed instead of lost — the thing
 * fire-and-forget realtime cannot do.
 */
export class RealtimeClient {
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = 'offline';
  private channels = new Set<string>();
  private trackedRooms = new Map<string, Record<string, unknown>>();
  /** Last event sequence seen per channel (resume cursors). */
  private cursors = new Map<string, number>();
  private reconnectDelay = 500;
  private closedByUser = false;
  private lastLatencyMs: number | null = null;
  private myClientId: string | null = null;

  constructor(private readonly handlers: RealtimeHandlers = {}) {}

  getStatus(): RealtimeStatus {
    return this.status;
  }

  /** Presence identity assigned by the server at connect. */
  getClientId(): string | null {
    return this.myClientId;
  }

  /** Approximate fan-out latency of the last event (event.timestamp → now). */
  getLastLatency(): number | null {
    return this.lastLatencyMs;
  }

  /** Resume cursor for a channel — where a reconnect would pick up from. */
  getCursor(channel: string): number {
    return this.cursors.get(channel) ?? 0;
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
      // Rejoin channels + presence after reconnect — with resume cursors so
      // the server replays anything we missed while we were away.
      for (const channel of this.channels) {
        ws.send(
          JSON.stringify({
            type: 'vortex:subscribe',
            channel,
            since: this.cursors.get(channel) ?? 0,
          }),
        );
      }
      for (const [channel, state] of this.trackedRooms) {
        ws.send(JSON.stringify({ type: 'vortex:presence', action: 'track', channel, state }));
      }
    };

    ws.onmessage = (frame) => {
      try {
        const msg = JSON.parse(String(frame.data));
        switch (msg.type) {
          case 'vortex:welcome':
            this.myClientId = msg.clientId ?? null;
            break;

          case 'vortex:event': {
            this.lastLatencyMs = Math.max(0, Date.now() - Date.parse(msg.timestamp));
            this.rememberCursor(msg);
            this.handlers.onEvent?.(msg as TableEvent);
            break;
          }

          case 'vortex:replay': {
            const info: ReplayInfo = {
              channel: msg.channel,
              count: msg.count ?? 0,
              truncated: Boolean(msg.truncated),
              cursor: msg.cursor ?? 0,
            };
            this.cursors.set(
              info.channel,
              Math.max(this.cursors.get(info.channel) ?? 0, info.cursor),
            );
            this.handlers.onReplay?.(info);
            break;
          }

          case 'vortex:broadcast':
            this.handlers.onBroadcast?.(msg as BroadcastFrame);
            break;

          case 'vortex:presence_sync':
            this.handlers.onPresence?.({
              channel: msg.channel,
              kind: 'sync',
              peers: msg.peers ?? [],
            });
            break;

          case 'vortex:presence_diff':
            if (msg.joins?.length) {
              this.handlers.onPresence?.({ channel: msg.channel, kind: 'joins', peers: msg.joins });
            }
            if (msg.leaves?.length) {
              this.handlers.onPresence?.({ channel: msg.channel, kind: 'leaves', peers: msg.leaves });
            }
            break;
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

  /**
   * Record the sequence number of a table event against whichever channel
   * this client is actually subscribed to. When both `table:<name>` and
   * `table:*` are joined the server stamps the specific channel's sequence.
   */
  private rememberCursor(msg: { table?: string; seq?: number }): void {
    if (typeof msg.seq !== 'number' || !msg.table) return;
    const specific = `table:${msg.table}`;
    const target = this.channels.has(specific)
      ? specific
      : this.channels.has('table:*')
        ? 'table:*'
        : null;
    if (!target) return;
    this.cursors.set(target, Math.max(this.cursors.get(target) ?? 0, msg.seq));
  }

  subscribe(channel: string): void {
    this.channels.add(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'vortex:subscribe',
          channel,
          since: this.cursors.get(channel) ?? 0,
        }),
      );
    }
  }

  unsubscribe(channel: string): void {
    this.channels.delete(channel);
    this.trackedRooms.delete(channel);
    this.cursors.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:unsubscribe', channel }));
    }
  }

  /** Relay an ephemeral message to a subscribed channel. */
  broadcast(channel: string, event: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:broadcast', channel, event, payload }));
    }
  }

  /** Track presence state on a subscribed channel. */
  track(channel: string, state: Record<string, unknown> = {}): void {
    this.trackedRooms.set(channel, state);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:presence', action: 'track', channel, state }));
    }
  }

  untrack(channel: string): void {
    this.trackedRooms.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:presence', action: 'untrack', channel }));
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
