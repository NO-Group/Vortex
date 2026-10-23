import http from 'node:http';
import { loadEnv } from './config/env.js';
import { createApp } from './app.js';
import { createDb } from './db/db.js';
import { runMigrations } from './db/migrate.js';
import { VortexEventBus } from './realtime/bus.js';
import { RealtimeHub } from './realtime/hub.js';
import { attachRealtimeServer } from './realtime/ws.server.js';
import { createStorageDriver } from './storage/storage.service.js';
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
    hub: new RealtimeHub(),
    storage: createStorageDriver(env),
  };

  const app = createApp(ctx);
  const server = http.createServer(app);
  attachRealtimeServer(server, ctx);

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
