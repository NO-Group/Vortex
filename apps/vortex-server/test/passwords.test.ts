import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';

describe('passwords', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('hunter2!secret');
    expect(hash).not.toBe('hunter2!secret');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await verifyPassword('hunter2!secret', hash)).toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces unique salts per hash', async () => {
    const a = await hashPassword('same-input');
    const b = await hashPassword('same-input');
    expect(a).not.toBe(b);
  });
});
