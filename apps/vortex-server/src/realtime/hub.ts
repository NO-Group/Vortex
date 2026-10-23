import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  ALL_TABLES_CHANNEL,
  tableChannel,
  type PresencePeer,
  type ServerMessage,
} from '@vortex/core';
import type { TableChange } from './bus.js';

export interface HubClient {
  socket: WebSocket;
  /** Presence identity — stable per connection, sent in `vortex:welcome`. */
  clientId: string;
  /** User id from the verified JWT, or null for anonymous sockets. */
  userId: string | null;
  channels: Set<string>;
  /** Channels this socket currently tracks presence on. */
  presence: Set<string>;
}

function sendJson(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

/**
 * Channel-based pub/sub hub over WebSocket connections.
 *
 * Channels:
 *   `table:<name>` — change events for one table
 *   `table:*`      — change events for every table
 *   `room:<name>`  — freeform rooms: broadcast + presence
 */
export class RealtimeHub {
  private readonly clients = new Map<WebSocket, HubClient>();
  private readonly channels = new Map<string, Set<HubClient>>();
  /** channel → clientId → presence state. */
  private readonly presence = new Map<string, Map<string, PresencePeer>>();

  /** Register a socket (optionally authenticated). */
  register(socket: WebSocket, userId: string | null = null): HubClient {
    const client: HubClient = {
      socket,
      clientId: randomUUID(),
      userId,
      channels: new Set(),
      presence: new Set(),
    };
    this.clients.set(socket, client);
    sendJson(socket, {
      type: 'vortex:welcome',
      clientId: client.clientId,
      protocol: 1,
    });
    return client;
  }

  /** Drop a socket and all of its subscriptions + presence. */
  unregister(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) return;
    for (const channel of client.presence) {
      this.leavePresence(channel, client);
    }
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

  /** Unsubscribe a socket from a channel (also untracks presence). */
  unsubscribe(socket: WebSocket, channel: string): boolean {
    const client = this.clients.get(socket);
    if (!client) return false;
    if (client.presence.has(channel)) {
      this.leavePresence(channel, client);
    }
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

  /**
   * Relay an ephemeral broadcast to every subscriber of `channel`
   * (sender included; clients filter on `from` when needed).
   */
  publishBroadcast(
    channel: string,
    event: string,
    payload: unknown,
    fromClientId: string,
  ): number {
    const message: ServerMessage = {
      type: 'vortex:broadcast',
      channel,
      event,
      payload,
      from: fromClientId,
    };
    const body = JSON.stringify(message);
    let delivered = 0;
    for (const client of this.channels.get(channel) ?? []) {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(body);
        delivered += 1;
      }
    }
    return delivered;
  }

  /** Start (or refresh) presence tracking for a socket on a channel. */
  track(
    socket: WebSocket,
    channel: string,
    state: Record<string, unknown>,
  ): PresencePeer[] | null {
    const client = this.clients.get(socket);
    if (!client) return null;
    if (!client.channels.has(channel) || !isValidChannel(channel)) return null;

    let peers = this.presence.get(channel);
    if (!peers) {
      peers = new Map();
      this.presence.set(channel, peers);
    }
    const isNew = !peers.has(client.clientId);
    const peer: PresencePeer = {
      clientId: client.clientId,
      userId: client.userId,
      state,
    };
    peers.set(client.clientId, peer);
    client.presence.add(channel);

    if (isNew) {
      this.broadcastPresence(channel, 'vortex:presence_diff', { joins: [peer], leaves: [] });
    }

    // Full sync goes to the tracker so it can hydrate its peer list.
    sendJson(socket, {
      type: 'vortex:presence_sync',
      channel,
      peers: [...peers.values()],
    });
    return [...peers.values()];
  }

  /** Stop tracking presence on a channel. */
  untrack(socket: WebSocket, channel: string): boolean {
    const client = this.clients.get(socket);
    if (!client) return false;
    if (!client.presence.has(channel)) return false;
    this.leavePresence(channel, client);
    return true;
  }

  /** Full peer list for a channel. */
  peers(channel: string): PresencePeer[] {
    return [...(this.presence.get(channel)?.values() ?? [])];
  }

  private leavePresence(channel: string, client: HubClient): void {
    const peers = this.presence.get(channel);
    const peer = peers?.get(client.clientId);
    if (!peers || !peer) return;
    peers.delete(client.clientId);
    client.presence.delete(channel);
    if (peers.size === 0) this.presence.delete(channel);
    this.broadcastPresence(channel, 'vortex:presence_diff', { joins: [], leaves: [peer] });
  }

  private broadcastPresence(
    channel: string,
    type: 'vortex:presence_diff',
    body: { joins: PresencePeer[]; leaves: PresencePeer[] },
  ): void {
    const message = JSON.stringify({ type, channel, ...body });
    for (const client of this.channels.get(channel) ?? []) {
      if (client.socket.readyState === client.socket.OPEN) {
        client.socket.send(message);
      }
    }
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

const CHANNEL_PATTERN = /^(table:(\*|[a-zA-Z_][a-zA-Z0-9_]*)|room:[a-z0-9][a-z0-9_-]{0,48})$/;

/** Validate a channel id (`table:<name>`, `table:*`, or `room:<name>`). */
export function isValidChannel(channel: string): boolean {
  return CHANNEL_PATTERN.test(channel);
}
