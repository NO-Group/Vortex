import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { createDb } from './db/db.js';
import { runMigrations } from './db/migrate.js';
import { VortexEventBus } from './realtime/bus.js';
import { RealtimeHub } from './realtime/hub.js';
import { attachRealtimeServer } from './realtime/ws.server.js';
import { RedisEventBridge, type RedisPubSubClient } from './realtime/redis-bridge.js';
import { createStorageDriver } from './storage/storage.service.js';
import { PolicyService } from './policies/policy.service.js';
import { QueryGovernor } from './governance/query-governor.js';
import type { AppContext } from './context.js';

async function main(): Promise<void> {
  const env = loadEnv();
  const db = createDb(env);

  if (env.autoMigrate) {
    await runMigrations(db);
  }

  const ctx: AppContext = {
    env,
    db,
    bus: new VortexEventBus(),
    hub: new RealtimeHub(env.realtime.backlogSize),
    storage: createStorageDriver(env),
    policies: new PolicyService(db),
    governor: new QueryGovernor(db, {
      maxCost: env.maxQueryCost,
      slowQueryMs: env.slowQueryMs,
    }),
  };

  const app = createApp(ctx);
  const server = http.createServer(app);
  attachRealtimeServer(server, ctx);

  // Optional multi-node fan-out: sharing one Redis makes a cluster of
  // engines behave as a single realtime fabric.
  let bridge: RedisEventBridge | null = null;
  if (env.realtime.redisUrl) {
    const publisher = new Redis(env.realtime.redisUrl, { lazyConnect: true });
    const subscriber = new Redis(env.realtime.redisUrl, { lazyConnect: true });
    await publisher.connect();
    await subscriber.connect();
    bridge = new RedisEventBridge(
      ctx.bus,
      ctx.hub,
      publisher as unknown as RedisPubSubClient,
      subscriber as unknown as RedisPubSubClient,
      randomUUID(),
    );
    await bridge.start();
    // eslint-disable-next-line no-console
    console.log(`[vortex] redis fan-out bridge online (node ${bridge.nodeId})`);
  }

  server.listen(env.port, env.host, () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  ██╗   ██╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗',
        '  ██║   ██║██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝',
        '  ██║   ██║██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ ',
        '  ╚██╗ ██╔╝██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ ',
        '   ╚████╔╝ ╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗',
        '    ╚═══╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝',
        '',
        `  Vortex Engine v0.1.0`,
        `  → HTTP     http://${env.host}:${env.port}`,
        `  → Realtime ws://${env.host}:${env.port}/v1/realtime`,
        `  → Storage  driver=${env.storage.driver}`,
        '',
      ].join('\n'),
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log(`[vortex] ${signal} received, shutting down...`);
    server.close();
    await bridge?.stop();
    await db.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[vortex] fatal boot error:', err);
  process.exit(1);
});
