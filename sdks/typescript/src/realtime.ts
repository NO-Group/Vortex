export interface RealtimeHandlers {
  onTableChange?: (event: { action: string; rows: unknown[]; seq: number }) => void;
  onPresence?: (info: { kind: string; peers: unknown[] }) => void;
  onBroadcast?: (frame: { event: string; payload: unknown }) => void;
  onReplay?: (info: { count: number; truncated: boolean }) => void;
}

export class Realtime {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private handlers: RealtimeHandlers;

  constructor(baseUrl: string, handlers: RealtimeHandlers = {}) {
    this.baseUrl = baseUrl.replace(/^https?:\/\//, 'wss://');
    this.handlers = handlers;
  }

  connect(token: string): void {
    const url = `${this.baseUrl}/v1/realtime?token=${encodeURIComponent(token)}`;
    this.ws = new WebSocket(url);

    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      switch (msg.type) {
        case 'vortex:event':
          this.handlers.onTableChange?.(msg);
          break;
        case 'vortex:presence_diff':
        case 'vortex:presence_sync':
          this.handlers.onPresence?.(msg);
          break;
        case 'vortex:broadcast':
          this.handlers.onBroadcast?.(msg);
          break;
        case 'vortex:replay':
          this.handlers.onReplay?.(msg);
          break;
      }
    };
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }

  subscribe(channel: string, since = 0): void {
    this.ws?.send(JSON.stringify({ type: 'vortex:subscribe', channel, since }));
  }

  unsubscribe(channel: string): void {
    this.ws?.send(JSON.stringify({ type: 'vortex:unsubscribe', channel }));
  }

  broadcast(room: string, event: string, payload: unknown): void {
    this.ws?.send(JSON.stringify({ type: 'vortex:broadcast', channel: `room:${room}`, event, payload }));
  }

  track(room: string, data: unknown): void {
    this.ws?.send(JSON.stringify({ type: 'vortex:presence', channel: `room:${room}`, action: 'track', data }));
  }

  untrack(room: string): void {
    this.ws?.send(JSON.stringify({ type: 'vortex:presence', channel: `room:${room}`, action: 'untrack' }));
  }
}
