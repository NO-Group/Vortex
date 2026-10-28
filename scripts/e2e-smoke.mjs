/**
 * Vortex E2E smoke test — exercises the compiled engine end-to-end against a
 * real PostgreSQL instance (embedded, from npm) covering:
 *
 *   1. engine boot + migrations + /healthz
 *   2. /v1/auth   — signup, login, /me, error paths
 *   3. /v1/db     — CRUD, dynamic filters, RBAC, injection guards
 *   4. /v1/realtime — subscribe + database-change fan-out latency
 *   5. /v1/storage  — presigned upload/download round-trip
 *   6. /v1/apps     — static app hosting
 *   7. /v1/sql      — admin SQL console
 *   8. /v1/auth     — magic links, password reset, admin users, custom claims
 *   9. /v1/storage  — buckets + public reads
 *  10. /functions   — Vortex Functions (deploy, invoke, timeout, pause)
 *  11. realtime     — broadcast + presence
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

/** Poll until fn() is truthy (or throw after `ms`). */
const waitFor = async (fn, ms = 3000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn()) return true;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('waitFor timeout');
};

const once = (emitter, event) => new Promise((resolve) => emitter.once(event, resolve));

async function main() {
  console.log('\n[1/12] Starting embedded Postgres...');
  const pg = new EmbeddedPostgres({
    databaseDir: path.join(TMP, 'pgdata'),
    user: 'postgres',
    password: 'postgres',
    port: 55433,
    persistent: false,
    onLog: () => {},
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('vortex');

  console.log('[2/12] Booting vortex-server...');
  const server = spawn('node', [SERVER], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgres://postgres:postgres@localhost:55433/vortex',
      JWT_SECRET: 'smoke-secret',
      AUTO_MIGRATE: 'true',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_DIR: path.join(TMP, 'data'),
      PUBLIC_API_BASE: BASE,
      VORTEX_DEV_LINKS: '1',
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

  console.log('[3/12] Auth engine (/v1/auth)...');
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

  console.log('[4/12] Database gateway (/v1/db) + RBAC...');
  const admin = new Client({
    connectionString: 'postgres://postgres:postgres@localhost:55433/vortex',
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

  console.log('[5/12] Realtime engine (/v1/realtime)...');
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

  console.log('[6/12] Storage gateway (/v1/storage)...');
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

  console.log('[7/12] Apps hosting (/v1/apps + /apps/*)...');
  const createApp = await api('/v1/apps', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'smoke-app', title: 'Smoke App' }),
  });
  check('create app', createApp.status === 201);

  const badName = await api('/v1/apps', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'Bad Name!' }),
  });
  check('invalid app name rejected', badName.status === 400);

  const deploy = await fetch(`${BASE}/v1/apps/smoke-app/files?path=index.html`, {
    method: 'POST',
    headers: { 'content-type': 'text/html', ...auth },
    body: '<h1>smoke-hosted</h1>',
  });
  check('deploy index.html', deploy.status === 201);

  const page = await fetch(`${BASE}/apps/smoke-app/`);
  const pageBody = await page.text();
  check('app served at /apps/smoke-app/', page.ok && pageBody.includes('smoke-hosted'));

  const spa = await fetch(`${BASE}/apps/smoke-app/some/deep/route`);
  check('SPA fallback serves index.html', spa.ok && (await spa.text()).includes('smoke-hosted'));

  const gone = await fetch(`${BASE}/apps/does-not-exist/`);
  check('unknown app returns 404 page', gone.status === 404);

  const listFiles = await api('/v1/apps/smoke-app/files', { headers: auth });
  const listBody = await listFiles.json();
  check('file manifest lists deploy', listFiles.ok && listBody.files.length === 1);

  const delApp = await api('/v1/apps/smoke-app', { method: 'DELETE', headers: auth });
  check('delete app returns 204', delApp.status === 204);

  const afterDel = await fetch(`${BASE}/apps/smoke-app/`);
  check('deleted app no longer served', afterDel.status === 404);

  console.log('[8/12] SQL console (/v1/sql)...');
  // Promote the demo user via SQL and re-login for an admin JWT.
  await admin.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [session.user.email]);
  const adminLogin = await api('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: session.user.email, password: 'vortex-secret-1' }),
  });
  const adminSession = await adminLogin.json();
  const adminAuth = { authorization: `Bearer ${adminSession.token}` };
  check('admin session obtained', adminLogin.status === 200 && !!adminSession.token);

  const sqlNonAdmin = await api('/v1/sql', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ sql: 'select 1' }),
  });
  check('SQL console is admin-only', sqlNonAdmin.status === 403);

  const sql = await api('/v1/sql', {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({ sql: 'select $1::int as answer', params: [42] }),
  });
  const sqlBody = await sql.json();
  check(
    'admin SQL returns rows',
    sql.ok && sqlBody.rows[0]?.answer === 42 && sqlBody.durationMs >= 0,
    `(${sql.status})`,
  );

  const sqlMulti = await api('/v1/sql', {
    method: 'POST',
    headers: adminAuth,
    body: JSON.stringify({ sql: 'select 1; drop table users' }),
  });
  check('multi-statement SQL rejected', sqlMulti.status === 400);

  console.log('[9/12] Passwordless auth + admin users...');
  const magic = await api('/v1/auth/magic-link', {
    method: 'POST',
    body: JSON.stringify({ email: session.user.email }),
  });
  const magicBody = await magic.json();
  check('magic link issued (dev token)', magic.status === 202 && !!magicBody.devToken);

  const badMagic = await api('/v1/auth/magic-link/verify', {
    method: 'POST',
    body: JSON.stringify({ token: 'f'.repeat(64) }),
  });
  check('bogus magic token rejected', badMagic.status === 401);

  const magicSession = await api('/v1/auth/magic-link/verify', {
    method: 'POST',
    body: JSON.stringify({ token: magicBody.devToken }),
  });
  const magicSessionBody = await magicSession.json();
  check('magic link opens a session', magicSession.ok && !!magicSessionBody.token);

  const magicReuse = await api('/v1/auth/magic-link/verify', {
    method: 'POST',
    body: JSON.stringify({ token: magicBody.devToken }),
  });
  check('magic tokens are single-use', magicReuse.status === 401);

  const reset = await api('/v1/auth/password-reset', {
    method: 'POST',
    body: JSON.stringify({ email: session.user.email }),
  });
  const resetBody = await reset.json();
  check('password reset issued', reset.status === 202 && !!resetBody.devToken);

  const confirm = await api('/v1/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token: resetBody.devToken, password: 'vortex-secret-2' }),
  });
  check('password reset confirms + logs in', confirm.status === 200);
  const relogin = await api('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: session.user.email, password: 'vortex-secret-2' }),
  });
  check('new password works', relogin.status === 200);

  const usersAsUser = await api('/v1/auth/users', { headers: auth });
  check('user listing is admin-only', usersAsUser.status === 403);

  const second = await api('/v1/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email: 'member@no.group', password: 'member-secret-1' }),
  });
  check('second account created', second.status === 201);

  const users = await api('/v1/auth/users', { headers: adminAuth });
  const usersBody = await users.json();
  check('admin lists accounts', users.ok && usersBody.users.length >= 2);

  const setClaims = await api(`/v1/auth/users/${session.user.id}`, {
    method: 'PATCH',
    headers: adminAuth,
    body: JSON.stringify({ metadata: { plan: 'pro', seat: 7 } }),
  });
  check('admin sets custom claims', setClaims.status === 200);

  const claimed = await api('/v1/auth/me', {
    headers: { authorization: `Bearer ${magicSessionBody.token}` },
  });
  const claimedBody = await claimed.json();
  check('custom claims land in the profile', claimedBody.user?.metadata?.plan === 'pro');

  const promoted = await api(`/v1/auth/users/${session.user.id}`, {
    method: 'PATCH',
    headers: adminAuth,
    body: JSON.stringify({ role: 'user' }),
  });
  check('admin can change roles', promoted.status === 200);

  console.log('[10/12] Storage buckets...');
  const mkBucket = await api('/v1/storage/buckets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'smoke-bucket', public: true }),
  });
  check('create bucket', mkBucket.status === 201);

  const dupBucket = await api('/v1/storage/buckets', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'smoke-bucket', public: true }),
  });
  check('duplicate bucket rejected', dupBucket.status === 409);

  const badKey = await api('/v1/storage/presign-upload', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ key: 'no-such-bucket/file.txt' }),
  });
  check('upload into unknown bucket rejected', badKey.status === 400);

  const bucketPut = await fetch(`${BASE}/v1/storage/upload?key=smoke-bucket/hello.txt`, {
    method: 'POST',
    headers: { 'content-type': 'text/plain', ...auth },
    body: 'bucketed hello',
  });
  check('upload into bucket', bucketPut.status === 201);

  const pubGet = await fetch(`${BASE}/v1/storage/public/smoke-bucket/hello.txt`);
  check('public bucket serves anonymously', pubGet.ok && (await pubGet.text()) === 'bucketed hello');

  const privGet = await fetch(`${BASE}/v1/storage/public/uploads/nope.txt`);
  check('private bucket 404s publicly', privGet.status === 404);

  const listBuckets = await api('/v1/storage/buckets', { headers: auth });
  const listBucketBody = await listBuckets.json();
  check('bucket listing', listBuckets.ok && listBucketBody.buckets.length >= 3);

  await api('/v1/storage/buckets/smoke-bucket', { method: 'DELETE', headers: auth });
  const goneBucket = await fetch(`${BASE}/v1/storage/public/smoke-bucket/hello.txt`);
  check('deleted bucket no longer serves', goneBucket.status === 404);

  console.log('[11/12] Vortex Functions (/v1/functions + /functions/:name)...');
  const makeFn = await api('/v1/functions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'smoke-fn',
      title: 'Smoke Function',
      source: `async (req, ctx) => ({ status: 200, body: { echo: req.query.n ?? 'none', user: req.user?.sub ?? null, rows: (await ctx.data.query('notes', { limit: 3 })).count } })`,
    }),
  });
  check('deploy function', makeFn.status === 201);

  const badFn = await api('/v1/functions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ name: 'smoke-fn', source: 'async () => ({})' }),
  });
  check('duplicate function rejected', badFn.status === 409);

  const invokeAnon = await fetch(`${BASE}/functions/smoke-fn?n=hello`);
  const invokeAnonBody = await invokeAnon.json();
  check(
    'anonymous invocation works',
    invokeAnon.ok && invokeAnonBody.echo === 'hello' && invokeAnonBody.user === null,
  );

  const invokeAuth = await fetch(`${BASE}/functions/smoke-fn?n=authed`, {
    headers: auth,
  });
  const invokeAuthBody = await invokeAuth.json();
  check(
    'invocation sees the caller',
    invokeAuth.ok && invokeAuthBody.user === session.user.id,
  );

  const slowFn = await api('/v1/functions', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: 'slow-fn',
      source: `async () => { await new Promise((r) => setTimeout(r, 8000)); return 'late'; }`,
    }),
  });
  check('deploy slow function', slowFn.status === 201);
  const slowCall = await fetch(`${BASE}/functions/slow-fn`);
  check('slow function hits the wall', slowCall.status === 508, `(got ${slowCall.status})`);

  const patchedFn = await api('/v1/functions/smoke-fn', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'paused' }),
  });
  check('pause function', patchedFn.status === 200);
  const pausedCall = await fetch(`${BASE}/functions/smoke-fn`);
  check('paused function is off', pausedCall.status === 404);

  await api('/v1/functions/smoke-fn', { method: 'DELETE', headers: auth });
  await api('/v1/functions/slow-fn', { method: 'DELETE', headers: auth });

  console.log('[12/15] Realtime broadcast + presence...');
  {
    const roomUrl = `${BASE.replace('http', 'ws')}/v1/realtime?token=${session.token}`;
    const s1 = new WebSocket(roomUrl);
    const s2 = new WebSocket(roomUrl);
    const frames1 = [];
    const frames2 = [];
    s1.on('message', (d) => frames1.push(JSON.parse(d.toString())));
    s2.on('message', (d) => frames2.push(JSON.parse(d.toString())));
    await once(s1, 'open');
    await once(s2, 'open');
    await waitFor(() => frames1.some((f) => f.type === 'vortex:welcome'));
    await waitFor(() => frames2.some((f) => f.type === 'vortex:welcome'));

    s1.send(JSON.stringify({ type: 'vortex:subscribe', channel: 'room:smoke', id: 's1' }));
    s2.send(JSON.stringify({ type: 'vortex:subscribe', channel: 'room:smoke', id: 's2' }));
    await waitFor(() => frames1.some((f) => f.type === 'vortex:ack' && f.id === 's1'));

    s1.send(
      JSON.stringify({
        type: 'vortex:presence',
        action: 'track',
        channel: 'room:smoke',
        state: { name: 'one' },
      }),
    );
    await waitFor(() => frames2.some((f) => f.type === 'vortex:presence_diff' && f.joins?.length === 1));
    check('presence join is diffed to the room', true);

    s2.send(
      JSON.stringify({
        type: 'vortex:broadcast',
        channel: 'room:smoke',
        event: 'chat',
        payload: { text: 'ping' },
        id: 'b1',
      }),
    );
    await waitFor(() => frames1.some((f) => f.type === 'vortex:broadcast' && f.event === 'chat'));
    check('broadcast reaches the room', true, `(${Date.now() % 1000}ms)`);

    const syncSeen = frames1.some((f) => f.type === 'vortex:presence_sync' && f.peers?.length >= 1);
    check('presence sync lists peers', syncSeen);

    s1.close();
    await waitFor(() => frames2.some((f) => f.type === 'vortex:presence_diff' && f.leaves?.length === 1));
    check('presence leave is diffed on disconnect', true);
    s2.close();
  }

  console.log('[13/15] Row policies — compiled once, not called per row...');
  {
    const usersAll = await (await api('/v1/auth/users', { headers: adminAuth })).json();
    const member = usersAll.users.find((u) => u.email === 'member@no.group');

    // A table with NO owner scoping, so the policy is the only thing filtering.
    await api('/v1/sql', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        sql: `create table if not exists reports (
                id uuid primary key default gen_random_uuid(),
                title text not null,
                owner_id uuid,
                created_at timestamptz not null default now()
              )`,
      }),
    });
    await api('/v1/sql', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        sql: `insert into table_permissions
                (role, table_name, can_select, can_insert, can_update, can_delete, owner_column)
              values ('user','reports',true,true,true,true,null)
              on conflict do nothing`,
      }),
    });

    const memberLogin = await api('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'member@no.group', password: 'member-secret-1' }),
    });
    const memberToken = (await memberLogin.json()).token;
    const memberAuth = { authorization: `Bearer ${memberToken}` };

    await api('/v1/db/reports', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        rows: [
          { title: 'sensei report', owner_id: adminSession.user.id },
          { title: 'member report', owner_id: member.id },
        ],
      }),
    });

    const before = await (
      await api('/v1/db/reports/query', {
        method: 'POST',
        headers: memberAuth,
        body: JSON.stringify({ countTotal: true }),
      })
    ).json();
    check('before a policy: tenant sees every row', before.total === 2, `(got ${before.total})`);

    const created = await api('/v1/policies', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        name: 'reports are private',
        tableName: 'reports',
        action: 'select',
        roles: ['user'],
        using: { column: 'owner_id', valueRef: 'user.id' },
      }),
    });
    check('admin creates a row policy over the API', created.status === 201);

    const preview = await (
      await api('/v1/policies/preview', {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({ tableName: 'reports', action: 'select', role: 'user' }),
      })
    ).json();
    check(
      'policy compiles identity to a bound literal (not auth.uid())',
      preview.using?.sql === '"owner_id" = ?' && Array.isArray(preview.using?.bindings),
      `(got ${JSON.stringify(preview.using)})`,
    );
    check(
      'preview shows the per-row form Vortex replaces',
      /auth\.uid\(\)/.test(preview.comparison?.perRowEquivalent ?? ''),
      `(got ${JSON.stringify(preview.comparison?.perRowEquivalent)})`,
    );

    const after = await (
      await api('/v1/db/reports/query', {
        method: 'POST',
        headers: memberAuth,
        body: JSON.stringify({ countTotal: true }),
      })
    ).json();
    check('policy hides other tenants rows', after.total === 1, `(got ${after.total})`);

    const adminView = await (
      await api('/v1/db/reports/query', {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({ countTotal: true }),
      })
    ).json();
    check('admin bypasses row policies', adminView.total === 2, `(got ${adminView.total})`);

    await api('/v1/policies', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        name: 'reports stay owned',
        tableName: 'reports',
        action: 'insert',
        roles: ['user'],
        using: { column: 'owner_id', valueRef: 'user.id' },
      }),
    });

    const forged = await api('/v1/db/reports', {
      method: 'POST',
      headers: memberAuth,
      body: JSON.stringify({ rows: [{ title: 'forged', owner_id: adminSession.user.id }] }),
    });
    check('with-check blocks writing a row owned by someone else', forged.status === 403, `(got ${forged.status})`);

    const own = await api('/v1/db/reports', {
      method: 'POST',
      headers: memberAuth,
      body: JSON.stringify({ rows: [{ title: 'mine', owner_id: member.id }] }),
    });
    check('with-check allows writing your own row', own.status === 201, `(got ${own.status})`);

    const policyAsUser = await api('/v1/policies', { headers: memberAuth });
    check('policy management is admin-only', policyAsUser.status === 403);
  }

  console.log('[14/15] Query governance — measured plans + a cost ceiling...');
  {
    const explained = await (
      await api('/v1/db/reports/query', {
        method: 'POST',
        headers: adminAuth,
        body: JSON.stringify({ limit: 5, explain: true }),
      })
    ).json();

    check(
      'explain returns a real planner cost',
      typeof explained.explain?.plan?.cost === 'number' && explained.explain.plan.cost > 0,
      `(got ${JSON.stringify(explained.explain?.plan?.cost)})`,
    );
    check(
      'explain returns a readable plan summary',
      Array.isArray(explained.explain?.plan?.summary) && explained.explain.plan.summary.length > 0,
    );
    check(
      'explain reports the SQL that ran',
      typeof explained.explain?.sql === 'string' && explained.explain.sql.includes('reports'),
    );

    const overview = await (await api('/v1/insights/overview', { headers: adminAuth })).json();
    check('insights overview is served to admins', overview.window === '1 hour' && typeof overview.total === 'number');

    const memberToken2 = (await (
      await api('/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'member@no.group', password: 'member-secret-1' }),
      })
    ).json()).token;
    const insightsAsUser = await api('/v1/insights/overview', {
      headers: { authorization: `Bearer ${memberToken2}` },
    });
    check('insights are admin-only', insightsAsUser.status === 403);

    // A second engine with the ceiling set to the floor: nothing may run.
    const CAPPED_PORT = PORT + 1;
    const cappedBase = `http://127.0.0.1:${CAPPED_PORT}`;
    const capped = spawn('node', [SERVER], {
      env: {
        ...process.env,
        PORT: String(CAPPED_PORT),
        HOST: '127.0.0.1',
        DATABASE_URL: 'postgres://postgres:postgres@localhost:55433/vortex',
        JWT_SECRET: 'smoke-secret',
        AUTO_MIGRATE: 'false',
        STORAGE_DRIVER: 'local',
        STORAGE_LOCAL_DIR: path.join(TMP, 'data'),
        PUBLIC_API_BASE: cappedBase,
        MAX_QUERY_COST: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let cappedUp = false;
    for (let i = 0; i < 40 && !cappedUp; i++) {
      try {
        cappedUp = (await fetch(`${cappedBase}/healthz`)).ok;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    check('engine with a cost ceiling boots', cappedUp);

    if (cappedUp) {
      const cappedRes = await fetch(`${cappedBase}/v1/db/reports/query`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminSession.token}`,
        },
        body: JSON.stringify({ limit: 5 }),
      });
      const cappedBody = await cappedRes.json();
      check(
        'cost ceiling refuses the query (429 query_too_expensive)',
        cappedRes.status === 429 && cappedBody.error?.code === 'query_too_expensive',
        `(got ${cappedRes.status} ${JSON.stringify(cappedBody.error?.code)})`,
      );
      check(
        'refusal explains the cost it measured',
        /exceeds the configured ceiling/.test(cappedBody.error?.message ?? ''),
      );

      const cappedSql = await fetch(`${cappedBase}/v1/sql`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${adminSession.token}`,
        },
        body: JSON.stringify({ sql: 'select 1 as ok' }),
      });
      check('the SQL console stays usable under a ceiling', cappedSql.status === 200, `(got ${cappedSql.status})`);
    }
    capped.kill('SIGKILL');
  }

  console.log('[15/17] Durable realtime — replay after a disconnect...');
  {
    const rtUrl = `${BASE.replace('http', 'ws')}/v1/realtime?token=${adminSession.token}`;
    const waitSoft = async (fn, ms = 3000) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) {
        if (fn()) return true;
        await new Promise((r) => setTimeout(r, 25));
      }
      return false;
    };

    const s1 = new WebSocket(rtUrl);
    const frames1 = [];
    s1.on('message', (d) => frames1.push(JSON.parse(d.toString())));
    await once(s1, 'open');
    await waitFor(() => frames1.some((f) => f.type === 'vortex:welcome'));
    s1.send(JSON.stringify({ type: 'vortex:subscribe', channel: 'table:reports', id: 'r1' }));
    await waitFor(() => frames1.some((f) => f.type === 'vortex:ack' && f.id === 'r1'));

    await api('/v1/db/reports', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ rows: [{ title: 'live-1', owner_id: adminSession.user.id }] }),
    });
    await waitFor(() => frames1.some((f) => f.type === 'vortex:event' && f.seq > 0));
    const lastSeq = Math.max(...frames1.filter((f) => f.type === 'vortex:event').map((f) => f.seq));
    check('live events carry a sequence number', Number.isFinite(lastSeq) && lastSeq > 0, `(got ${lastSeq})`);

    // Drop the connection and change rows while nobody is listening.
    s1.close();
    await new Promise((r) => setTimeout(r, 300));
    await api('/v1/db/reports', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ rows: [{ title: 'missed-1', owner_id: adminSession.user.id }] }),
    });
    await api('/v1/db/reports', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ rows: [{ title: 'missed-2', owner_id: adminSession.user.id }] }),
    });

    const s2 = new WebSocket(rtUrl);
    const frames2 = [];
    s2.on('message', (d) => frames2.push(JSON.parse(d.toString())));
    await once(s2, 'open');
    await waitFor(() => frames2.some((f) => f.type === 'vortex:welcome'));
    s2.send(JSON.stringify({ type: 'vortex:subscribe', channel: 'table:reports', since: lastSeq, id: 'r2' }));

    const gotReplay = await waitSoft(() => frames2.some((f) => f.type === 'vortex:replay'), 4000);
    const replayed = frames2.filter((f) => f.type === 'vortex:event' && f.replay === true);
    const replayFrame = frames2.find((f) => f.type === 'vortex:replay');

    check('reconnect replays the events it missed', gotReplay && replayed.length >= 2, `(got ${replayed.length})`);
    check(
      'replayed frames are flagged as history, not live',
      replayed.length > 0 && replayed.every((f) => f.seq > lastSeq),
    );
    check(
      'server reports the replay window and cursor',
      replayFrame?.count === replayed.length && typeof replayFrame?.cursor === 'number',
      `(count=${replayFrame?.count} cursor=${replayFrame?.cursor})`,
    );
    check('a short gap is not silently truncated', replayFrame?.truncated === false);
    s2.close();
  }

  console.log('[16/17] Scheduled Jobs — cron management + manual trigger...');
  {
    // Deploy a function that the cron job will invoke
    const fnRes = await api('/v1/functions', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        name: 'smoke-cron-fn',
        source: `async (req, ctx) => {
          return { status: 200, body: { ran: true, ts: Date.now() } };
        }`,
      }),
    });
    check('cron: function deployed', fnRes.ok);

    // Create a scheduled job
    const createRes = await api('/v1/cron/jobs', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        name: 'smoke-cron-job',
        functionName: 'smoke-cron-fn',
        cronExpression: '*/5 * * * *',
        payload: { test: true },
      }),
    });
    check('cron: job created', createRes.ok);
    const cronBody = await createRes.json();
    check('cron: job has next_run_at', cronBody.job?.nextRunAt !== null);
    check('cron: job status enabled', cronBody.job?.status === 'enabled');

    // List jobs
    const listRes = await api('/v1/cron/jobs', { headers: auth });
    const listBody = await listRes.json();
    check('cron: job appears in list', listBody.jobs?.some((j) => j.name === 'smoke-cron-job'));

    // Manually trigger the job
    const triggerRes = await api('/v1/cron/jobs/smoke-cron-job/trigger', {
      method: 'POST',
      headers: auth,
      body: '{}',
    });
    check('cron: manual trigger succeeds', triggerRes.ok);
    const triggerBody = await triggerRes.json();
    check('cron: trigger returns result', triggerBody.result !== null);
    check('cron: trigger result has ran=true', triggerBody.result?.ran === true);

    // Check execution history
    const runsRes = await api('/v1/cron/jobs/smoke-cron-job/runs', { headers: auth });
    const runsBody = await runsRes.json();
    check('cron: run history recorded', runsBody.runs?.length >= 1);
    check('cron: run status is success', runsBody.runs?.[0]?.status === 'success');
    check('cron: run has duration', runsBody.runs?.[0]?.durationMs !== null);

    // Disable the job
    const disableRes = await api('/v1/cron/jobs/smoke-cron-job', {
      method: 'PATCH',
      headers: auth,
      body: JSON.stringify({ status: 'disabled' }),
    });
    check('cron: job disabled', disableRes.ok);
    const disabledBody = await disableRes.json();
    check('cron: job status is disabled', disabledBody.job?.status === 'disabled');

    // Scheduler status
    const schedRes = await api('/v1/cron/scheduler', { headers: auth });
    const schedBody = await schedRes.json();
    check('cron: scheduler is running', schedBody.running === true);
    check('cron: scheduler has tick count', schedBody.tickCount >= 1);

    // Clean up — delete the job
    const delRes = await api('/v1/cron/jobs/smoke-cron-job', { method: 'DELETE', headers: auth });
    check('cron: job deleted', delRes.status === 204);

    // Delete the function too
    await api('/v1/functions/smoke-cron-fn', { method: 'DELETE', headers: auth });
  }

  console.log('[17/17] Full-text Search — GIN index + keyword search...');
  {
    // Create a table with some text content to search
    const createTable = await api('/v1/db/smoke_articles/create', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({
        columns: [
          { name: 'title', type: 'text', required: false },
          { name: 'body', type: 'text', required: false },
        ],
      }),
    });
    check('search: table created', createTable.ok);

    // Insert article rows
    const insertRows = async (rows) => api('/v1/db/smoke_articles', {
      method: 'POST',
      headers: adminAuth,
      body: JSON.stringify({ rows }),
    });
    const ins1 = await insertRows([{ title: 'Climate Migration', body: 'Articles about climate migration and displacement patterns.' }]);
    const ins2 = await insertRows([{ title: 'Renewable Energy', body: 'Solar and wind power adoption across developing nations.' }]);
    const ins3 = await insertRows([{ title: 'Nuclear Policy', body: 'Nuclear energy policy and its environmental impact.' }]);
    check('search: articles inserted', ins1.ok && ins2.ok && ins3.ok);

    // Create a full-text index
    const indexRes = await api('/v1/search/fulltext/index', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        name: 'articles-fts',
        tableName: 'smoke_articles',
        columns: ['title', 'body'],
        language: 'english',
      }),
    });
    check('search: index created', indexRes.ok);
    const indexBody = await indexRes.json();
    check('search: index has physical name', typeof indexBody.index?.indexName === 'string');
    check('search: index language is english', indexBody.index?.language === 'english');

    // List indexes
    const listRes = await api('/v1/search/fulltext/index', { headers: auth });
    const listBody = await listRes.json();
    check('search: index appears in list', listBody.indexes?.some((i) => i.name === 'articles-fts'));

    // Boolean search: climate + migration (websearch syntax — space-separated = AND)
    const searchRes = await api('/v1/search/fulltext', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        tableName: 'smoke_articles',
        query: 'climate migration',
        limit: 10,
      }),
    });
    check('search: boolean query succeeds', searchRes.ok);
    const searchBody = await searchRes.json();
    check('search: returns results', searchBody.results?.length >= 1);
    check('search: result has rank', searchBody.results?.[0]?.rank > 0);
    check('search: result row has title', typeof searchBody.results?.[0]?.row?.title === 'string');

    // Natural language search
    const plainRes = await api('/v1/search/fulltext', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        tableName: 'smoke_articles',
        query: 'renewable energy',
        mode: 'plain',
        limit: 10,
      }),
    });
    check('search: plain query succeeds', plainRes.ok);
    const plainBody = await plainRes.json();
    check('search: plain returns results', plainBody.results?.length >= 1);

    // Drop the index
    const dropRes = await api('/v1/search/fulltext/index/articles-fts', { method: 'DELETE', headers: auth });
    check('search: index dropped', dropRes.status === 204);

    // Clean up the table
    await api('/v1/db/smoke_articles', { method: 'DELETE', headers: adminAuth });
  }

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
  console.error('SMOKE FATAL:', err?.stack ?? err?.message ?? String(err));
  if (serverProc) serverProc.kill('SIGKILL');
  process.exit(1);
});
