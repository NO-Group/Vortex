import type { HttpClient } from './http.js';
import type { ChunkedUploadInit, ChunkedUploadStatus, BulkDeleteResult } from './types.js';

/**
 * Chunked / multipart upload client — `/v1/storage/chunked`.
 */
export class ChunkedUpload {
  constructor(private readonly http: HttpClient) {}

  /** Initialize a chunked upload session. */
  async init(
    key: string,
    totalChunks: number,
    contentType?: string,
  ): Promise<ChunkedUploadInit> {
    return this.http.request<ChunkedUploadInit>('/v1/storage/chunked/init', {
      method: 'POST',
      body: { key, totalChunks, contentType },
    });
  }

  /** Upload a single chunk (raw body). */
  async uploadChunk(
    uploadId: string,
    chunkIndex: number,
    totalChunks: number,
    body: Uint8Array,
    contentType?: string,
  ): Promise<{ chunkIndex: number; bytes: number }> {
    const params = new URLSearchParams({
      uploadId,
      chunkIndex: String(chunkIndex),
      totalChunks: String(totalChunks),
    });
    return this.http.request<{ chunkIndex: number; bytes: number }>(
      `/v1/storage/chunked/chunk?${params}`,
      { method: 'PUT', body: body, headers: { 'content-type': contentType ?? 'application/octet-stream' } },
    );
  }

  /** Complete the upload — assemble chunks into the final object. */
  async complete(uploadId: string): Promise<{ object: { key: string; size: number; contentType: string } }> {
    return this.http.request<{ object: { key: string; size: number; contentType: string } }>(
      '/v1/storage/chunked/complete',
      { method: 'POST', body: { uploadId } },
    );
  }

  /** Check upload progress. */
  async status(uploadId: string): Promise<ChunkedUploadStatus> {
    return this.http.request<ChunkedUploadStatus>(`/v1/storage/chunked/status?uploadId=${uploadId}`);
  }

  /** Abort an upload session. */
  async abort(uploadId: string): Promise<void> {
    await this.http.request('/v1/storage/chunked/abort', { method: 'POST', body: { uploadId } });
  }

  /** Bulk delete multiple objects at once. */
  async bulkDelete(keys: string[]): Promise<BulkDeleteResult> {
    return this.http.request<BulkDeleteResult>('/v1/storage/bulk-delete', {
      method: 'POST',
      body: { keys },
    });
  }
}
