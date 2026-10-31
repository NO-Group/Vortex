import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { ApiError } from '../../errors.js';
import { validateStorageKey } from '../driver.interface.js';
import type {
  BulkDeleteResult,
  DriverConfig,
  IVortexStorageDriver,
  ListObjectsResult,
  MultipartPart,
  PresignedUrlOptions,
  PresignedUrlResult,
  StorageObjectMetadata,
} from '../driver.interface.js';

interface MultipartPartFile {
  partNumber: number;
  filename: string;
  etag: string;
}

interface MultipartUploadState {
  uploadId: string;
  key: string;
  mimeType: string;
  parts: Map<number, MultipartPartFile>;
  createdAt: Date;
}

const DEFAULT_EXPIRES = 900;
const MAX_EXPIRES = 3600;

/**
 * Local Server Filesystem driver.
 * Target for zero-cost local development, offline unit testing,
 * and self-hosted Docker deployments.
 *
 * Reads/writes directly to the local persistent volume path:
 * ./vortex_data/storage/
 *
 * Implements the full IVortexStorageDriver interface including
 * multipart uploads (via local staging files) and presigned URLs
 * (via HMAC-signed tokens).
 */
export class LocalDiskDriver implements IVortexStorageDriver {
  readonly name = 'local_disk';
  readonly provider = 'Local Server Filesystem';
  readonly supportsMultipart = true;
  readonly supportsBatch = false;

  private readonly rootDir: string;
  private readonly secret: string;
  private readonly publicApiBase: string;
  private readonly multipartDir: string;
  private readonly multipartUploads = new Map<string, MultipartUploadState>();

  constructor(config: DriverConfig) {
    this.rootDir = path.resolve(config.localDir ?? './vortex_data/storage/');
    this.secret = config.secretAccessKey ?? 'vortex-local-secret';
    this.publicApiBase = config.endpoint ?? 'http://localhost:8080';
    this.multipartDir = path.join(this.rootDir, '.multipart');
  }

  private resolveKey(key: string): string {
    validateStorageKey(key);
    const normalized = key.replace(/^\/+/, '');
    const full = path.resolve(this.rootDir, normalized);
    const root = path.resolve(this.rootDir);
    if (!full.startsWith(root + path.sep)) {
      throw ApiError.badRequest(`Invalid storage key: "${key}"`);
    }
    return full;
  }

  async uploadObject(
    key: string,
    body: Buffer | Uint8Array,
    mimeType: string,
    options?: { metadata?: Record<string, string> },
  ): Promise<StorageObjectMetadata> {
    const full = this.resolveKey(key);
    const bytes = body instanceof Buffer ? body : Buffer.from(body);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, bytes);
    return {
      key: key.replace(/^\/+/, ''),
      size: bytes.byteLength,
      mimeType,
      etag: createHmac('sha256', bytes).digest('hex').slice(0, 32),
      lastModified: new Date(),
      customMetadata: options?.metadata,
    };
  }

  async downloadObject(key: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    metadata: StorageObjectMetadata;
  }> {
    const full = this.resolveKey(key);
    try {
      const body = await fs.readFile(full);
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(body);
          controller.close();
        },
      });
      return {
        stream,
        metadata: {
          key,
          size: body.byteLength,
          mimeType: 'application/octet-stream',
          etag: createHmac('sha256', body).digest('hex').slice(0, 32),
          lastModified: new Date(),
        },
      };
    } catch {
      throw ApiError.notFound(`Object not found: "${key}"`);
    }
  }

  async deleteObject(key: string): Promise<void> {
    const full = this.resolveKey(key);
    await fs.rm(full, { force: true });
  }

  async deleteBulkObjects(keys: string[]): Promise<BulkDeleteResult> {
    const results = await Promise.allSettled(
      keys.map((k) => this.deleteObject(k)),
    );
    const deleted: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') deleted.push(keys[i]!);
      else failed.push(keys[i]!);
    });
    return { deleted, failed };
  }

  async generatePresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    validateStorageKey(options.key);
    const seconds = Math.min(Math.max(options.expiresInSeconds, 1), MAX_EXPIRES);
    const exp = Math.floor(Date.now() / 1000) + seconds;
    const token = this.sign({ key: options.key, op: options.action === 'write' ? 'put' : 'get', exp });
    const base = this.publicApiBase.replace(/\/+$/, '');

    if (options.action === 'write') {
      return {
        url: `${base}/v1/storage/local/upload?token=${encodeURIComponent(token)}`,
        method: 'PUT',
        headers: options.contentType ? { 'content-type': options.contentType } : {},
        expiresAt: new Date(exp * 1000).toISOString(),
      };
    }
    return {
      url: `${base}/v1/storage/local/object?token=${encodeURIComponent(token)}`,
      method: 'GET',
      headers: {},
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  async initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }> {
    validateStorageKey(key);
    const uploadId = randomUUID();
    await fs.mkdir(this.multipartDir, { recursive: true });
    const state: MultipartUploadState = {
      uploadId,
      key: key.replace(/^\/+/, ''),
      mimeType,
      parts: new Map(),
      createdAt: new Date(),
    };
    this.multipartUploads.set(uploadId, state);
    await fs.writeFile(
      path.join(this.multipartDir, uploadId),
      JSON.stringify({ key: state.key, mimeType, createdAt: state.createdAt }),
    );
    return { uploadId };
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<MultipartPart> {
    const state = this.multipartUploads.get(uploadId);
    if (!state) throw ApiError.notFound(`Multipart upload not found: ${uploadId}`);

    const partFilename = `${uploadId}_part_${partNumber}`;
    const partPath = path.join(this.multipartDir, partFilename);
    await fs.writeFile(partPath, body);

    const etag = createHmac('sha256', body).digest('hex').slice(0, 32);
    state.parts.set(partNumber, { partNumber, filename: partFilename, etag });
    return { partNumber, etag };
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: MultipartPart[]): Promise<StorageObjectMetadata> {
    const state = this.multipartUploads.get(uploadId);
    if (!state) throw ApiError.notFound(`Multipart upload not found: ${uploadId}`);

    // Concatenate all parts
    const full = this.resolveKey(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    const writeStream = createWriteStream(full);

    const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    for (const part of sortedParts) {
      const partPath = path.join(this.multipartDir, state.parts.get(part.partNumber)?.filename ?? '');
      const partBody = await fs.readFile(partPath);
      await new Promise<void>((resolve, reject) => {
        writeStream.write(partBody, (err: Error | null | undefined) => err ? reject(err) : resolve());
      });
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
    });

    // Cleanup
    for (const [, partFile] of state.parts) {
      await fs.rm(path.join(this.multipartDir, partFile.filename), { force: true });
    }
    await fs.rm(path.join(this.multipartDir, uploadId), { force: true });
    this.multipartUploads.delete(uploadId);

    return {
      key,
      size: 0, // Would need to stat the file for accurate size
      mimeType: state.mimeType,
      etag: createHmac('sha256', Buffer.from('')).digest('hex').slice(0, 32),
      lastModified: new Date(),
    };
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    const state = this.multipartUploads.get(uploadId);
    if (!state) return;
    for (const [, partFile] of state.parts) {
      await fs.rm(path.join(this.multipartDir, partFile.filename), { force: true });
    }
    await fs.rm(path.join(this.multipartDir, uploadId), { force: true });
    this.multipartUploads.delete(uploadId);
  }

  async listObjects(prefix?: string, limit = 1000): Promise<ListObjectsResult> {
    const root = path.resolve(this.rootDir);
    const results: StorageObjectMetadata[] = [];

    const walk = async (dir: string): Promise<void> => {
      if (results.length >= limit) return;
      const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        if (results.length >= limit) return;
        if (entry.name === '.multipart') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
        } else {
          const key = path.relative(root, full).split(path.sep).join('/');
          if (!prefix || key.startsWith(prefix)) {
            const stat = await fs.stat(full);
            results.push({
              key,
              size: stat.size,
              mimeType: 'application/octet-stream',
              etag: '',
              lastModified: stat.mtime,
            });
          }
        }
      }
    };

    await walk(root);
    return { objects: results.sort((a, b) => a.key.localeCompare(b.key)) };
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata> {
    const full = this.resolveKey(key);
    try {
      const stat = await fs.stat(full);
      return {
        key,
        size: stat.size,
        mimeType: 'application/octet-stream',
        etag: '',
        lastModified: stat.mtime,
      };
    } catch {
      throw ApiError.notFound(`Object not found: "${key}"`);
    }
  }

  async cleanupOrphanedMultipartUploads(olderThan: Date): Promise<number> {
    let count = 0;
    for (const [uploadId, state] of this.multipartUploads) {
      if (state.createdAt < olderThan) {
        await this.abortMultipartUpload(state.key, uploadId);
        count++;
      }
    }
    return count;
  }

  // ── Presigned URL signing ──────────────────────────────────────────────

  private sign(payload: { key: string; op: 'put' | 'get'; exp: number }): string {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = createHmac('sha256', this.secret).update(body).digest('base64url');
    return `${body}.${sig}`;
  }

  verifySigned(token: string): { key: string; op: 'put' | 'get'; exp: number } {
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
    let payload: { key: string; op: 'put' | 'get'; exp: number };
    try {
      payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    } catch {
      throw ApiError.forbidden('Malformed signed token');
    }
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
      throw ApiError.forbidden('Signed token expired');
    }
    return payload;
  }
}
