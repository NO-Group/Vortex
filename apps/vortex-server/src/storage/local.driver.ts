import { createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../errors.js';
import type {
  GetObjectResult,
  PresignUploadInput,
  PresignedUrl,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from './storage.types.js';

const DEFAULT_EXPIRES = 900;
const MAX_EXPIRES = 3600;
const MAX_OBJECT_BYTES = 64 * 1024 * 1024; // 64 MiB

interface SignedPayload {
  key: string;
  op: 'put' | 'get';
  exp: number;
  contentType?: string;
}

/**
 * Local-disk storage driver with presigned-URL semantics: upload/download
 * endpoints accept HMAC-signed expiring tokens, mirroring the S3 flow so
 * clients can switch drivers without changing code paths.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const;

  constructor(
    private readonly rootDir: string,
    private readonly secret: string,
    private readonly publicApiBase: string,
  ) {}

  /** Resolve a storage key to a safe absolute path (blocks traversal). */
  private resolveKey(key: string): string {
    const normalized = key.replace(/^\/+/, '');
    if (
      normalized.includes('..') ||
      normalized.includes('\0') ||
      path.isAbsolute(normalized) ||
      normalized.length === 0
    ) {
      throw ApiError.badRequest(`Invalid storage key: "${key}"`);
    }
    const full = path.resolve(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);
    if (!full.startsWith(root + path.sep)) {
      throw ApiError.badRequest(`Invalid storage key: "${key}"`);
    }
    return full;
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const full = this.resolveKey(input.key);
    const body = input.body instanceof Buffer ? input.body : Buffer.from(input.body);
    if (body.byteLength > MAX_OBJECT_BYTES) {
      throw ApiError.badRequest(`Object exceeds ${MAX_OBJECT_BYTES} byte limit`);
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return {
      key: input.key.replace(/^\/+/, ''),
      size: body.byteLength,
      contentType: input.contentType ?? 'application/octet-stream',
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    const full = this.resolveKey(key);
    try {
      const body = await fs.readFile(full);
      return { body, contentType: 'application/octet-stream', size: body.byteLength };
    } catch {
      throw ApiError.notFound(`Object not found: "${key}"`);
    }
  }

  async delete(key: string): Promise<void> {
    const full = this.resolveKey(key);
    await fs.rm(full, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string, limit: number): Promise<string[]> {
    const root = path.resolve(this.rootDir);
    const results: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      if (results.length >= limit) return;
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (results.length >= limit) return;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          const key = path.relative(root, full).split(path.sep).join('/');
          if (key.startsWith(prefix)) results.push(key);
        }
      }
    };

    await walk(root);
    return results.sort();
  }

  /** Sign an expiring token for a presigned-style URL. */
  private sign(payload: SignedPayload): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  /** Verify a signed token; throws ApiError(403) on tamper/expiry. */
  verifySigned(token: string): SignedPayload {
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw ApiError.forbidden('Malformed signed token');
    }
    const [body, sig] = parts as [string, string];
    const expected = createHmac('sha256', this.secret).update(body).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      throw ApiError.forbidden('Invalid signature');
    }

    let payload: SignedPayload;
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SignedPayload;
    } catch {
      throw ApiError.forbidden('Malformed signed token');
    }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      throw ApiError.forbidden('Signed token expired');
    }
    return payload;
  }

  private expiresInSeconds(expiresIn?: number): number {
    return Math.min(Math.max(expiresIn ?? DEFAULT_EXPIRES, 1), MAX_EXPIRES);
  }

  async presignUpload(input: PresignUploadInput, baseUrl?: string): Promise<PresignedUrl> {
    const key = input.key.replace(/^\/+/, '');
    this.resolveKey(key); // validate early
    const seconds = this.expiresInSeconds(input.expiresIn);
    const exp = Math.floor(Date.now() / 1000) + seconds;
    const token = this.sign({ key, op: 'put', exp, contentType: input.contentType });
    const base = (baseUrl ?? this.publicApiBase).replace(/\/+$/, '');

    return {
      key,
      method: 'PUT',
      url: `${base}/v1/storage/local/upload?token=${encodeURIComponent(token)}`,
      headers: input.contentType ? { 'content-type': input.contentType } : {},
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async presignDownload(key: string, expiresIn: number, baseUrl?: string): Promise<PresignedUrl> {
    const clean = key.replace(/^\/+/, '');
    this.resolveKey(clean);
    const seconds = this.expiresInSeconds(expiresIn);
    const exp = Math.floor(Date.now() / 1000) + seconds;
    const token = this.sign({ key: clean, op: 'get', exp });
    const base = (baseUrl ?? this.publicApiBase).replace(/\/+$/, '');

    return {
      key: clean,
      method: 'GET',
      url: `${base}/v1/storage/local/object?token=${encodeURIComponent(token)}`,
      headers: {},
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }
}
