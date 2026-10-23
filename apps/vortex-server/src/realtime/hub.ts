import type { WebSocket } from 'ws';
import { ALL_TABLES_CHANNEL, tableChannel } from '@vortex/core';
import type { TableChange } from './bus.js';

export interface HubClient {
  socket: WebSocket;
  /** User id from the verified JWT, or null for anonymous sockets. */
  userId: string | null;
  channels: Set<string>;
}

/**
 * Channel-based pub/sub hub over WebSocket connections.
 *
 * Channels:
 *   `table:<name>` — change events for one table
 *   `table:*`      — change events for every table
 */
export class RealtimeHub {
  private readonly clients = new Map<WebSocket, HubClient>();
  private readonly channels = new Map<string, Set<HubClient>>();

  /** Register a socket (optionally authenticated). */
  register(socket: WebSocket, userId: string | null = null): HubClient {
    const client: HubClient = { socket, userId, channels: new Set() };
    this.clients.set(socket, client);
    return client;
  }

  /** Drop a socket and all of its subscriptions. */
  unregister(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) return;
    for (const channel of client.channels) {
      this.channels.get(channel)?.delete(client);
    }
    this.clients.delete(socket);
  }

  /** Attach an authenticated identity to an existing socket. */
  authenticate(socket: WebSocket, userId: string): HubClient | null {
    const client = this.clients.get(socket);
    if (!client) return null;
    client.userId = userId;
    return client;
  }

  /** Subscribe a socket to a channel. Returns false for invalid channel ids. */
  subscribe(socket: WebSocket, channel: string): boolean {
    const client = this.clients.get(socket);
    if (!client) return false;
    if (!isValidChannel(channel)) return false;

    client.channels.add(channel);
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(client);
    return true;
  }

  /** Unsubscribe a socket from a channel. */
  unsubscribe(socket: WebSocket, channel: string): boolean {
    const client = this.clients.get(socket);
    if (!client) return false;
    const removed = client.channels.delete(channel);
    this.channels.get(channel)?.delete(client);
    return removed;
  }

  /** Fan a table-change out to `table:<name>` and `table:*` subscribers. */
  publishTableChange(change: TableChange): number {
    const payload = JSON.stringify({
      type: 'vortex:event',
      id: change.id,
      action: change.action,
      table: change.table,
      rows: change.rows,
      actorId: change.actorId,
      timestamp: change.timestamp,
    });

    const targets = new Set<HubClient>();
    for (const client of this.channels.get(tableChannel(change.table)) ?? []) targets.add(client);
    for (const client of this.channels.get(ALL_TABLES_CHANNEL) ?? []) targets.add(client);

    let delivered = 0;
    for (const client of targets) {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(payload);
        delivered += 1;
      }
    }
    return delivered;
  }

  /** Current connection count. */
  get connectionCount(): number {
    return this.clients.size;
  }

  /** Subscriber count for a channel. */
  subscriberCount(channel: string): number {
    return this.channels.get(channel)?.size ?? 0;
  }
}

const CHANNEL_PATTERN = /^table:(\*|[a-zA-Z_][a-zA-Z0-9_]*)$/;

/** Validate a channel id (`table:<name>` or `table:*`). */
export function isValidChannel(channel: string): boolean {
  return CHANNEL_PATTERN.test(channel);
}
