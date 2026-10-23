/**
 * Vortex preview stack — boots a self-contained live demo:
 *
 *   embedded PostgreSQL (:55432)  →  vortex-server (:8080)  →  demo seed data
 *
 * Usage:
 *   npm run build
 *   npm i --no-save embedded-postgres
 *   node scripts/preview-stack.mjs
 *
 * The dashboard (npm run dev -w @vortex/dashboard) proxies /v1 → :8080.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { spawn } from 'node:child_process';
import { Client } from 'pg';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'apps/vortex-server/dist/index.js');
const PORT = 8080;
const BASE = `http://127.0.0.1:${PORT}`;
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'vortex-preview-'));

const log = (...args) => console.log('[preview]', ...args);

async function waitHealthy(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/healthz`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  log('starting embedded PostgreSQL…');
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(TMP, 'pgdata'),
    user: 'postgres',
    password: 'postgres',
    port: 55432,
    persistent: false,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('vortex');
  log('postgres ready on :55432');

  log('booting vortex-server on :8080…');
  const server = spawn('node', [SERVER], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:55432/vortex',
      JWT_SECRET: 'vortex-preview-secret',
      AUTO_MIGRATE: 'true',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: path.join(TMP, 'data'),
      PUBLIC_API_BASE: 'auto',
      REALTIME_HEARTBEAT_MS: '30000',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });

  const shutdown = async () => {
    server.kill('SIGTERM');
    await pg.stop().catch(() => {});
    await fs.rm(TMP, { recursive: true, force: true }).catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  if (!(await waitHealthy())) {
    throw new Error('vortex-server never became healthy');
  }
  log('engine healthy — seeding demo data…');

  // Demo table (the seed RBAC grants give `user` owner-scoped access to notes)
  const admin = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:55432/vortex',
  });
  await admin.connect();
  await admin.query(`CREATE TABLE IF NOT EXISTS notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    body jsonb NOT NULL DEFAULT '{}',
    owner_id uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await admin.end();

  // Demo account through the public API
  const api = async (p, opts = {}) => {
    const res = await fetch(`${BASE}${p}`, {
      ...opts,
      headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  const creds = { email: 'sensei@no.group', password: 'vortex-secret-1' };
  let session = await api('/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ ...creds, metadata: { team: 'n-o', role_hint: 'demo' } }),
  });
  if (session.status === 409) {
    session = await api('/v1/auth/login', { method: 'POST', body: JSON.stringify(creds) });
  }
  const token = session.body.token;
  const auth = { authorization: `Bearer ${token}` };

  const existing = await api('/v1/db/notes/query', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ select: ['id'], limit: 1 }),
  });
  if (!existing.body.count) {
    await api('/v1/db/notes', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        rows: [
          { title: 'Welcome to Vortex', body: { tag: 'getting-started' } },
          { title: 'Realtime fan-out is live', body: { tag: 'engine', latency_ms: 4 } },
          { title: 'Owner-scoped RBAC active', body: { tag: 'security' } },
        ],
      }),
    });
  }

  log('seeded demo account sensei@no.group / vortex-secret-1');
  log('stack ready → http://localhost:' + PORT);
}

main().catch((err) => {
  console.error('[preview] fatal:', err);
  process.exit(1);
});
