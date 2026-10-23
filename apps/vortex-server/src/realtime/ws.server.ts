import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import {
  PROTOCOL,
  type ClientMessage,
  type ServerMessage,
} from '@vortex/core';
import type { AppContext } from '../context.js';
import { verifyToken, type TokenConfig } from '../auth/tokens.js';
import type { RealtimeHub, HubClient } from './hub.js';

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function parseClientMessage(raw: RawData): ClientMessage | null {
  try {
    const parsed = JSON.parse(raw.toString()) as Record<string, unknown>;
    if (typeof parsed.type !== 'string') return null;
    return parsed as unknown as ClientMessage;
  } catch {
    return null;
  }
}

/**
 * Vortex realtime engine (`/v1/realtime`).
 *
 * Protocol summary:
 *   → `vortex:auth`        { token }            authenticate the socket
 *   → `vortex:subscribe`   { channel }          join `table:<name>` / `room:<name>`
 *   → `vortex:unsubscribe` { channel }          leave a channel
 *   → `vortex:broadcast`   { channel, event, payload }   room pub/sub
 *   → `vortex:presence`    { action, channel, state? }   track/untrack
 *   → `vortex:ping`        { id? }              heartbeat
 *   ← `vortex:welcome` | `vortex:ack` | `vortex:pong` | `vortex:error`
 *   ← `vortex:event` | `vortex:broadcast`
 *   ← `vortex:presence_sync` | `vortex:presence_diff`
 *
 * Database mutations are wired straight from the event bus to subscribed
 * sockets for sub-50ms fan-out latency.
 */

const MAX_BROADCAST_BYTES = 64 * 1024;
const MAX_PRESENCE_BYTES = 4 * 1024;
export function attachRealtimeServer(httpServer: HttpServer, ctx: AppContext): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/v1/realtime' });
  const tokenConfig = ctx.env.jwt as TokenConfig;

  // Table-change fan-out: query service → bus → hub → sockets.
  ctx.bus.onTableChange((change) => {
    ctx.hub.publishTableChange(change);
  });

  // Heartbeat sweep — drop dead connections.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      const anySocket = socket as WebSocket & { isAlive?: boolean };
      if (anySocket.isAlive === false) {
        socket.terminate();
        continue;
      }
      anySocket.isAlive = false;
      socket.ping();
    }
  }, ctx.env.realtime.heartbeatMs);

  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', (socket: WebSocket, req) => {
    const anySocket = socket as WebSocket & { isAlive?: boolean };
    anySocket.isAlive = true;
    socket.on('pong', () => {
      anySocket.isAlive = true;
    });

    const client: HubClient = ctx.hub.register(socket, null);

    // Allow token auth via query string: /v1/realtime?token=<jwt>
    const url = new URL(req.url ?? '/', 'http://localhost');
    const queryToken = url.searchParams.get('token');
    if (queryToken) {
      try {
        const claims = verifyToken(queryToken, tokenConfig);
        ctx.hub.authenticate(socket, claims.sub);
        send(socket, { type: PROTOCOL.ack, ok: true, message: 'authenticated' });
      } catch {
        send(socket, {
          type: PROTOCOL.error,
          code: 'unauthorized',
          message: 'Invalid token',
        });
      }
    }

    socket.on('message', (raw: RawData) => {
      const message = parseClientMessage(raw);
      if (!message) {
        send(socket, {
          type: PROTOCOL.error,
          code: 'bad_frame',
          message: 'Expected a JSON message with a "type" field',
        });
        return;
      }

      switch (message.type) {
        case PROTOCOL.auth: {
          try {
            const claims = verifyToken(message.token, tokenConfig);
            ctx.hub.authenticate(socket, claims.sub);
            send(socket, {
              type: PROTOCOL.ack,
              ok: true,
              id: 'id' in message ? (message.id as string) : undefined,
              message: 'authenticated',
            });
          } catch {
            send(socket, {
              type: PROTOCOL.error,
              code: 'unauthorized',
              message: 'Invalid token',
            });
          }
          break;
        }

        case PROTOCOL.subscribe: {
          if (!client.userId) {
            send(socket, {
              type: PROTOCOL.error,
              code: 'unauthorized',
              message: 'Authenticate with vortex:auth before subscribing',
              id: message.id,
            });
            break;
          }
          const ok = ctx.hub.subscribe(socket, message.channel);
          if (!ok) {
            send(socket, {
              type: PROTOCOL.error,
              code: 'bad_channel',
              message: 'Channel must look like "table:<name>", "table:*" or "room:<name>"',
              id: message.id,
            });
            break;
          }
          send(socket, { type: PROTOCOL.ack, ok: true, id: message.id, channel: message.channel });
          break;
        }

        case PROTOCOL.broadcast: {
          if (!client.channels.has(message.channel)) {
            send(socket, {
              type: PROTOCOL.error,
              code: 'not_subscribed',
              message: 'Subscribe to the channel before broadcasting',
              id: message.id,
            });
            break;
          }
          if (JSON.stringify(message.payload ?? null).length > MAX_BROADCAST_BYTES) {
            send(socket, {
              type: PROTOCOL.error,
              code: 'payload_too_large',
              message: `Broadcast payloads are limited to ${MAX_BROADCAST_BYTES} bytes`,
              id: message.id,
            });
            break;
          }
          ctx.hub.publishBroadcast(
            message.channel,
            String(message.event ?? 'message'),
            message.payload ?? null,
            client.clientId,
          );
          send(socket, { type: PROTOCOL.ack, ok: true, id: message.id, channel: message.channel });
          break;
        }

        case PROTOCOL.presence: {
          if (message.action === 'track') {
            const state = message.state ?? {};
            if (JSON.stringify(state).length > MAX_PRESENCE_BYTES) {
              send(socket, {
                type: PROTOCOL.error,
                code: 'payload_too_large',
                message: `Presence state is limited to ${MAX_PRESENCE_BYTES} bytes`,
                id: message.id,
              });
              break;
            }
            const peers = ctx.hub.track(socket, message.channel, state);
            if (!peers) {
              send(socket, {
                type: PROTOCOL.error,
                code: 'not_subscribed',
                message: 'Subscribe to the channel before tracking presence',
                id: message.id,
              });
              break;
            }
            send(socket, { type: PROTOCOL.ack, ok: true, id: message.id, channel: message.channel });
          } else {
            ctx.hub.untrack(socket, message.channel);
            send(socket, { type: PROTOCOL.ack, ok: true, id: message.id, channel: message.channel });
          }
          break;
        }

        case PROTOCOL.unsubscribe: {
          ctx.hub.unsubscribe(socket, message.channel);
          send(socket, { type: PROTOCOL.ack, ok: true, id: message.id, channel: message.channel });
          break;
        }

        case PROTOCOL.ping: {
          send(socket, { type: PROTOCOL.pong, id: message.id });
          break;
        }

        default: {
          send(socket, {
            type: PROTOCOL.error,
            code: 'bad_frame',
            message: `Unknown message type: ${String((message as { type: string }).type)}`,
          });
        }
      }
    });

    socket.on('close', () => {
      ctx.hub.unregister(socket);
    });
  });

  return wss;
}
