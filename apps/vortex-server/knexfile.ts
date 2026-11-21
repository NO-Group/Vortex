import type { Knex } from 'knex';

const config: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/vortex',
    migrations: {
      directory: './migrations',
      tableName: 'vortex_migrations',
    },
  },
  production: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations',
      tableName: 'vortex_migrations',
    },
  },
};

export default config;
