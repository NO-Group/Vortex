/**
 * Vortex Server — Local Storage Driver: disk-based storage with HMAC-signed presigned URLs.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AppContext, StorageDriver } from '../context.js';
import { ApiError } from '../errors.js';

export class LocalStorageDriver implements StorageDriver {
  private root: string;
  private secret: string;

  constructor(localPath: string, secret: string) {
    this.root = path.resolve(localPath);
    this.secret = secret;
    fs.mkdir(this.root, { recursive: true }).catch(() => undefined);
  }

  private filePath(key: string): string {
    // Prevent path traversal: resolve the key and ensure it stays within root
    const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
    const resolved = path.resolve(this.root, safe);
    if (!resolved.startsWith(this.root + path.sep) && resolved !== this.root) {
      throw ApiError.forbidden('Invalid storage key: path traversal detected');
    }
    return resolved;
  }

  async put(opts: { key: string; body: Buffer; contentType: string }): Promise<{ key: string; size: number; contentType: string; etag?: string }> {
    const fp = this.filePath(opts.key);
    await fs.writeFile(fp, opts.body);
    return { key: opts.key, size: opts.body.length, contentType: opts.contentType, etag: `"${opts.body.length}"` };
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string; size: number }> {
    const fp = this.filePath(key);
    try {
      const body = await fs.readFile(fp);
      return { body, contentType: 'application/octet-stream', size: body.length };
    } catch {
      throw ApiError.notFound(`Object not found: ${key}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.filePath(key));
    } catch {
      // Already gone
    }
  }

  async presignUpload(opts: { key: string; contentType?: string; expiresIn?: number }, baseUrl?: string): Promise<{ url: string; expiresAt: string; expiresIn: number; method: 'PUT' }> {
    const expiresIn = opts.expiresIn ?? 900;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const base = baseUrl ?? `http://localhost:4000`;
    const token = this.signToken({ op: 'put', key: opts.key, contentType: opts.contentType ?? '', exp: expiresIn });
    return { url: `${base}/v1/storage/local/upload?token=${token}`, expiresAt, expiresIn, method: 'PUT' };
  }

  async presignDownload(key: string, expiresIn?: number, baseUrl?: string): Promise<{ url: string; expiresAt: string; expiresIn: number; method: 'GET' }> {
    const expires = expiresIn ?? 900;
    const expiresAt = new Date(Date.now() + expires * 1000).toISOString();
    const base = baseUrl ?? `http://localhost:4000`;
    const token = this.signToken({ op: 'get', key, exp: expires });
    return { url: `${base}/v1/storage/local/object?token=${token}`, expiresAt, expiresIn: expires, method: 'GET' };
  }

  verifySigned(token: string): { op: 'put' | 'get'; key: string; contentType?: string; exp: number } {
    const parts = token.split('.');
    if (parts.length !== 2) throw ApiError.forbidden('Invalid token format');

    const [payloadB64, sig] = parts;
    const expectedSig = this.signPayload(payloadB64);
    const expected = Buffer.from(expectedSig);
    const actual = Buffer.from(sig);

    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw ApiError.forbidden('Invalid token signature');
    }

    let payload: { op: 'put' | 'get'; key: string; contentType?: string; exp: number };
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    } catch {
      throw ApiError.forbidden('Invalid token payload');
    }

    if (payload.exp * 1000 < Date.now()) {
      throw ApiError.forbidden('Token expired');
    }

    return payload;
  }

  private signPayload(payloadB64: string): string {
    return createHmac('sha256', this.secret).update(payloadB64).digest('hex');
  }

  private signToken(payload: Record<string, unknown>): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const sig = this.signPayload(payloadB64);
    return `${payloadB64}.${sig}`;
  }
}
