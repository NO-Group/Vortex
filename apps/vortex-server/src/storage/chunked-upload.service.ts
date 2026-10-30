import { randomBytes, createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Knex } from 'knex';
import type { StorageDriver } from './storage.types.js';
import { ApiError } from '../errors.js';
import { S3StorageDriver } from './s3.driver.js';
import { LocalStorageDriver } from './local.driver.js';

interface ChunkedUploadRow {
  id: string;
  upload_id: string;
  owner_id: string;
  key: string;
  content_type: string | null;
  total_chunks: number;
  chunks_received: number;
  chunk_hashes: Record<string, string> | null;
  driver: string;
  status: 'in_progress' | 'completed' | 'aborted';
  completed_at: Date | null;
  created_at: Date;
}

interface S3MultipartState {
  uploadId: string;
  parts: { partNumber: number; etag: string; key: string }[];
}

/**
 * Chunked / multipart upload service.
 *
 * For S3: uses the native multipart upload API (CreateMultipartUpload,
 * UploadPart, CompleteMultipartUpload).
 * For local: writes chunks to a temp directory, then assembles the final file.
 */
export class ChunkedUploadService {
  private readonly tempDir: string;
  private readonly s3States = new Map<string, S3MultipartState>();

  constructor(
    private readonly db: Knex,
    private readonly driver: StorageDriver,
    tempDir?: string,
  ) {
    this.tempDir = tempDir ?? path.join(process.cwd(), '.vortex-chunks');
  }

  /** Initialize a chunked upload session. */
  async init(
    ownerId: string,
    input: { key: string; contentType?: string; totalChunks: number },
  ): Promise<{ uploadId: string; key: string; contentType: string; totalChunks: number }> {
    const uploadId = randomBytes(16).toString('hex');

    const [row] = await this.db<ChunkedUploadRow>('chunked_uploads')
      .insert({
        upload_id: uploadId,
        owner_id: ownerId,
        key: input.key,
        content_type: input.contentType ?? 'application/octet-stream',
        total_chunks: input.totalChunks,
        chunks_received: 0,
        driver: this.driver.name,
        status: 'in_progress',
      })
      .returning('*');

    const r = row!;
    return {
      uploadId: r.upload_id,
      key: r.key,
      contentType: r.content_type ?? 'application/octet-stream',
      totalChunks: r.total_chunks,
    };
  }

  /** Upload a single chunk. */
  async uploadChunk(
    ownerId: string,
    input: { uploadId: string; chunkIndex: number; totalChunks: number; body: Buffer; contentType?: string },
  ): Promise<{ chunkIndex: number; bytes: number }> {
    const row = await this.db<ChunkedUploadRow>('chunked_uploads')
      .where({ upload_id: input.uploadId, owner_id: ownerId })
      .first();
    if (!row) throw ApiError.notFound('Upload session not found');
    const r = row;

    if (r.status !== 'in_progress') {
      throw ApiError.badRequest(`Upload session is ${r.status}`);
    }
    if (input.chunkIndex < 0 || input.chunkIndex >= r.total_chunks) {
      throw ApiError.badRequest(`Chunk index ${input.chunkIndex} out of range (0-${r.total_chunks - 1})`);
    }

    const chunkHash = createHash('sha256').update(input.body).digest('hex');
    const hashes = r.chunk_hashes ? { ...r.chunk_hashes } : {};
    hashes[String(input.chunkIndex)] = chunkHash;

    if (this.driver instanceof LocalStorageDriver) {
      const chunkDir = path.join(this.tempDir, input.uploadId);
      await fs.mkdir(chunkDir, { recursive: true });
      await fs.writeFile(path.join(chunkDir, String(input.chunkIndex)), input.body);
    } else {
      await this.uploadChunkToS3(r, input.chunkIndex, input.body);
    }

    const chunksReceived = Object.keys(hashes).length;
    await this.db('chunked_uploads')
      .where({ id: r.id })
      .update({ chunks_received: chunksReceived, chunk_hashes: hashes });

    return { chunkIndex: input.chunkIndex, bytes: input.body.byteLength };
  }

  /** Complete the upload — assemble chunks into the final object. */
  async complete(
    ownerId: string,
    input: { uploadId: string },
  ): Promise<{ key: string; size: number; contentType: string }> {
    const row = await this.db<ChunkedUploadRow>('chunked_uploads')
      .where({ upload_id: input.uploadId, owner_id: ownerId })
      .first();
    if (!row) throw ApiError.notFound('Upload session not found');
    const r = row;

    if (r.status !== 'in_progress') {
      throw ApiError.badRequest(`Upload session is ${r.status}`);
    }

    const hashes = r.chunk_hashes ?? {};
    if (Object.keys(hashes).length !== r.total_chunks) {
      throw ApiError.badRequest(
        `Expected ${r.total_chunks} chunks, received ${Object.keys(hashes).length}`,
      );
    }

    if (this.driver instanceof LocalStorageDriver) {
      const chunkDir = path.join(this.tempDir, r.upload_id);
      const parts: Buffer[] = [];
      for (let i = 0; i < r.total_chunks; i++) {
        const chunkPath = path.join(chunkDir, String(i));
        const chunk = await fs.readFile(chunkPath);
        const chunkHash = createHash('sha256').update(chunk).digest('hex');
        if (hashes[String(i)] !== chunkHash) {
          throw ApiError.badRequest(`Chunk ${i} hash mismatch`);
        }
        parts.push(chunk);
      }
      const body = Buffer.concat(parts);
      const result = await this.driver.put({
        key: r.key,
        body,
        contentType: r.content_type ?? 'application/octet-stream',
      });
      await fs.rm(chunkDir, { recursive: true, force: true });

      await this.db('chunked_uploads')
        .where({ id: r.id })
        .update({ status: 'completed', completed_at: new Date() });

      return {
        key: r.key,
        size: result.size,
        contentType: r.content_type ?? 'application/octet-stream',
      };
    } else {
      const state = this.s3States.get(r.upload_id);
      if (!state) throw ApiError.badRequest('S3 multipart state not found');
      const result = await this.completeS3Multipart(r, state);
      this.s3States.delete(r.upload_id);
      return {
        key: r.key,
        size: result.size,
        contentType: r.content_type ?? 'application/octet-stream',
      };
    }
  }

  /** Get upload status. */
  async status(ownerId: string, uploadId: string): Promise<ChunkedUploadRow | null> {
    const row = await this.db<ChunkedUploadRow>('chunked_uploads')
      .where({ upload_id: uploadId, owner_id: ownerId })
      .first();
    if (!row) return null;
    return row;
  }

  /** Abort an upload session. */
  async abort(ownerId: string, uploadId: string): Promise<void> {
    const row = await this.db<ChunkedUploadRow>('chunked_uploads')
      .where({ upload_id: uploadId, owner_id: ownerId })
      .first();
    if (!row) throw ApiError.notFound('Upload session not found');
    const r = row;

    if (this.driver instanceof LocalStorageDriver) {
      const chunkDir = path.join(this.tempDir, r.upload_id);
      await fs.rm(chunkDir, { recursive: true, force: true });
    }

    await this.db('chunked_uploads')
      .where({ id: r.id })
      .update({ status: 'aborted' });
  }

  // ── S3 multipart helpers ──────────────────────────────────────────────

  private async uploadChunkToS3(
    row: ChunkedUploadRow,
    partNumber: number,
    body: Buffer,
  ): Promise<void> {
    const { UploadPartCommand, CreateMultipartUploadCommand } =
      await import('@aws-sdk/client-s3');

    let state = this.s3States.get(row.upload_id);
    if (!state) {
      const client = this.getS3Client();
      const res = await client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.getS3Bucket(),
          Key: row.key,
          ContentType: row.content_type ?? undefined,
        }),
      );
      state = { uploadId: res.UploadId!, parts: [] };
      this.s3States.set(row.upload_id, state);
    }

    const res = await this.getS3Client().send(
      new UploadPartCommand({
        Bucket: this.getS3Bucket(),
        Key: row.key,
        UploadId: state.uploadId,
        PartNumber: partNumber + 1,
        Body: body,
      }),
    );
    state.parts.push({ partNumber: partNumber + 1, etag: res.ETag!, key: row.key });
  }

  private async completeS3Multipart(
    row: ChunkedUploadRow,
    state: S3MultipartState,
  ): Promise<{ size: number }> {
    const { CompleteMultipartUploadCommand } = await import('@aws-sdk/client-s3');
    await this.getS3Client().send(
      new CompleteMultipartUploadCommand({
        Bucket: this.getS3Bucket(),
        Key: row.key,
        UploadId: state.uploadId,
        MultipartUpload: {
          Parts: state.parts.map((p) => ({
            ETag: p.etag,
            PartNumber: p.partNumber,
          })),
        },
      }),
    );
    return { size: 0 };
  }

  private getS3Client(): import('@aws-sdk/client-s3').S3Client {
    if (!(this.driver instanceof S3StorageDriver)) {
      throw ApiError.badRequest('S3 client not available');
    }
    return (this.driver as unknown as { client: import('@aws-sdk/client-s3').S3Client }).client;
  }

  private getS3Bucket(): string {
    if (!(this.driver instanceof S3StorageDriver)) {
      throw ApiError.badRequest('S3 bucket not available');
    }
    return (this.driver as unknown as { config: { bucket: string } }).config.bucket;
  }
}
