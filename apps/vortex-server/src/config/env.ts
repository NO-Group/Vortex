import 'dotenv/config';

export type StorageProviderType =
  | 'cloudflare_r2'
  | 'aws_s3'
  | 'digitalocean_spaces'
  | 'gcs'
  | 'azure_blob'
  | 'local_disk'
  | 's3';

export type StorageDriverName = StorageProviderType;

export interface S3Config {
  bucket: string;
  region: string;
  endpoint: string | undefined;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

export interface MultiCloudStorageConfig {
  driver: StorageDriverName;
  localDir: string;
  publicApiBase: string;
  s3: S3Config;
  /** Optional fallback driver for automatic failover. */
  fallbackDriver?: StorageDriverName;
  /** Storage provider-specific config. */
  providerConfig: {
    r2?: { accountId: string };
    gcs?: { projectId: string };
    azure?: { connectionString: string };
  };
}

export interface ServerEnv {
  port: number;
  host: string;
  corsOrigins: string[] | '*';
  databaseUrl: string;
  jwt: {
    secret: string;
    expiresIn: string;
    issuer: string;
  };
  autoMigrate: boolean;
  storage: MultiCloudStorageConfig;
  realtime: {
    heartbeatMs: number;
    /** Optional Redis URL enabling the multi-node fan-out bridge. */
    redisUrl: string | undefined;
    /** Per-channel event buffer depth for reconnect replay. */
    backlogSize: number;
  };
  /**
   * Cost ceiling for governed queries. When set, every /v1/db query is
   * EXPLAINed before execution and rejected past this cost — the guardrail
   * Supabase doesn't have.
   */
  maxQueryCost: number | undefined;
  /** Log queries at or above this duration (ms) to the audit table. */
  slowQueryMs: number;
  /** FCM server key for push notifications (optional). */
  fcmServerKey: string | undefined;
  /** FCM HTTP v1: Firebase project ID. */
  fcmProjectId: string | undefined;
  /** FCM HTTP v1: service account private key (PEM). */
  fcmPrivateKey: string | undefined;
  /** APNs: Apple team ID (10-character). */
  apnsTeamId: string | undefined;
  /** APNs: Key ID (10-character identifier from Apple Developer portal). */
  apnsKeyId: string | undefined;
  /** APNs: App bundle ID (e.g. com.example.app). */
  apnsBundleId: string | undefined;
  /** APNs: AuthKey .p8 file contents (base64 PKCS#8). */
  apnsPrivateKey: string | undefined;
  /** APNs: use sandbox endpoint (default: false = production). */
  apnsSandbox: boolean;
  /** VAPID public key for Web Push (auto-generated if not set). */
  vapidPublicKey: string | undefined;
  /** VAPID private key for Web Push (auto-generated if not set). */
  vapidPrivateKey: string | undefined;
  /** VAPID subject (mailto: address for the push service). */
  vapidSubject: string;
  /** Notification delivery target. */
  notificationTarget: string;
  /** Edge cache TTL in seconds. */
  edgeCacheTtl: number;
  /** Edge cache max entries. */
  edgeCacheMaxEntries: number;
  /**
   * Expose magic-link / password-reset tokens in API responses (dev + demo
   * environments without SMTP). MUST be false in production.
   */
  devLinks: boolean;
  /** Absolute origin of the console (used in email links). */
  publicAppUrl: string;
  /** SMTP connection string (e.g. smtps://user:pass@smtp.host:465). */
  smtpUrl: string | undefined;
  /** From-address for magic-link / reset emails. */
  mailFrom: string;
  /** Serve the built dashboard from the engine (single-process deploys). */
  serveConsole: boolean;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${name} must be an integer`);
  return parsed;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

/** Load and validate the server environment. Throws on misconfiguration. */
export function loadEnv(): ServerEnv {
  const driverRaw = required('STORAGE_DRIVER', 'local_disk');
  const validDrivers: StorageDriverName[] = [
    'local_disk', 's3', 'cloudflare_r2', 'aws_s3',
    'digitalocean_spaces', 'gcs', 'azure_blob',
  ];
  if (!validDrivers.includes(driverRaw as StorageDriverName)) {
    throw new Error(`STORAGE_DRIVER must be one of ${validDrivers.join(', ')} (got "${driverRaw}")`);
  }

  const corsRaw = required('CORS_ORIGINS', '*');

  const env: ServerEnv = {
    port: int('PORT', 8080),
    host: required('HOST', '0.0.0.0'),
    corsOrigins: corsRaw === '*' ? '*' : corsRaw.split(',').map((o) => o.trim()).filter(Boolean),
    databaseUrl: required(
      'DATABASE_URL',
      'postgres://vortex:vortex@localhost:5432/vortex',
    ),
    jwt: {
      secret: required('JWT_SECRET', 'dev-only-change-me'),
      expiresIn: required('JWT_EXPIRES_IN', '1h'),
      issuer: required('JWT_ISSUER', 'vortex'),
    },
    autoMigrate: bool('AUTO_MIGRATE', true),
  storage: {
    driver: driverRaw as StorageDriverName,
    localDir: required('STORAGE_LOCAL_DIR', './.vortex-data'),
    /**
     * Absolute base for presigned URLs. Set to `auto` to derive from each
     * request's Host/protocol (correct behind reverse proxies & previews).
     */
    publicApiBase: required('PUBLIC_API_BASE', 'http://localhost:8080').replace(/\/+$/, ''),
    s3: {
      bucket: required('S3_BUCKET', 'vortex'),
      region: required('S3_REGION', 'auto'),
      endpoint: process.env.S3_ENDPOINT || undefined,
      accessKeyId: required('S3_ACCESS_KEY_ID', 'vortex'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY', 'vortex-secret'),
      forcePathStyle: bool('S3_FORCE_PATH_STYLE', true),
    },
    fallbackDriver: process.env.STORAGE_FALLBACK_DRIVER as StorageDriverName | undefined,
    providerConfig: {
      r2: process.env.CLOUDFLARE_ACCOUNT_ID
        ? { accountId: process.env.CLOUDFLARE_ACCOUNT_ID }
        : undefined,
      gcs: process.env.GCS_PROJECT_ID
        ? { projectId: process.env.GCS_PROJECT_ID }
        : undefined,
      azure: process.env.AZURE_CONNECTION_STRING
        ? { connectionString: process.env.AZURE_CONNECTION_STRING }
        : undefined,
    },
  },
    realtime: {
      heartbeatMs: int('REALTIME_HEARTBEAT_MS', 30_000),
      redisUrl: process.env.REDIS_URL || undefined,
      /** Per-channel event buffer depth for reconnect replay. */
      backlogSize: int('REALTIME_BACKLOG', 500),
    },
    devLinks: bool('VORTEX_DEV_LINKS', process.env.NODE_ENV !== 'production'),
    publicAppUrl: required('PUBLIC_APP_URL', 'http://localhost:8080').replace(/\/+$/, ''),
    smtpUrl: process.env.SMTP_URL || undefined,
    mailFrom: required('MAIL_FROM', 'Vortex <no-reply@vortex.local>'),
    serveConsole: bool('SERVE_CONSOLE', true),
    /**
     * Cost ceiling for governed queries. When set, every /v1/db query is
     * EXPLAINed before execution and rejected past this cost — the guardrail
     * Supabase doesn't have. Leave unset for no ceiling (dev default).
     */
    maxQueryCost: process.env.MAX_QUERY_COST ? Number(process.env.MAX_QUERY_COST) : undefined,
    /** Log queries at or above this duration (ms) to the audit table. */
    slowQueryMs: int('SLOW_QUERY_MS', 250),
    /** FCM server key for push notifications (optional). */
    fcmServerKey: process.env.FCM_SERVER_KEY || undefined,
    fcmProjectId: process.env.FCM_PROJECT_ID || undefined,
    fcmPrivateKey: process.env.FCM_PRIVATE_KEY || undefined,
    apnsTeamId: process.env.APNS_TEAM_ID || undefined,
    apnsKeyId: process.env.APNS_KEY_ID || undefined,
    apnsBundleId: process.env.APNS_BUNDLE_ID || undefined,
    apnsPrivateKey: process.env.APNS_PRIVATE_KEY || undefined,
    apnsSandbox: (process.env.APNS_SANDBOX || 'false').toLowerCase() === 'true',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || undefined,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || undefined,
    vapidSubject: process.env.VAPID_SUBJECT || 'noreply@vortex.local',
    /** Notification delivery target (all/web/ios/android). */
    notificationTarget: process.env.NOTIFICATION_TARGET || 'all',
    /** Edge cache TTL in seconds (default: 300). */
    edgeCacheTtl: int('EDGE_CACHE_TTL', 300),
    /** Edge cache max entries (default: 10000). */
    edgeCacheMaxEntries: int('EDGE_CACHE_MAX_ENTRIES', 10000),
  };

  // Production safety rails — refuse to boot a publicly reachable engine
  // with demo credentials or demo conveniences enabled.
  if (process.env.NODE_ENV === 'production') {
    if (env.jwt.secret === 'dev-only-change-me') {
      throw new Error('JWT_SECRET must be set to a long random value in production');
    }
    if (env.devLinks) {
      console.warn(
        '[vortex] WARNING: VORTEX_DEV_LINKS is on in production — sign-in links are returned via the API. Turn this off once SMTP is configured.',
      );
    }
  }

  return env;
}
