/**
 * Vortex realtime wire protocol.
 *
 * All frames are JSON text messages:
 *   client → server: `ClientMessage`
 *   server → client: `ServerMessage`
 *
 * Durability: every event carries a monotonic per-channel `seq`. Clients
 * remember the last seq they saw and re-subscribe with `since` after a
 * dropped connection, so a reconnect replays what was missed instead of
 * silently losing it (the way fire-and-forget realtime does).
 */

/** Channel namespace for table-change streams: `table:<name>` and `table:*`. */
export const tableChannel = (table: string): string => `table:${table}`;
export const ALL_TABLES_CHANNEL = 'table:*';

/** Channel namespace for freeform rooms (broadcast + presence). */
export const roomChannel = (room: string): string => `room:${room}`;

/** Message type constants. */
export const PROTOCOL = {
  /** Client: authenticate this socket with a JWT. */
  auth: 'vortex:auth',
  /** Client: subscribe to a channel (e.g. `table:notes` or `room:lobby`). */
  subscribe: 'vortex:subscribe',
  /** Client: unsubscribe from a channel. */
  unsubscribe: 'vortex:unsubscribe',
  /** Bidirectional heartbeat. */
  ping: 'vortex:ping',
  pong: 'vortex:pong',
  /** Server: acknowledgement of a client command. */
  ack: 'vortex:ack',
  /** Server: database change fan-out. */
  event: 'vortex:event',
  /** Server: error frame. */
  error: 'vortex:error',
  /** Server: sent once on connect with the socket's presence identity. */
  welcome: 'vortex:welcome',
  /** Client→server→room: ephemeral pub/sub message on a subscribed channel. */
  broadcast: 'vortex:broadcast',
  /** Client: track/untrack presence state on a subscribed channel. */
  presence: 'vortex:presence',
  /** Server: full peer list for a channel after join/track. */
  presence_sync: 'vortex:presence_sync',
  /** Server: incremental peer join/leave. */
  presence_diff: 'vortex:presence_diff',
  /**
   * Server: marks the end of a catch-up burst after a `since` subscribe.
   * Everything before it is history; everything after it is live.
   */
  replay: 'vortex:replay',
} as const;

export type ProtocolMessageType = (typeof PROTOCOL)[keyof typeof PROTOCOL];

export interface AuthMessage {
  type: typeof PROTOCOL.auth;
  token: string;
}

export interface SubscribeMessage {
  type: typeof PROTOCOL.subscribe;
  /** Channel id, e.g. `table:notes` or `table:*`. */
  channel: string;
  id?: string;
  /**
   * Resume cursor: replay buffered events with `seq > since` before going
   * live. Omit (or 0) for live-only.
   */
  since?: number;
}

export interface UnsubscribeMessage {
  type: typeof PROTOCOL.unsubscribe;
  channel: string;
  id?: string;
}

export interface PingMessage {
  type: typeof PROTOCOL.ping;
  id?: string;
}

export type ClientMessage =
  | AuthMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage
  | BroadcastMessage
  | PresenceMessage;

export interface AckMessage {
  type: typeof PROTOCOL.ack;
  ok: true;
  /** Correlates to the client message `id` when provided. */
  id?: string;
  channel?: string;
  message?: string;
}

export interface PongMessage {
  type: typeof PROTOCOL.pong;
  id?: string;
}

export interface ErrorMessage {
  type: typeof PROTOCOL.error;
  code: string;
  message: string;
  id?: string;
}

/** Fan-out payload describing a database mutation. */
export interface TableChangeMessage {
  type: typeof PROTOCOL.event;
  id: string;
  /** `INSERT` | `UPDATE` | `DELETE` */
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  /** Affected rows (INSERT/UPDATE: new state, DELETE: removed state). */
  rows: Record<string, unknown>[];
  actorId: string | null;
  timestamp: string;
  /** Monotonic per-channel sequence number (used to resume after a drop). */
  seq?: number;
  /** True when this event was replayed from the backlog, not live. */
  replay?: boolean;
}

/** Identity assigned to a socket at connect time (used by presence). */
export interface WelcomeMessage {
  type: typeof PROTOCOL.welcome;
  clientId: string;
  protocol: number;
}

/** Ephemeral room message — relayed to a channel's subscribers. */
export interface BroadcastMessage {
  type: typeof PROTOCOL.broadcast;
  /** Subscribed channel the message is addressed to. */
  channel: string;
  /** Application event name. */
  event: string;
  payload: unknown;
  /** Sending socket's client id (filled by the server on relay). */
  from?: string;
  id?: string;
}

export interface PresenceMessage {
  type: typeof PROTOCOL.presence;
  action: 'track' | 'untrack';
  channel: string;
  /** Arbitrary small JSON state (<= 4 KB) while tracking. */
  state?: Record<string, unknown>;
  id?: string;
}

export interface PresencePeer {
  clientId: string;
  userId: string | null;
  state: Record<string, unknown>;
}

export interface PresenceSyncMessage {
  type: typeof PROTOCOL.presence_sync;
  channel: string;
  peers: PresencePeer[];
}

export interface PresenceDiffMessage {
  type: typeof PROTOCOL.presence_diff;
  channel: string;
  joins: PresencePeer[];
  leaves: PresencePeer[];
}

/**
 * Sent after a replay burst so a client can tell history from live traffic
 * (and know whether the gap it suffered was fully covered).
 */
export interface ReplayMessage {
  type: typeof PROTOCOL.replay;
  channel: string;
  /** How many buffered events were replayed. */
  count: number;
  /** True when the backlog still held events older than `since` — i.e. the
   *  client was disconnected long enough to miss some permanently. */
  truncated: boolean;
  /** Current head sequence for the channel (resume from here next time). */
  cursor: number;
  id?: string;
}

export type ServerMessage =
  | AckMessage
  | PongMessage
  | ErrorMessage
  | TableChangeMessage
  | WelcomeMessage
  | BroadcastMessage
  | PresenceSyncMessage
  | PresenceDiffMessage
  | ReplayMessage;
