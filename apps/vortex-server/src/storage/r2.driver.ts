/**
 * Vortex Server — Cloudflare R2 Storage Driver.
 *
 * Implements the StorageDriver interface using R2's S3-compatible API.
 * Direct operations (put/get/delete) use AWS Signature V4 authentication
 * with the configured access key. Presigned URLs are generated locally
 * with HMAC so clients can upload/download directly without the server.
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
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(config: R2Config, secret: string) {
    this.secret = secret;
    this.bucket = config.bucket;
    this.baseUrl = config.endpoint.replace(/\/$/, '');
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
  }

  async put(opts: { key: string; body: Buffer; contentType: string }): Promise<{ key: string; size: number; contentType: string; etag?: string }> {
    const url = this.objectUrl(opts.key);
    const { authHeader, headers } = this.buildSignedRequest('PUT', url, opts.contentType, opts.body.length);
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'content-type': opts.contentType, ...headers, Authorization: authHeader },
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
    const { authHeader, headers } = this.buildSignedRequest('GET', url);
    const response = await fetch(url, { headers: { ...headers, Authorization: authHeader } });

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
    const { authHeader, headers } = this.buildSignedRequest('DELETE', url);
    const response = await fetch(url, { method: 'DELETE', headers: { ...headers, Authorization: authHeader } });

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

  /**
   * Build AWS Signature V4 authentication for an S3-compatible request.
   * R2's S3 API requires proper auth headers for server-side operations.
   */
  private buildSignedRequest(method: string, url: string, contentType?: string, contentLength?: number): {
    authHeader: string;
    headers: Record<string, string>;
  } {
    const u = new URL(url);
    const date = new Date().toUTCString();
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const headerMap: Record<string, string> = {
      host: u.host,
      'x-amz-date': date,
      'x-amz-content-sha256': payloadHash,
    };
    if (contentType) headerMap['content-type'] = contentType;

    const sortedKeys = Object.keys(headerMap).sort();
    const canonicalHeaders = sortedKeys.map((k) => `${k}:${headerMap[k]}\n`).join('');
    const signedHeaders = sortedKeys.join(';');

    const canonicalRequest = [
      method,
      u.pathname,
      u.search,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const dateShort = date.slice(0, 10);
    const credentialScope = `${dateShort}/us-east-1/s3/aws4_request`;

    // Derive signing key: HMAC chain
    const kDate = createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateShort).digest();
    const kRegion = createHmac('sha256', kDate).update('us-east-1').digest();
    const kService = createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      date,
      credentialScope,
      createHmac('sha256', kSigning).update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const headers: Record<string, string> = {
      'x-amz-date': date,
      'x-amz-content-sha256': payloadHash,
    };
    if (contentType) headers['content-type'] = contentType;

    return { authHeader, headers };
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
