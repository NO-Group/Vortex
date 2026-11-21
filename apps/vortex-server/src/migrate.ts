/**
 * Vortex Server — Migration runner.
 *
 * Runs Knex migrations to create/update database tables.
 * Usage: npm run migrate -w @vortex/server
 */

import 'dotenv/config';
import knexFactory from 'knex';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/vortex';

  const knex = knexFactory({
    client: 'pg',
    connection: connectionString,
  });

  console.log('[vortex:migrate] Running database migrations...');

  try {
    await knex.migrate.latest({
      directory: path.join(__dirname, '..', 'migrations'),
    });
    console.log('[vortex:migrate] Migrations complete.');
  } catch (err) {
    console.error('[vortex:migrate] Migration failed:', err);
    process.exit(1);
  } finally {
    await knex.destroy();
  }
}

main();
