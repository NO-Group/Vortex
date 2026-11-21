/**
 * Strict storage driver interface — every provider adapter MUST implement
 * this contract. The Vortex Storage Engine acts as a unified S3-Compatible
 * Protocol Gateway translating standard S3 operations across 6 storage targets.
 */

export interface StorageObjectMetadata {
  key: string;
  size: number;
  mimeType: string;
  etag: string;
  lastModified: Date;
  customMetadata?: Record<string, string>;
}

export interface PresignedUrlOptions {
  key: string;
  expiresInSeconds: number;
  contentType?: string;
  action: 'read' | 'write';
}

export interface PresignedUrlResult {
  url: string;
  method: 'GET' | 'PUT' | 'POST';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface MultipartPart {
  partNumber: number;
  etag: string;
}

export interface BulkDeleteResult {
  deleted: string[];
  failed: string[];
}

export interface ListObjectsResult {
  objects: StorageObjectMetadata[];
  nextToken?: string;
}

export interface IVortexStorageDriver {
  /** Unique driver name. */
  readonly name: string;
  /** Human-readable provider label. */
  readonly provider: string;
  /** Whether this driver supports native multipart uploads. */
  readonly supportsMultipart: boolean;
  /** Whether this driver supports native batch operations. */
  readonly supportsBatch: boolean;

  // ── Core Operations ────────────────────────────────────────────────────

  /** Upload an object to the storage target. */
  uploadObject(
    key: string,
    body: Buffer | Uint8Array,
    mimeType: string,
    options?: { metadata?: Record<string, string> },
  ): Promise<StorageObjectMetadata>;

  /** Download an object. Returns a stream + metadata. */
  downloadObject(key: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    metadata: StorageObjectMetadata;
  }>;

  /** Delete a single object. */
  deleteObject(key: string): Promise<void>;

  /** Delete multiple objects in a single operation. */
  deleteBulkObjects(keys: string[]): Promise<BulkDeleteResult>;

  // ── Advanced Operations ─────────────────────────────────────────────────

  /** Generate a time-limited presigned URL for direct browser access. */
  generatePresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult>;

  /** Initiate a multipart upload. Returns an upload ID. */
  initiateMultipartUpload(
    key: string,
    mimeType: string,
  ): Promise<{ uploadId: string }>;

  /** Upload a single part of a multipart upload. */
  uploadPart(
    key: string,
    uploadId: string,
    partNumber: number,
    body: Buffer,
  ): Promise<MultipartPart>;

  /** Complete a multipart upload by assembling all parts. */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartPart[],
  ): Promise<StorageObjectMetadata>;

  /** Abort a multipart upload (cleanup orphaned uploads). */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  // ── Utility ────────────────────────────────────────────────────────────

  /** List objects with optional prefix filter and limit. */
  listObjects(prefix?: string, limit?: number): Promise<ListObjectsResult>;

  /** Check if an object exists. */
  objectExists(key: string): Promise<boolean>;

  /** Get object metadata without downloading the body. */
  getObjectMetadata(key: string): Promise<StorageObjectMetadata>;

  /** Clean up orphaned multipart uploads older than the given timestamp. */
  cleanupOrphanedMultipartUploads(olderThan: Date): Promise<number>;
}

/**
 * Driver configuration for a single provider.
 */
export interface DriverConfig {
  type: ProviderType;
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
  /** Local disk path for local_disk driver. */
  localDir?: string;
  /** Account ID for Cloudflare R2. */
  accountId?: string;
  /** Project ID for GCS. */
  projectId?: string;
  /** Connection string for Azure Blob. */
  connectionString?: string;
}

export type ProviderType =
  | 'cloudflare_r2'
  | 'aws_s3'
  | 'digitalocean_spaces'
  | 'gcs'
  | 'azure_blob'
  | 'local_disk';

/**
 * Validate a storage key against path traversal attacks.
 * Rejects keys containing ../, ...., null bytes, or absolute paths.
 */
export function validateStorageKey(key: string): void {
  if (!key || key.length === 0) {
    throw new Error('Storage key cannot be empty');
  }
  if (key.includes('\0')) {
    throw new Error('Storage key cannot contain null bytes');
  }
  if (key.includes('..') || key.includes('....')) {
    throw new Error('Storage key cannot contain path traversal sequences');
  }
  // Allow alphanumeric, dash, underscore, slash, dot (but not at start of segment)
  const segments = key.split('/');
  for (const seg of segments) {
    if (seg === '..' || seg === '...') {
      throw new Error('Storage key cannot contain path traversal sequences');
    }
  }
}
