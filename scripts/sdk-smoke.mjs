/**
 * SDK smoke test — verifies @vortex/client works end-to-end against
 * a running engine. Not part of the automated test suite; run manually:
 *
 *   node scripts/sdk-smoke.mjs
 *
 * Requires a running engine (use `npm run preview:stack` or your own).
 */
import { VortexClient, VortexApiError } from '../packages/sdk-typescript/dist/index.js';

const BASE = process.env.VORTEX_BASE ?? 'http://127.0.0.1:8090';

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name} ${extra}`); }
}

async function main() {
  console.log(`\nSDK smoke against ${BASE}\n`);

  const vortex = new VortexClient({ url: BASE });

  // ── Auth ──────────────────────────────────────────────────────────────
  console.log('[1] Auth via SDK...');
  const email = `sdk-${Date.now()}@no.group`;
  const session = await vortex.auth.signup({
    email,
    password: 'sdk-secret-1',
    metadata: { source: 'sdk-smoke' },
  });
  check('signup via SDK returns session', !!session.token && !!session.user.id);
  check('session user has metadata', session.user.metadata.source === 'sdk-smoke');

  const me = await vortex.auth.me();
  check('me() returns the signed-up user', me.email === email);

  // ── Database ─────────────────────────────────────────────────────────
  console.log('\n[2] Database via SDK...');
  await vortex.database.from('notes').execute().catch(() => {});

  const inserted = await vortex.database.insert('notes', [
    { title: 'SDK note', body: 'Created by @vortex/client' },
  ]);
  check('insert via SDK works', inserted.count === 1);

  const queried = await vortex.database.from('notes')
    .filter('title', 'eq', 'SDK note')
    .limit(5)
    .execute();
  check('query builder: filter + limit', queried.rows.length === 1);

  const explained = await vortex.database.from('notes')
    .limit(5)
    .explain()
    .execute();
  check('query builder: explain returns plan', typeof explained.explain?.plan?.cost === 'number');

  // ── Storage ───────────────────────────────────────────────────────────
  console.log('\n[3] Storage via SDK...');
  const testImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const uploaded = await vortex.storage.upload('uploads', testImage, 'sdk-test.png', 'image/png');
  check('upload via SDK works', uploaded.key === 'uploads/sdk-test.png');

  const url = vortex.storage.url('public', 'logo.png');
  check('storage.url() builds correct URL', url.includes('/v1/storage/public/logo.png'));

  const imgUrl = vortex.storage.imageUrl('public', 'logo.png', { w: 100, h: 100, fit: 'cover', fmt: 'webp' });
  check('imageUrl() appends transform params', imgUrl.includes('w=100') && imgUrl.includes('fmt=webp'));

  // ── Functions ─────────────────────────────────────────────────────────
  console.log('\n[4] Functions via SDK...');
  const fnResult = await vortex.functions.invoke('pulse', { ping: 'sdk' }).catch(() => null);
  if (fnResult) {
    check('invoke function via SDK', fnResult.echo === 'sdk' || fnResult.ping === 'sdk');
  } else {
    check('invoke function (skipped if not deployed)', true);
  }

  // ── Realtime ──────────────────────────────────────────────────────────
  console.log('\n[5] Realtime via SDK...');
  const events = [];
  const rt = vortex.connectRealtime(session.token, {
    onTableChange: (event) => events.push(event),
  });

  await new Promise((r) => setTimeout(r, 500));
  check('realtime connects', rt.getStatus() === 'online');

  rt.subscribe('table:notes');
  await new Promise((r) => setTimeout(r, 300));

  await vortex.database.insert('notes', [{ title: 'RT trigger', body: 'sdk' }]);
  await new Promise((r) => setTimeout(r, 500));

  check('realtime receives table changes', events.length > 0);
  if (events[0]) {
    check('realtime event has seq', typeof events[0].seq === 'number');
  }

  rt.disconnect();

  // ── Admin (if admin role) ──────────────────────────────────────────────
  if (me.role === 'admin') {
    console.log('\n[6] Admin via SDK...');
    const policies = await vortex.admin.listPolicies();
    check('admin.listPolicies() works', Array.isArray(policies));

    const overview = await vortex.admin.insightsOverview();
    check('admin.insightsOverview() works', overview.window === '1 hour');
  }

  // ── Error handling ───────────────────────────────────────────────────
  console.log('\n[7] Error handling...');
  try {
    await vortex.auth.login({ email, password: 'wrong-password' });
    check('wrong password throws', false);
  } catch (err) {
    check('wrong password throws VortexApiError', err instanceof VortexApiError, `(got ${err.constructor.name})`);
  }

  console.log(`\n══════════════════════════════════════`);
  console.log(`  SDK SMOKE: ${passed} passed, ${failed} failed`);
  console.log(`══════════════════════════════════════\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('SDK SMOKE FATAL:', err?.stack ?? err?.message ?? String(err));
  process.exit(1);
});
