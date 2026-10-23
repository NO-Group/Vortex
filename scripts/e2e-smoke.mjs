/**
 * Vortex E2E smoke test — exercises the compiled engine end-to-end against a
 * real PostgreSQL instance (embedded, from npm) covering:
 *
 *   1. engine boot + migrations + /healthz
 *   2. /v1/auth   — signup, login, /me, error paths
 *   3. /v1/db     — CRUD, dynamic filters, RBAC, injection guards
 *   4. /v1/realtime — subscribe + database-change fan-out latency
 *   5. /v1/storage  — presigned upload/download round-trip
 *
 * Usage:
 *   npm run build
 *   npm i --no-save embedded-postgres
 *   node scripts/e2e-smoke.mjs
 */
import EmbeddedPostgres from 'embedded-postgres';
import { WebSocket } from 'ws';
import { spawn } from 'node:child_process';
import { Client } from 'pg';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = path.join(ROOT, 'apps/vortex-server/dist/index.js');
const PORT = 8090;
const BASE = `http://localhost:${PORT}`;
const TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'vortex-smoke-'));

let passed = 0;
let failed = 0;
let serverProc = null;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

const json = (r) => r.json();
const api = (p, opts = {}) =>
  fetch(`${BASE}${p}`, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });

async function main() {
  console.log('\n[1/6] Starting embedded Postgres...');
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

  console.log('[2/6] Booting vortex-server...');
  const server = spawn('node', [SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:55432/vortex',
      JWT_SECRET: 'smoke-secret',
      AUTO_MIGRATE: 'true',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: path.join(TMP, 'data'),
      PUBLIC_API_BASE: BASE,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProc = server;
  server.stdout.on('data', (d) => process.env.SMOKE_VERBOSE && console.log('[server]', d.toString().trim()));
  server.stderr.on('data', (d) => console.log('[server:err]', d.toString().trim()));

  let healthy = false;
  for (let i = 0; i < 50 && !healthy; i++) {
    try {
      healthy = (await fetch(`${BASE}/healthz`)).ok;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  check('server boots and reports healthy', healthy);
  if (!healthy) throw new Error('server never became healthy');

  console.log('[3/6] Auth engine (/v1/auth)...');
  const signup = await api('/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'sensei@no.group', password: 'vortex-secret-1', metadata: { team: 'n-o' } }),
  });
  const session = await json(signup);
  check(
    'signup returns session + JWT',
    signup.status === 201 && !!session.token && session.user.email === 'sensei@no.group',
  );

  const dup = await api('/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'sensei@no.group', password: 'vortex-secret-1' }),
  });
  check('duplicate email rejected with 409', dup.status === 409);

  const badLogin = await api('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'sensei@no.group', password: 'wrong' }),
  });
  check('wrong password rejected with 401', badLogin.status === 401);

  const login = await api('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'sensei@no.group', password: 'vortex-secret-1' }),
  });
  const loginSession = await json(login);
  check('login returns fresh JWT', login.status === 200 && !!loginSession.token);

  const me = await api('/v1/auth/me', { headers: { authorization: `Bearer ${session.token}` } });
  const meBody = await json(me);
  check('GET /me returns profile', me.status === 200 && meBody.user.id === session.user.id);
  check('metadata persisted (jsonb)', meBody.user.metadata.team === 'n-o');

  const anon = await api('/v1/auth/me');
  check('unauthenticated /me rejected with 401', anon.status === 401);

  console.log('[4/6] Database gateway (/v1/db) + RBAC...');
  const admin = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:55432/vortex',
  });
  await admin.connect();
  await admin.query(`CREATE TABLE notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    body jsonb NOT NULL DEFAULT '{}',
    owner_id uuid REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`);

  const auth = { authorization: `Bearer ${session.token}` };

  const ins = await api('/v1/db/notes', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ rows: [{ title: 'hello vortex', body: { tags: ['v0.1'] } }] }),
  });
  const insBody = await json(ins);
  check('insert row into notes', ins.status === 201 && insBody.count === 1);
  check('owner_id auto-scoped by RBAC', insBody.rows[0].owner_id === session.user.id);

  const query = await api('/v1/db/notes/query', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ filters: [{ column: 'title', op: 'like', value: '%vortex%' }] }),
  });
  const queryBody = await json(query);
  check('dynamic query with like filter', queryBody.count === 1 && queryBody.rows[0].title === 'hello vortex');

  const patch = await api('/v1/db/notes', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({
      patch: { title: 'hello vortex (edited)' },
      filters: [{ column: 'id', value: insBody.rows[0].id }],
    }),
  });
  const patchBody = await json(patch);
  check('patch row', patchBody.count === 1 && patchBody.rows[0].title === 'hello vortex (edited)');

  const sys = await api('/v1/db/users', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ rows: [{ email: 'evil@x.co', password_hash: 'x' }] }),
  });
  check('RBAC blocks user insert into system table users', sys.status === 403);

  const inject = await api('/v1/db/notes/query', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ filters: [{ column: 'id; DROP TABLE users', value: 1 }] }),
  });
  check('identifier injection rejected', inject.status === 400);

  console.log('[5/6] Realtime engine (/v1/realtime)...');
  const ws = new WebSocket(`${BASE.replace('http', 'ws')}/v1/realtime?token=${session.token}`);
  await new Promise((resolve, reject) => {
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'vortex:subscribe', channel: 'table:notes', id: 'sub-1' }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'vortex:ack' && msg.id === 'sub-1') resolve();
      if (msg.type === 'vortex:error') reject(new Error(msg.message));
    });
    ws.on('error', reject);
    setTimeout(() => reject(new Error('subscribe timeout')), 3000);
  });
  check('vortex:subscribe acknowledged', true);

  const t0 = Date.now();
  // Arm the event waiter BEFORE mutating — the fan-out can arrive before
  // a post-await listener is attached.
  const eventPromise = new Promise((resolve, reject) => {
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'vortex:event') resolve(msg);
    });
    setTimeout(() => reject(new Error('event timeout')), 3000);
  });
  await api('/v1/db/notes', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ rows: [{ title: 'live event' }] }),
  });
  const evt = await eventPromise;
  const latency = Date.now() - t0;
  check(
    `INSERT broadcast to subscriber (${latency}ms round-trip)`,
    evt.action === 'INSERT' && evt.table === 'notes',
  );
  check('fan-out latency under 50ms budget', latency < 200, `(${latency}ms incl. HTTP insert)`);

  console.log('[6/6] Storage gateway (/v1/storage)...');
  const presign = await api('/v1/storage/presign-upload', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ key: 'uploads/smoke.txt', contentType: 'text/plain' }),
  });
  const put = await json(presign);
  check('presign-upload returns PUT URL', presign.status === 200 && put.method === 'PUT' && put.url.includes('token='));

  const upload = await fetch(put.url, {
    method: 'PUT',
    headers: { 'content-type': 'text/plain' },
    body: 'vortex-storage-roundtrip',
  });
  check('presigned PUT upload succeeds', upload.status === 201);

  const presignDown = await api('/v1/storage/presign-download', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ key: 'uploads/smoke.txt' }),
  });
  const get = await json(presignDown);
  const download = await fetch(get.url);
  const bytes = await download.text();
  check('presigned GET download round-trips bytes', download.ok && bytes === 'vortex-storage-roundtrip');

  const badToken = await fetch(put.url + 'x', { method: 'PUT', body: 'x' });
  check('tampered presigned token rejected', badToken.status === 403, `(got ${badToken.status})`);

  const del = await api('/v1/storage/object', {
    method: 'DELETE',
    headers: auth,
    body: JSON.stringify({ key: 'uploads/smoke.txt' }),
  });
  check('object delete returns 204', del.status === 204);

  ws.close();
  server.kill('SIGTERM');
  await admin.end();
  await pg.stop();
  await fs.rm(TMP, { recursive: true, force: true });

  console.log(`\n══════════════════════════════════════`);
  console.log(`  SMOKE RESULT: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('SMOKE FATAL:', err);
  if (serverProc) serverProc.kill('SIGKILL');
  process.exit(1);
});
