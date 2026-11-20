import knex, { type Knex } from 'knex';
import type { ServerEnv } from '../config/env.js';

/** Create the PostgreSQL connection pool. */
export function createDb(env: ServerEnv): Knex {
  return knex({
    client: 'pg',
    connection: env.databaseUrl,
    pool: { min: 2, max: 10 },
  });
}
