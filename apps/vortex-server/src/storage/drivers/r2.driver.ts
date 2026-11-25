import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ApiError } from '../../errors.js';
import { validateStorageKey } from '../driver.interface.js';
import type {
  IVortexStorageDriver,
  MultipartPart,
  PresignedUrlOptions,
  PresignedUrlResult,
  StorageObjectMetadata,
  BulkDeleteResult,
  ListObjectsResult,
  DriverConfig,
} from '../driver.interface.js';

/**
 * Cloudflare R2 driver — [Default Managed Cloud Engine].
 *
 * Must be configured as the primary target for managed Vortex Cloud
 * instances to leverage $0 egress/bandwidth transfer costs.
 * Endpoint format: https://<account>.r2.cloudflarestorage.com
 *
 * R2 is fully S3-compatible, so this driver wraps the AWS SDK S3 client
 * with R2-specific endpoint and configuration defaults.
 */
export class R2Driver implements IVortexStorageDriver {
  readonly name = 'cloudflare_r2';
  readonly provider = 'Cloudflare R2';
  readonly supportsMultipart = true;
  readonly supportsBatch = true;

  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;

  constructor(config: DriverConfig) {
    this.bucket = config.bucket;
    const accountId = config.accountId ?? '';
    this.endpoint = config.endpoint ?? `https://${accountId}.r2.cloudflarestorage.com`;

    this.client = new S3Client({
      region: config.region ?? 'auto',
      endpoint: this.endpoint,
      forcePathStyle: config.forcePathStyle ?? true,
      credentials: {
        accessKeyId: config.accessKeyId!,
        secretAccessKey: config.secretAccessKey!,
      },
    });
  }

  async uploadObject(
    key: string,
    body: Buffer | Uint8Array,
    mimeType: string,
    _options?: { metadata?: Record<string, string> },
  ): Promise<StorageObjectMetadata> {
    validateStorageKey(key);
    const bytes = body instanceof Buffer ? body : Buffer.from(body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
      }),
    );
    return {
      key,
      size: bytes.byteLength,
      mimeType,
      etag: '',
      lastModified: new Date(),
    };
  }

  async downloadObject(key: string): Promise<{
    stream: ReadableStream<Uint8Array>;
    metadata: StorageObjectMetadata;
  }> {
    validateStorageKey(key);
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const stream = res.Body as ReadableStream<Uint8Array>;
    return {
      stream,
      metadata: {
        key,
        size: Number(res.ContentLength ?? 0),
        mimeType: res.ContentType ?? 'application/octet-stream',
        etag: res.ETag ?? '',
        lastModified: res.LastModified ?? new Date(),
      },
    };
  }

  async deleteObject(key: string): Promise<void> {
    validateStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deleteBulkObjects(keys: string[]): Promise<BulkDeleteResult> {
    if (keys.length === 0) return { deleted: [], failed: [] };
    // R2 supports DeleteObjects (batch delete up to 1000 keys)
    const objects = keys.map((Key) => ({ Key }));
    const res = await this.client.send(
      new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: objects } }),
    );
    const deleted = keys.filter((k) =>
      res.Deleted?.some((d) => d.Key === k),
    );
    const failed = keys.filter((k) => !deleted.includes(k));
    return { deleted, failed };
  }

  async generatePresignedUrl(options: PresignedUrlOptions): Promise<PresignedUrlResult> {
    validateStorageKey(options.key);
    if (options.action === 'write') {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        ContentType: options.contentType,
      });
      const url = await getSignedUrl(this.client, command, {
        expiresIn: options.expiresInSeconds,
      });
      return {
        url,
        method: 'PUT',
        headers: options.contentType ? { 'content-type': options.contentType } : {},
        expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000).toISOString(),
      };
    }
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: options.key,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: options.expiresInSeconds,
    });
    return {
      url,
      method: 'GET',
      headers: {},
      expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000).toISOString(),
    };
  }

  async initiateMultipartUpload(key: string, mimeType: string): Promise<{ uploadId: string }> {
    validateStorageKey(key);
    const res = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: mimeType,
      }),
    );
    return { uploadId: res.UploadId! };
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<MultipartPart> {
    const res = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    );
    return { partNumber, etag: res.ETag ?? '' };
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: MultipartPart[]): Promise<StorageObjectMetadata> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
    return this.getObjectMetadata(key);
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async listObjects(prefix?: string, limit = 1000): Promise<ListObjectsResult> {
    const res = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        MaxKeys: Math.min(limit, 1000),
      }),
    );
    const objects = (res.Contents ?? []).map((obj) => ({
      key: obj.Key!,
      size: Number(obj.Size ?? 0),
      mimeType: 'application/octet-stream',
      etag: obj.ETag ?? '',
      lastModified: obj.LastModified ?? new Date(),
    }));
    return { objects, nextToken: res.NextContinuationToken };
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata> {
    const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    return {
      key,
      size: Number(res.ContentLength ?? 0),
      mimeType: res.ContentType ?? 'application/octet-stream',
      etag: res.ETag ?? '',
      lastModified: res.LastModified ?? new Date(),
    };
  }

  async cleanupOrphanedMultipartUploads(olderThan: Date): Promise<number> {
    let count = 0;
    let keyMarker: string | undefined;
    let uploadIdMarker: string | undefined;
    let truncated = true;
    do {
      const listRes = await this.client.send(
        new ListMultipartUploadsCommand({
          Bucket: this.bucket,
          KeyMarker: keyMarker,
          UploadIdMarker: uploadIdMarker,
        }),
      );
      const orphaned = (listRes.Uploads ?? []).filter(
        (u) => u.Initiated && new Date(u.Initiated as unknown as string) < olderThan,
      );
      for (const upload of orphaned) {
        await this.abortMultipartUpload(upload.Key!, upload.UploadId as string);
        count++;
      }
      keyMarker = listRes.NextKeyMarker;
      uploadIdMarker = listRes.NextUploadIdMarker;
      truncated = !!listRes.IsTruncated;
    } while (truncated);
    return count;
  }
}
