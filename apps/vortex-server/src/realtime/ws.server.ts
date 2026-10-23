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
 *   → `vortex:subscribe`   { channel }          join `table:<name>` / `table:*`
 *   → `vortex:unsubscribe` { channel }          leave a channel
 *   → `vortex:ping`        { id? }              heartbeat
 *   ← `vortex:ack` | `vortex:pong` | `vortex:error` | `vortex:event`
 *
 * Database mutations are wired straight from the event bus to subscribed
 * sockets for sub-50ms fan-out latency.
 */
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
              message: 'Channel must look like "table:<name>" or "table:*"',
              id: message.id,
            });
            break;
          }
          send(socket, { type: PROTOCOL.ack, ok: true, id: message.id, channel: message.channel });
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
