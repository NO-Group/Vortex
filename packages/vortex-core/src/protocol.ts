/**
 * Vortex realtime wire protocol.
 *
 * All frames are JSON text messages:
 *   client → server: `ClientMessage`
 *   server → client: `ServerMessage`
 */

/** Channel namespace for table-change streams: `table:<name>` and `table:*`. */
export const tableChannel = (table: string): string => `table:${table}`;
export const ALL_TABLES_CHANNEL = 'table:*';

/** Message type constants. */
export const PROTOCOL = {
  /** Client: authenticate this socket with a JWT. */
  auth: 'vortex:auth',
  /** Client: subscribe to a channel (e.g. `table:notes`). */
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

export type ClientMessage = AuthMessage | SubscribeMessage | UnsubscribeMessage | PingMessage;

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
}

export type ServerMessage = AckMessage | PongMessage | ErrorMessage | TableChangeMessage;
