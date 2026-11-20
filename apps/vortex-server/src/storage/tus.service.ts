import { randomBytes, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Knex } from 'knex';
import type { StorageDriver } from './storage.types.js';
import { ApiError } from '../errors.js';
import {
  TUS_VERSION,
  type TusUpload,
  type TusUploadCreation,
  type TusPatchResult,
  parseUploadMetadata,
  parseUploadChecksum,
  deriveKeyFromMetadata,
} from './tus.types.js';

interface TusUploadRow {
  id: string;
  upload_id: string;
  owner_id: string;
  key: string;
  size: number;
  offset: number;
  content_type: string | null;
  metadata: Record<string, string> | null;
  checksum: string | null;
  expires_at: Date | null;
  status: string;
  app_id: string | null;
  created_at: Date;
}

function toTusUpload(row: TusUploadRow): TusUpload {
  return {
    uploadId: row.upload_id,
    key: row.key,
    size: Number(row.size),
    offset: Number(row.offset),
    contentType: row.content_type,
    metadata: row.metadata ?? {},
    checksum: row.checksum,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    ownerId: row.owner_id,
  };
}

/**
 * TUS Protocol service — resumable upload support.
 *
 * Unlike the chunked upload API (which uses predetermined chunk sizes),
 * TUS uses byte offsets. The client sends data with PATCH requests and
 * the server tracks the cumulative offset. This allows true resumability
 * at any byte boundary.
 *
 * Implementation:
 *   - Uses a dedicated `vortex_tus_uploads` table for session tracking
 *   - Writes data to a temp file on disk (local driver) or uses S3 multipart
 *   - Supports the creation, creation-with-upload, checksum, and expiration extensions
 */
export class TusService {
  private readonly tempDir: string;

  constructor(
    private readonly db: Knex,
    private readonly driver: StorageDriver,
    tempDir?: string,
  ) {
    this.tempDir = tempDir ?? path.join(process.cwd(), '.vortex-chunks');
  }

  /** Create a new TUS upload session. */
  async createUpload(
    ownerId: string,
    input: {
      size: number;
      contentType?: string;
      metadata?: Record<string, string>;
      checksum?: string;
      bucket?: string;
      key?: string;
      appId?: string | null;
    },
  ): Promise<TusUploadCreation> {
    const uploadId = randomBytes(16).toString('hex');
    const bucket = input.bucket ?? 'uploads';
    const key = input.key ?? deriveKeyFromMetadata(input.metadata ?? {}, bucket);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const [row] = await this.db<TusUploadRow>('vortex_tus_uploads')
      .insert({
        upload_id: uploadId,
        owner_id: ownerId,
        key,
        size: input.size,
        offset: 0,
        content_type: input.contentType ?? 'application/octet-stream',
        metadata: input.metadata ?? {},
        checksum: input.checksum ?? null,
        expires_at: expiresAt,
        app_id: input.appId ?? null,
      })
      .returning('*');

    const r = row!;
    return {
      uploadId: r.upload_id,
      key: r.key,
      size: Number(r.size),
      offset: 0,
      contentType: r.content_type,
      metadata: r.metadata ?? {},
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
      location: `/v1/storage/tus/uploads/${r.upload_id}`,
    };
  }

  /**
   * PATCH — upload data chunk at the current offset.
   * Returns the new offset.
   */
  async patch(
    ownerId: string,
    uploadId: string,
    body: Buffer,
    expectedOffset: number,
    checksum?: { algorithm: string; value: string } | null,
  ): Promise<TusPatchResult> {
    const row = await this.requireActiveUpload(ownerId, uploadId);
    const r = row;

    if (expectedOffset !== Number(r.offset)) {
      throw new ApiError(409, 'upload_conflict', `Offset mismatch: expected ${r.offset}, got ${expectedOffset}`);
    }

    if (Number(r.offset) + body.byteLength > Number(r.size)) {
      throw new ApiError(409, 'upload_too_large', `Data exceeds declared upload size (${r.size})`);
    }

    // Verify checksum if provided
    if (checksum) {
      const computed = this.computeChecksum(body, checksum.algorithm);
      if (computed !== checksum.value) {
        throw new ApiError(422, 'checksum_mismatch', `Checksum mismatch: expected ${checksum.value}, got ${computed}`);
      }
    }

    // Write to temp file
    const tempPath = this.getTempPath(r.upload_id);
    await fs.mkdir(path.dirname(tempPath), { recursive: true });
    await fs.appendFile(tempPath, body);

    // Update offset
    const newOffset = Number(r.offset) + body.byteLength;
    await this.db('vortex_tus_uploads')
      .where({ id: r.id })
      .update({ offset: newOffset });

    return { offset: newOffset, received: body.byteLength };
  }

  /** HEAD — get the current offset and upload metadata. */
  async head(ownerId: string, uploadId: string): Promise<TusUpload> {
    const row = await this.requireActiveUpload(ownerId, uploadId);
    return toTusUpload(row);
  }

  /** Terminate (DELETE) an upload session. */
  async terminate(ownerId: string, uploadId: string): Promise<void> {
    const row = await this.db<TusUploadRow>('vortex_tus_uploads')
      .where({ upload_id: uploadId, owner_id: ownerId })
      .first();
    if (!row) throw ApiError.notFound('Upload not found');

    // Remove temp file
    await this.removeTempFile(row.upload_id);

    // Mark as terminated
    await this.db('vortex_tus_uploads')
      .where({ id: row.id })
      .update({ offset: row.size, status: 'terminated' });
  }

  /**
   * Concatenate a finished TUS upload into a storage object.
   * This is called when the client signals completion (offset === size).
   */
  async finalize(
    ownerId: string,
    uploadId: string,
    appId?: string | null,
  ): Promise<{ key: string; size: number; contentType: string }> {
    const row = await this.requireActiveUpload(ownerId, uploadId);
    const r = row;

    if (Number(r.offset) !== Number(r.size)) {
      throw new ApiError(409, 'upload_incomplete', `Upload is incomplete (${r.offset}/${r.size})`);
    }

    const tempPath = this.getTempPath(r.upload_id);
    const body = await fs.readFile(tempPath);

    // Verify size
    if (body.byteLength !== Number(r.size)) {
      throw new ApiError(422, 'size_mismatch', `Size mismatch: expected ${r.size}, got ${body.byteLength}`);
    }

    // Put the object
    const result = await this.driver.put({
      key: r.key,
      body,
      contentType: r.content_type ?? 'application/octet-stream',
    });

    // Clean up
    await this.removeTempFile(r.upload_id);
    await this.db('vortex_tus_uploads')
      .where({ id: r.id })
      .update({ status: 'completed' });

    return {
      key: r.key,
      size: result.size,
      contentType: r.content_type ?? 'application/octet-stream',
    };
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private async requireActiveUpload(ownerId: string, uploadId: string): Promise<TusUploadRow> {
    const row = await this.db<TusUploadRow>('vortex_tus_uploads')
      .where({ upload_id: uploadId, owner_id: ownerId })
      .first();
    if (!row) throw ApiError.notFound('Upload not found');
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
      throw new ApiError(410, 'upload_expired', 'Upload session expired');
    }
    return row;
  }

  private getTempPath(uploadId: string): string {
    return path.join(this.tempDir, `tus-${uploadId}.tmp`);
  }

  private async removeTempFile(uploadId: string): Promise<void> {
    try {
      await fs.unlink(this.getTempPath(uploadId));
    } catch {
      // File may not exist — that's fine
    }
  }

  private computeChecksum(data: Buffer, algorithm: string): string {
    const algo = algorithm.toLowerCase();
    if (algo === 'sha1' || algo === 'sha-1') {
      return createHash('sha1').update(data).digest('base64');
    }
    if (algo === 'sha256' || algo === 'sha-256') {
      return createHash('sha256').update(data).digest('base64');
    }
    if (algo === 'md5') {
      return createHash('md5').update(data).digest('base64');
    }
    throw new ApiError(422, 'unsupported_checksum', `Unsupported checksum algorithm: ${algorithm}`);
  }
}
