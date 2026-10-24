#!/usr/bin/env node
/**
 * Vortex admin CLI — bootstrap and manage admin accounts.
 *
 * Usage (from the repo root, with DATABASE_URL set):
 *   npm run admin -- list
 *   npm run admin -- promote you@example.com
 *   npm run admin -- demote someone@example.com
 */
import { Client } from 'pg';

const [command, email] = process.argv.slice(2);

if (!command || !['list', 'promote', 'demote'].includes(command)) {
  console.error('usage: npm run admin -- <list|promote|demote> [email]');
  process.exit(1);
}
if (command !== 'list' && !email) {
  console.error(`usage: npm run admin -- ${command} you@example.com`);
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
  } else {
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
  }
} finally {
  await db.end();
}
