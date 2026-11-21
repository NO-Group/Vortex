/**
 * Vortex Server — Environment configuration.
 */

import type { JwtConfig } from '@vortex/core';

export interface ServerEnv {
  port: number;
  nodeEnv: string;
  jwt: JwtConfig;
  db: {
    connectionString: string;
  };
  storage: {
    driver: 'local' | 'r2';
    localPath?: string;
    r2?: {
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      bucket: string;
    };
    publicApiBase: string;
  };
  realtime: {
    path: string;
  };
  publicAppUrl: string;
  corsOrigin: string;
}

export function loadEnv(): ServerEnv {
  const port = Number(process.env.PORT ?? 4000);
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  // Hard fail in production if JWT_SECRET is not set
  const jwtSecret = process.env.JWT_SECRET;
  if (isProduction && !jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required in production. Refusing to start with a default secret.');
  }
  const resolvedJwtSecret = jwtSecret ?? 'dev-secret-change-in-production';

  const storageDriver = (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 'r2';

  const dbConnectionString =
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/vortex';

  const env: ServerEnv = {
    port,
    nodeEnv,
    jwt: {
      secret: resolvedJwtSecret,
      accessExpiry: process.env.JWT_ACCESS_EXPIRY ?? '1h',
      refreshExpiry: process.env.JWT_REFRESH_EXPIRY ?? '7d',
    },
    db: {
      connectionString: dbConnectionString,
    },
    storage: {
      driver: storageDriver,
      localPath: process.env.STORAGE_LOCAL_PATH ?? './.vortex-storage',
      r2: process.env.R2_ENDPOINT
        ? {
            endpoint: process.env.R2_ENDPOINT,
            accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
            bucket: process.env.R2_BUCKET ?? 'vortex',
          }
        : undefined,
      publicApiBase: process.env.PUBLIC_API_BASE ?? 'auto',
    },
    realtime: {
      path: process.env.REALTIME_PATH ?? '/v1/realtime',
    },
    publicAppUrl: process.env.PUBLIC_APP_URL ?? 'http://localhost:3000',
    corsOrigin: process.env.CORS_ORIGIN ?? (isProduction ? '' : '*'),
  };

  if (isProduction && !process.env.CORS_ORIGIN) {
    console.warn('[vortex:warn] CORS_ORIGIN not set in production. Defaulting to most restrictive (no external origins).');
  }

  return env;
}
