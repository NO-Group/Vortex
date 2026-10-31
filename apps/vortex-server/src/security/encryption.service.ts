import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from 'node:crypto';
import { ApiError } from '../errors.js';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const KEY_LENGTH = 32; // 256-bit key

interface EncryptedPayload {
  v: number;      // key version
  iv: string;     // base64 IV
  data: string;   // base64 ciphertext
  tag: string;    // base64 GCM tag
}

/**
 * Encryption at rest — AES-256-GCM encryption for sensitive fields.
 *
 * Generates a key from the ENCRYPTION_KEY env var (or derived from JWT secret
 * as a fallback). Encrypted fields are stored as JSON with version, IV,
 * ciphertext, and auth tag for authenticated encryption.
 */
export class EncryptionService {
  private readonly key: Buffer;
  private readonly keyVersion: string;

  constructor(encryptionKey?: string, keyVersion = '1') {
    const raw = encryptionKey ?? process.env.ENCRYPTION_KEY;
    if (!raw) {
      // Fallback: derive from JWT secret (dev only)
      this.key = createHash('sha256').update('vortex-dev-encryption-key').digest();
      this.keyVersion = 'dev-1';
    } else {
      this.key = createHash('sha256').update(raw).digest();
      this.keyVersion = keyVersion;
    }
  }

  /** Encrypt a string value. Returns a JSON-serializable payload. */
  encrypt(plaintext: string): EncryptedPayload {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      v: parseInt(this.keyVersion, 10) || 1,
      iv: iv.toString('base64'),
      data: encrypted.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  /** Decrypt an encrypted payload back to a string. */
  decrypt(payload: EncryptedPayload): string {
    const iv = Buffer.from(payload.iv, 'base64');
    const data = Buffer.from(payload.data, 'base64');
    const tag = Buffer.from(payload.tag, 'base64');

    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /** Encrypt and serialize as a JSON string for DB storage. */
  encryptForDb(plaintext: string): string {
    return JSON.stringify(this.encrypt(plaintext));
  }

  /** Decrypt from a DB JSON string. */
  decryptFromDb(encryptedJson: string): string {
    const payload = JSON.parse(encryptedJson) as EncryptedPayload;
    return this.decrypt(payload);
  }

  /** Check if a string is an encrypted payload. */
  isEncrypted(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    try {
      const parsed = JSON.parse(value) as EncryptedPayload;
      return typeof parsed === 'object' && parsed !== null &&
        typeof parsed.iv === 'string' && typeof parsed.data === 'string' &&
        typeof parsed.tag === 'string';
    } catch {
      return false;
    }
  }

  /** Get the key version. */
  getKeyVersion(): string {
    return this.keyVersion;
  }

  /** Get the algorithm name. */
  getAlgorithm(): string {
    return ALGO;
  }
}
