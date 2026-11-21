/**
 * Vortex Server — Realtime WebSocket Hub: pub/sub for table changes.
 */

import type { WebSocket, WebSocketServer } from 'ws';
import type { RealtimeEvent, RealtimeSubscription } from '@vortex/core';

interface ClientState {
  socket: WebSocket;
  subscriptions: Map<string, RealtimeSubscription>;
}

export class RealtimeHub {
  private wss: WebSocketServer | null = null;
  private clients = new Map<WebSocket, ClientState>();

  attach(wss: WebSocketServer): void {
    this.wss = wss;
    wss.on('connection', (socket) => this.handleConnection(socket));
  }

  private handleConnection(socket: WebSocket): void {
    const state: ClientState = { socket, subscriptions: new Map() };
    this.clients.set(socket, state);

    socket.on('message', (raw) => this.handleMessage(state, raw));
    socket.on('close', () => this.handleClose(socket));
    socket.on('error', () => this.handleClose(socket));

    this.send(socket, { type: 'connected', timestamp: Date.now() });
  }

  private handleMessage(state: ClientState, raw: import('ws').RawData): void {
    try {
      const msg = JSON.parse(raw.toString()) as { type: string; table?: string; filters?: RealtimeSubscription['filters'] };

      if (msg.type === 'subscribe' && msg.table) {
        state.subscriptions.set(msg.table, { table: msg.table, filters: msg.filters });
        this.send(state.socket, { type: 'subscribed', table: msg.table, timestamp: Date.now() });
      } else if (msg.type === 'unsubscribe' && msg.table) {
        state.subscriptions.delete(msg.table);
        this.send(state.socket, { type: 'unsubscribed', table: msg.table, timestamp: Date.now() });
      }
    } catch {
      // Ignore malformed messages
    }
  }

  private handleClose(socket: WebSocket): void {
    this.clients.delete(socket);
  }

  /** Broadcast a table-change event to all subscribed clients. */
  broadcast(event: RealtimeEvent): void {
    for (const state of this.clients.values()) {
      if (state.subscriptions.has(event.table)) {
        this.send(state.socket, event);
      }
    }
  }

  private send(socket: WebSocket, data: unknown): void {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(data));
    }
  }

  get clientCount(): number {
    return this.clients.size;
  }
}
