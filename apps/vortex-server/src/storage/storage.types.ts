export interface PutObjectInput {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
}

export interface PutObjectResult {
  key: string;
  size: number;
  contentType: string;
}

export interface GetObjectResult {
  body: Buffer;
  contentType: string;
  size: number;
}

export interface PresignUploadInput {
  key: string;
  contentType?: string;
  /** URL lifetime in seconds (default 900, max 3600). */
  expiresIn?: number;
}

export interface PresignedUrl {
  key: string;
  method: 'PUT' | 'GET';
  url: string;
  headers: Record<string, string>;
  /** ISO-8601 expiry timestamp. */
  expiresAt: string;
}

/**
 * Abstract storage interface. Backed by local disk (default fallback) or any
 * S3-compatible endpoint (AWS S3, Cloudflare R2, MinIO).
 */
export interface StorageDriver {
  readonly name: 'local' | 's3';

  put(input: PutObjectInput): Promise<PutObjectResult>;
  get(key: string): Promise<GetObjectResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix: string, limit: number): Promise<string[]>;

  /** Presigned direct-upload URL (PUT). `baseUrl` overrides the configured public base. */
  presignUpload(input: PresignUploadInput, baseUrl?: string): Promise<PresignedUrl>;
  /** Presigned direct-download URL (GET). `baseUrl` overrides the configured public base. */
  presignDownload(key: string, expiresIn: number, baseUrl?: string): Promise<PresignedUrl>;
}
