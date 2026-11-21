import type { Knex } from 'knex';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const migrationsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Run all pending knex migrations. Safe to call on every boot. */
export async function runMigrations(db: Knex): Promise<void> {
  // Compiled output (dist) contains both .js and .d.ts — only load .js there;
  // running via tsx from src loads the .ts sources.
  const compiled = import.meta.url.endsWith('.js');
  const [batch, log] = await db.migrate.latest({
    directory: migrationsDir,
    loadExtensions: compiled ? ['.js'] : ['.ts', '.js'],
    sortDirsSeparately: true,
  });
  if (log.length > 0) {
    // eslint-disable-next-line no-console
    console.log(`[vortex] migrations applied (batch ${batch}):`, log.join(', '));
  }
}

/** CLI entrypoint: `npm run migrate` */
async function main(): Promise<void> {
  const { loadEnv } = await import('../config/env.js');
  const { createDb } = await import('./db.js');
  const env = loadEnv();
  const db = createDb(env);
  try {
    await runMigrations(db);
  } finally {
    await db.destroy();
  }
}

// Only run when invoked directly (not when imported by the server).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[vortex] migration failed:', err);
    process.exit(1);
  });
}
