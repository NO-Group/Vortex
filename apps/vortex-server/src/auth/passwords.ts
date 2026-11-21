import bcrypt from 'bcryptjs';

/** bcrypt cost factor — 12 rounds balances safety and signup latency. */
const SALT_ROUNDS = 12;

/** Hash a plaintext password with bcrypt. */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
