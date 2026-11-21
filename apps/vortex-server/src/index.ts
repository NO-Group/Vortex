/**
 * Vortex Server — Entry point: boots the Express app and WebSocket hub.
 */

import 'dotenv/config';
import { createServer, type Server } from 'node:http';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Knex } from 'knex';
import { verifyToken } from '@vortex/core';
import { loadEnv } from './env.js';
import { EdgeCache, type AppContext, type StorageDriver } from './context.js';
import { createApp } from './app.js';
import { LocalStorageDriver } from './storage/local.driver.js';
import { R2StorageDriver } from './storage/r2.driver.js';

async function main(): Promise<void> {
  const env = loadEnv();

  // ── Database connection ─────────────────────────────────────────────────────
  const knex: Knex = require('knex')({
    client: 'pg',
    connection: env.db.connectionString,
    pool: { min: 2, max: 10 },
  });

  await knex.raw('SELECT 1');
  console.log('[vortex:db] Connected to PostgreSQL');

  // ── Storage driver ──────────────────────────────────────────────────────────
  const storage: StorageDriver =
    env.storage.driver === 'r2' && env.storage.r2
      ? new R2StorageDriver(env.storage.r2, env.jwt.secret)
      : new LocalStorageDriver(
          env.storage.localPath ?? './.vortex-storage',
          env.jwt.secret,
        );

  console.log(`[vortex:storage] Driver: ${env.storage.driver === 'r2' ? 'R2 (Cloudflare)' : 'Local Disk'}`);

  // ── App context ────────────────────────────────────────────────────────────
  const ctx: AppContext = {
    env,
    db: knex,
    edgeCache: new EdgeCache(),
    storage,
  };

  // ── Boot server ────────────────────────────────────────────────────────────
  const { app, wss, hub } = createApp(ctx);
  const server = createServer(app);

  // Attach WebSocket server to the HTTP server
  wss.removeAllListeners('connection');
  (wss as unknown as { server: Server }).server = server;

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = new URL(req.url ?? '', 'http://localhost').pathname;
    if (pathname !== env.realtime.path) {
      socket.destroy();
      return;
    }

    // Verify JWT token from the Authorization header or ?token= query param
    const authHeader = req.headers.authorization;
    const token =
      authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : new URL(req.url ?? '', 'http://localhost').searchParams.get('token') ?? '';

    if (!token) {
      socket.destroy();
      return;
    }

    try {
      verifyToken(token, env.jwt);
    } catch {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket as never, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  hub.attach(wss);

  server.listen(env.port, () => {
    console.log(`[vortex:server] Listening on port ${env.port}`);
    console.log(`[vortex:server] Realtime WebSocket at ${env.realtime.path}`);
    console.log(`[vortex:server] Environment: ${env.nodeEnv}`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(`[vortex:server] ${signal} received, shutting down...`);
    server.close(() => {
      knex.destroy().then(() => {
        console.log('[vortex:server] Database connection closed');
        process.exit(0);
      });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[vortex:fatal]', err);
  process.exit(1);
});
