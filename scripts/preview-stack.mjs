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
      VORTEX_DEV_LINKS: '1',
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

  // Promote the demo account so the console's admin surfaces (SQL console,
  // account administration) are explorable out of the box.
  const promoteDb = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:55432/vortex',
  });
  await promoteDb.connect();
  await promoteDb.query(`UPDATE users SET role = 'admin' WHERE email = 'sensei@no.group'`);
  await promoteDb.end();
  log('demo account promoted to admin');

  // ── Demo app: prove Vortex can carry apps — /apps/welcome/ ────────────
  const apps = await api('/v1/apps', { headers: auth });
  const hasWelcome = (apps.body.apps ?? []).some((a) => a.name === 'welcome');
  if (!hasWelcome) {
    await api('/v1/apps', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ name: 'welcome', title: 'Welcome to Vortex Apps' }),
    });

    const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Welcome — Vortex Apps</title>
<style>
  body { margin:0; min-height:100vh; background:#000; color:#E6EDF3; font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
    display:flex; align-items:center; justify-content:center;
    background-image: radial-gradient(ellipse 55% 45% at 12% -8%, rgba(0,75,255,.22), transparent 55%),
      radial-gradient(ellipse 50% 40% at 88% 108%, rgba(0,210,255,.16), transparent 55%); }
  .glass { background:rgba(255,255,255,.04); backdrop-filter:blur(14px); border:1px solid rgba(255,255,255,.1);
    border-radius:20px; padding:48px 52px; max-width:560px; text-align:center; }
  .ring { width:96px; height:96px; margin:0 auto 22px; border-radius:28px; padding:2px;
    background:conic-gradient(from 0deg,#004BFF,#A38CFF,#FFA1C5,#00D2FF,#00E6A6,#1BFF6B,#004BFF); }
  .ring > div { width:100%; height:100%; border-radius:26px; background:#090C10; display:flex; align-items:center; justify-content:center; font-size:44px; }
  h1 { margin:0 0 6px; font-size:30px; letter-spacing:.06em; }
  .grad { background:conic-gradient(from 0deg,#004BFF,#A38CFF,#FFA1C5,#00D2FF,#00E6A6,#1BFF6B,#004BFF);
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  p { color:#8B949E; line-height:1.6; margin:14px 0 0; }
  code { background:#090C10; border:1px solid #161B22; border-radius:8px; padding:2px 8px; font-size:13px; color:#00D2FF; }
  a { color:#3379FF; text-decoration:none; }
</style></head>
<body><div class="glass">
  <div class="ring"><div>🌪️</div></div>
  <h1>YOUR APP IS <span class="grad">LIVE</span></h1>
  <p>This page is served by the <b>Vortex Apps</b> gateway — deployed from the console,
     hosted on the engine at <code>/apps/welcome/</code>.</p>
  <p>Drop any static build (Vite, Next export, Flutter web…) into the Apps page
     and it ships instantly.<br><br><a href="/">← back to the Vortex Console</a></p>
</div></body></html>`;

    const up = await fetch(`${BASE}/v1/apps/welcome/files?path=index.html`, {
      method: 'POST',
      headers: {
        'content-type': 'text/html; charset=utf-8',
        authorization: `Bearer ${token}`,
      },
      body: html,
    });
    log(`demo app deployed → /apps/welcome/ (upload ${up.status})`);
  }

  // ── Demo function: prove Vortex Functions — /functions/pulse ──────────
  const fns = await api('/v1/functions', { headers: auth });
  const hasPulse = (fns.body.functions ?? []).some((f) => f.name === 'pulse');
  if (!hasPulse) {
    await api('/v1/functions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        name: 'pulse',
        title: 'Engine Pulse',
        source: `async (req, ctx) => {
  const notes = await ctx.data.query('notes', { limit: 5, countTotal: true });
  return {
    status: 200,
    body: {
      message: 'The engine is alive.',
      echo: req.query.ping ?? 'no ping given',
      caller: req.user?.sub ?? 'anonymous',
      notes: notes.total ?? notes.count,
      at: new Date().toISOString(),
    },
  };
}`,
      }),
    });
    log('demo function deployed → /functions/pulse');
  }

  log('stack ready → http://localhost:' + PORT);
}

main().catch((err) => {
  console.error('[preview] fatal:', err);
  process.exit(1);
});
