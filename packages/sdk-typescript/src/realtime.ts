import type {
  TableEvent, PresencePeer, TableChangeHandler, PresenceHandler,
  BroadcastHandler, ReplayHandler, StatusHandler,
} from './types.js';

/**
 * Vortex Realtime — channel pub/sub with durable replay.
 *
 * Subscribe to `table:<name>` or `table:*` to receive database-change
 * events. Subscribe to `room:<name>` for freeform broadcast + presence.
 *
 * Durability: the client remembers the last `seq` it saw per channel.
 * On reconnect, it resumes with `since: <seq>` and gets replayed what
 * it missed — the thing fire-and-forget realtime cannot do.
 *
 * Works in browser (native WebSocket) and Node.js 18+ (global WebSocket).
 */
export class Realtime {
  private ws: WebSocket | null = null;
  private status: 'offline' | 'connecting' | 'online' = 'offline';
  private channels = new Set<string>();
  private cursors = new Map<string, number>();
  private trackedRooms = new Map<string, Record<string, unknown>>();
  private reconnectDelay = 500;
  private closedByUser = false;
  private token: string | null = null;
  private myClientId: string | null = null;

  private handlers: {
    onTableChange?: TableChangeHandler;
    onPresence?: PresenceHandler;
    onBroadcast?: BroadcastHandler;
    onReplay?: ReplayHandler;
    onStatus?: StatusHandler;
  } = {};

  constructor(
    private readonly baseUrl: string,
    handlers: {
      onTableChange?: TableChangeHandler;
      onPresence?: PresenceHandler;
      onBroadcast?: BroadcastHandler;
      onReplay?: ReplayHandler;
      onStatus?: StatusHandler;
    } = {},
  ) {
    this.handlers = handlers;
  }

  /** Connect with a JWT token. */
  connect(token: string): void {
    this.token = token;
    this.closedByUser = false;

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus('connecting');

    const proto = this.detectProtocol();
    const ws = new WebSocket(
      `${proto}://${this.extractHost()}/v1/realtime?token=${encodeURIComponent(token)}`,
    );
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectDelay = 500;
      this.setStatus('online');
      // Rejoin channels with resume cursors.
      for (const channel of this.channels) {
        ws.send(JSON.stringify({ type: 'vortex:subscribe', channel, since: this.cursors.get(channel) ?? 0 }));
      }
      // Re-track presence.
      for (const [channel, state] of this.trackedRooms) {
        ws.send(JSON.stringify({ type: 'vortex:presence', action: 'track', channel, state }));
      }
    };

    ws.onmessage = (frame) => this.onMessage(frame);

    ws.onclose = () => {
      this.setStatus('offline');
      if (!this.closedByUser && this.token) {
        setTimeout(() => this.connect(this.token!), this.reconnectDelay);
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10_000);
      }
    };

    ws.onerror = () => ws.close();
  }

  /** Subscribe to a channel. */
  subscribe(channel: string): void {
    this.channels.add(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'vortex:subscribe',
        channel,
        since: this.cursors.get(channel) ?? 0,
      }));
    }
  }

  /** Unsubscribe from a channel. */
  unsubscribe(channel: string): void {
    this.channels.delete(channel);
    this.cursors.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:unsubscribe', channel }));
    }
  }

  /** Broadcast an ephemeral message to a subscribed room. */
  broadcast(channel: string, event: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:broadcast', channel, event, payload }));
    }
  }

  /** Track presence state on a channel. */
  track(channel: string, state: Record<string, unknown> = {}): void {
    this.trackedRooms.set(channel, state);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:presence', action: 'track', channel, state }));
    }
  }

  /** Stop tracking presence on a channel. */
  untrack(channel: string): void {
    this.trackedRooms.delete(channel);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'vortex:presence', action: 'untrack', channel }));
    }
  }

  /** Disconnect and stop reconnecting. */
  disconnect(): void {
    this.closedByUser = true;
    this.ws?.close();
    this.ws = null;
    this.setStatus('offline');
  }

  /** Current connection status. */
  getStatus(): 'offline' | 'connecting' | 'online' {
    return this.status;
  }

  /** Presence identity assigned by the server. */
  getClientId(): string | null {
    return this.myClientId;
  }

  /** Resume cursor for a channel. */
  getCursor(channel: string): number {
    return this.cursors.get(channel) ?? 0;
  }

  private onMessage(frame: { data: unknown }): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(frame.data)) as Record<string, unknown>;
    } catch {
      return;
    }

    switch (msg.type) {
      case 'vortex:welcome':
        this.myClientId = msg.clientId as string ?? null;
        break;

      case 'vortex:event': {
        this.rememberCursor(msg);
        this.handlers.onTableChange?.(msg as unknown as TableEvent);
        break;
      }

      case 'vortex:replay': {
        const info = {
          channel: msg.channel as string,
          count: msg.count as number,
          truncated: Boolean(msg.truncated),
          cursor: msg.cursor as number,
        };
        this.cursors.set(info.channel, Math.max(this.cursors.get(info.channel) ?? 0, info.cursor));
        this.handlers.onReplay?.(info);
        break;
      }

      case 'vortex:broadcast':
        this.handlers.onBroadcast?.(msg as never);
        break;

      case 'vortex:presence_sync':
        this.handlers.onPresence?.({
          channel: msg.channel as string,
          kind: 'sync',
          peers: (msg.peers as PresencePeer[]) ?? [],
        });
        break;

      case 'vortex:presence_diff': {
        const channel = msg.channel as string;
        const joins = msg.joins as PresencePeer[];
        const leaves = msg.leaves as PresencePeer[];
        if (joins?.length) this.handlers.onPresence?.({ channel, kind: 'joins', peers: joins });
        if (leaves?.length) this.handlers.onPresence?.({ channel, kind: 'leaves', peers: leaves });
        break;
      }
    }
  }

  private rememberCursor(msg: Record<string, unknown>): void {
    const seq = msg.seq as number | undefined;
    const table = msg.table as string | undefined;
    if (typeof seq !== 'number' || !table) return;

    const specific = `table:${table}`;
    const target = this.channels.has(specific)
      ? specific
      : this.channels.has('table:*')
        ? 'table:*'
        : null;
    if (!target) return;
    this.cursors.set(target, Math.max(this.cursors.get(target) ?? 0, seq));
  }

  private setStatus(status: 'offline' | 'connecting' | 'online'): void {
    this.status = status;
    this.handlers.onStatus?.(status);
  }

  private detectProtocol(): string {
    // In Node.js 18+, global WebSocket is available; protocol is ws.
    // In browser, check location.protocol.
    if (typeof location !== 'undefined') {
      return location.protocol === 'https:' ? 'wss' : 'ws';
    }
    return 'ws';
  }

  private extractHost(): string {
    // Strip the protocol from baseUrl to get host:port.
    return this.baseUrl.replace(/^https?:\/\//, '');
  }
}
