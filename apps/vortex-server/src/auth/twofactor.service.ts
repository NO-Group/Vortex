import type { Knex } from 'knex';
import crypto from 'node:crypto';

const TOTP_PERIOD = 30;        // seconds per TOTP step
const TOTP_DIGITS = 6;         // digits in the generated code
const TOTP_WINDOW = 1;         // allow ±1 step for clock drift
const BACKUP_CODE_COUNT = 8;   // backup codes generated on setup
const BACKUP_CODE_LENGTH = 8;  // chars per backup code segment

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of str.toUpperCase()) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function totpCode(secret: string, timestamp: number): string {
  const counter = Math.floor(timestamp / TOTP_PERIOD);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  buffer.writeUInt32BE(counter & 0xffffffff, 4);

  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, '0');
}

function verifyTotpCode(secret: string, code: string, timestamp: number): boolean {
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    if (totpCode(secret, timestamp + i * TOTP_PERIOD * 1000) === code) {
      return true;
    }
  }
  return false;
}

function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = '';
    const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += bytes[j]!.toString(36).toUpperCase().padStart(2, '0');
    }
    codes.push(code);
  }
  return codes;
}

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

export interface TwoFactorService {
  generateSecret(): string;
  getOtpauthUrl(secret: string, email: string, issuer: string): string;
  verifyCode(secret: string, code: string): boolean;
  generateBackupCodes(): string[];
  hashBackupCodes(codes: string[]): string[];
  verifyBackupCode(storedHashes: string[], code: string): number | null;
}

export function createTwoFactorService(): TwoFactorService {
  return {
    generateSecret() {
      return generateTotpSecret();
    },

    getOtpauthUrl(secret, email, issuer) {
      const label = encodeURIComponent(`${issuer}:${email}`);
      const params = new URLSearchParams({
        secret,
        issuer,
        algorithm: 'SHA1',
        digits: String(TOTP_DIGITS),
        period: String(TOTP_PERIOD),
      });
      return `otpauth://totp/${label}?${params.toString()}`;
    },

    verifyCode(secret, code) {
      return verifyTotpCode(secret, code, Date.now());
    },

    generateBackupCodes() {
      return generateBackupCodes();
    },

    hashBackupCodes(codes) {
      return codes.map(hashBackupCode);
    },

    verifyBackupCode(storedHashes, code) {
      const hash = hashBackupCode(code);
      const index = storedHashes.indexOf(hash);
      if (index === -1) return null;
      // Return the remaining hashes (remove the used one)
      const remaining = storedHashes.filter((_, i) => i !== index);
      return remaining.length;
    },
  };
}
