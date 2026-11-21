/**
 * Vortex Server — Cloudflare R2 Storage Driver.
 *
 * Implements the StorageDriver interface using R2's S3-compatible API.
 * Presigned URLs are generated locally with HMAC so the server doesn't
 * need to proxy every upload/download.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { StorageDriver } from '../context.js';
import { ApiError } from '../errors.js';

export interface R2Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class R2StorageDriver implements StorageDriver {
  private secret: string;
  private baseUrl: string;
  private bucket: string;

  constructor(config: R2Config, secret: string) {
    this.secret = secret;
    this.bucket = config.bucket;
    this.baseUrl = config.endpoint.replace(/\/$/, '');
  }

  async put(opts: { key: string; body: Buffer; contentType: string }): Promise<{ key: string; size: number; contentType: string; etag?: string }> {
    const url = this.objectUrl(opts.key);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'content-type': opts.contentType,
        'content-length': String(opts.body.length),
      },
      body: new Uint8Array(opts.body),
    });

    if (!response.ok) {
      throw ApiError.internal(`R2 PUT failed: ${response.status} ${response.statusText}`);
    }

    const etag = response.headers.get('etag') ?? undefined;
    return { key: opts.key, size: opts.body.length, contentType: opts.contentType, etag };
  }

  async get(key: string): Promise<{ body: Buffer; contentType: string; size: number }> {
    const url = this.objectUrl(key);
    const response = await fetch(url);

    if (!response.ok) {
      throw ApiError.notFound(`Object not found: ${key}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';

    return {
      body: Buffer.from(arrayBuffer),
      contentType,
      size: arrayBuffer.byteLength,
    };
  }

  async delete(key: string): Promise<void> {
    const url = this.objectUrl(key);
    const response = await fetch(url, { method: 'DELETE' });

    if (!response.ok && response.status !== 404) {
      throw ApiError.internal(`R2 DELETE failed: ${response.status} ${response.statusText}`);
    }
  }

  async presignUpload(opts: { key: string; contentType?: string; expiresIn?: number }, baseUrl?: string): Promise<{ url: string; expiresAt: string; expiresIn: number; method: 'PUT' }> {
    const expiresIn = opts.expiresIn ?? 900;
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    const base = baseUrl ?? this.baseUrl;
    const token = this.signToken({ op: 'put', key: opts.key, contentType: opts.contentType ?? '', exp: expiresIn });
    return {
      url: `${base}/v1/storage/r2/upload?token=${token}&bucket=${this.bucket}`,
      expiresAt,
      expiresIn,
      method: 'PUT',
    };
  }

  async presignDownload(key: string, expiresIn?: number, baseUrl?: string): Promise<{ url: string; expiresAt: string; expiresIn: number; method: 'GET' }> {
    const expires = expiresIn ?? 900;
    const expiresAt = new Date(Date.now() + expires * 1000).toISOString();
    const base = baseUrl ?? this.baseUrl;
    const token = this.signToken({ op: 'get', key, exp: expires });
    return {
      url: `${base}/v1/storage/r2/object?token=${token}&bucket=${this.bucket}`,
      expiresAt,
      expiresIn: expires,
      method: 'GET',
    };
  }

  /** Verify an HMAC-signed token for presigned R2 operations. */
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

  private objectUrl(key: string): string {
    const safe = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return `${this.baseUrl}/${this.bucket}/${safe}`;
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
