#!/usr/bin/env node
/**
 * Vortex admin CLI — bootstrap and manage the platform.
 *
 * Usage (from the repo root, with DATABASE_URL set):
 *   npm run admin -- list                    — list all users
 *   npm run admin -- promote you@example.com — promote to admin
 *   npm run admin -- demote someone@example.com — demote to user
 *   npm run admin -- create-user email password [role] — create a user
 *   npm run admin -- tables                  — list user tables
 *   npm run admin -- policies                — list row policies
 *   npm run admin -- storage                 — storage usage stats
 *   npm run admin -- migrate                 — run database migrations
 *   npm run admin -- stats                   — platform health overview
 *   npm run admin -- functions               — list deployed functions
 *   npm run admin -- devices                 — list registered push devices
 *   npm run admin -- query-log               — recent query log entries
 */
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

const [command, ...rest] = process.argv.slice(2);

const COMMANDS = ['list', 'promote', 'demote', 'create-user', 'tables', 'policies', 'storage', 'migrate', 'stats', 'functions', 'devices', 'query-log'];

if (!command || !COMMANDS.includes(command)) {
  console.error('usage: npm run admin -- <' + COMMANDS.join('|') + '> [args]');
  process.exit(1);
}

const connectionString =
  process.env.DATABASE_URL ?? 'postgres://vortex:vortex@localhost:5432/vortex';

const db = new Client({ connectionString });

try {
  await db.connect();

  if (command === 'list') {
    const { rows } = await db.query(
      'SELECT email, role, created_at FROM users ORDER BY created_at ASC',
    );
    if (!rows.length) {
      console.log('no accounts yet — sign up through the console first');
    }
    for (const row of rows) {
      console.log(`${row.role.padEnd(6)}  ${row.email.padEnd(36)}  ${row.created_at.toISOString()}`);
    }
  } else if (command === 'promote' || command === 'demote') {
    const email = rest[0];
    if (!email) {
      console.error(`usage: npm run admin -- ${command} you@example.com`);
      process.exit(1);
    }
    const role = command === 'promote' ? 'admin' : 'user';
    const result = await db.query('UPDATE users SET role = $1 WHERE email = $2', [
      role,
      email.trim().toLowerCase(),
    ]);
    if (result.rowCount === 0) {
      console.error(`no account with email ${email} — sign up first`);
      process.exit(1);
    }
    console.log(`${email} → ${role}`);
    console.log('note: existing sessions keep their old role claim until they sign in again');
  } else if (command === 'create-user') {
    const [email, password, roleArg] = rest;
    if (!email || !password) {
      console.error('usage: npm run admin -- create-user email password [role]');
      process.exit(1);
    }
    const role = (roleArg ?? 'user').toLowerCase();
    if (!['user', 'admin'].includes(role)) {
      console.error('role must be "user" or "admin"');
      process.exit(1);
    }

    // Hash password with bcryptjs (same as the server)
    const bcrypt = await import('bcryptjs');
    const hashed = await bcrypt.hash(password, 12);

    // Insert user (email unique)
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      console.error(`user ${email} already exists`);
      process.exit(1);
    }

    const id = randomUUID();
    const { rows } = await db.query(
      'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, role',
      [id, email.toLowerCase(), hashed, role],
    );
    console.log(`created user: ${rows[0].email} (${rows[0].role})`);
  } else if (command === 'tables') {
    const { rows } = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name NOT IN ('users','table_permissions','storage_objects','apps','app_files',
         'auth_tokens','buckets','functions','vortex_policies','vortex_query_log',
         'vortex_devices','vortex_notifications')
       ORDER BY table_name`,
    );
    if (!rows.length) {
      console.log('no user tables yet — create one from the console or with the SDK');
    }
    for (const row of rows) {
      const count = await db.query(`SELECT count(*)::int as count FROM "${row.table_name}"`);
      console.log(`${row.table_name.padEnd(30)} ${count.rows[0].count} rows`);
    }
  } else if (command === 'policies') {
    const { rows } = await db.query(
      'SELECT name, table_name, action, roles, enabled FROM vortex_policies ORDER BY table_name, action',
    );
    if (!rows.length) {
      console.log('no policies configured');
    }
    for (const row of rows) {
      const status = row.enabled ? '●' : '○';
      console.log(`${status} ${row.name.padEnd(24)} ${row.table_name.padEnd(20)} ${row.action.padEnd(7)} [${row.roles ?? 'all'}]`);
    }
  } else if (command === 'storage') {
    const { rows } = await db.query(
      'SELECT bucket_name, count(*)::int as count, coalesce(sum(size), 0)::bigint as size FROM storage_objects GROUP BY bucket_name ORDER BY bucket_name',
    );
    let totalSize = 0;
    let totalCount = 0;
    for (const row of rows) {
      totalSize += Number(row.size);
      totalCount += row.count;
      console.log(`${row.bucket_name.padEnd(24)} ${String(row.count).padStart(6)} objects  ${formatBytes(Number(row.size))}`);
    }
    console.log(`${'─'.repeat(50)}`);
    console.log(`${'TOTAL'.padEnd(24)} ${String(totalCount).padStart(6)} objects  ${formatBytes(totalSize)}`);
  } else if (command === 'stats') {
    const { rows: userRows } = await db.query('SELECT count(*)::int as count FROM users');
    const { rows: tableRows } = await db.query(
      `SELECT count(*)::int as count FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name NOT IN ('users','table_permissions','storage_objects','apps','app_files',
         'auth_tokens','buckets','functions','vortex_policies','vortex_query_log',
         'vortex_devices','vortex_notifications')`,
    );
    const { rows: policyRows } = await db.query('SELECT count(*)::int as count FROM vortex_policies');
    const { rows: bucketRows } = await db.query('SELECT count(*)::int as count FROM buckets');
    const { rows: objectRows } = await db.query(
      'SELECT count(*)::int as count, coalesce(sum(size),0)::bigint as total FROM storage_objects',
    );
    const { rows: funcRows } = await db.query('SELECT count(*)::int as count FROM functions');
    const { rows: deviceRows } = await db.query('SELECT count(*)::int as count FROM vortex_devices');
    const { rows: notificationRows } = await db.query('SELECT count(*)::int as count FROM vortex_notifications');

    console.log('── Vortex Platform Status ──');
    console.log(`users        ${userRows[0].count}`);
    console.log(`tables       ${tableRows[0].count}`);
    console.log(`policies     ${policyRows[0].count}`);
    console.log(`buckets      ${bucketRows[0].count}`);
    console.log(`objects      ${objectRows[0].count} (${formatBytes(Number(objectRows[0].total))})`);
    console.log(`functions    ${funcRows[0].count}`);
    console.log(`devices      ${deviceRows[0].count}`);
    console.log(`notifications ${notificationRows[0].count}`);
  } else if (command === 'functions') {
    const { rows } = await db.query('SELECT name, schedule, last_invoked_at FROM functions ORDER BY name');
    if (!rows.length) {
      console.log('no functions deployed');
    }
    for (const row of rows) {
      const last = row.last_invoked_at ? row.last_invoked_at.toISOString() : 'never';
      console.log(`${row.name.padEnd(30)} schedule: ${row.schedule ?? 'manual'}  last: ${last}`);
    }
  } else if (command === 'devices') {
    const { rows } = await db.query(
      'SELECT platform, push_service, count(*)::int as count FROM vortex_devices GROUP BY platform, push_service ORDER BY platform',
    );
    if (!rows.length) {
      console.log('no devices registered');
    }
    for (const row of rows) {
      console.log(`${row.platform.padEnd(8)} ${row.push_service.padEnd(12)} ${row.count} devices`);
    }
  } else if (command === 'query-log') {
    const { rows } = await db.query(
      `SELECT created_at, username, command, cost, rows_read
       FROM vortex_query_log ORDER BY created_at DESC LIMIT 20`,
    );
    if (!rows.length) {
      console.log('no queries logged yet');
    }
    for (const row of rows) {
      const cost = row.cost != null ? `cost=${row.cost.toFixed(2)}` : '';
      console.log(`${row.created_at.toISOString()}  ${(row.username ?? 'anon').padEnd(20)}  ${cost.padEnd(12)}  ${row.command.slice(0, 60)}`);
    }
  } else if (command === 'migrate') {
    console.log('running database migrations…');
    // Delegate to the server's migrate command
    const { execSync } = await import('node:child_process');
    execSync('npm run migrate -w @vortex/server', { stdio: 'inherit' });
    console.log('migrations complete');
  }
} finally {
  await db.end();
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
