import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { S3Config } from '../config/env.js';
import { ApiError } from '../errors.js';
import type {
  GetObjectResult,
  PresignUploadInput,
  PresignedUrl,
  PutObjectInput,
  PutObjectResult,
  StorageDriver,
} from './storage.types.js';

const DEFAULT_EXPIRES = 900;
const MAX_EXPIRES = 3600;

/**
 * S3-compatible storage driver (AWS S3, Cloudflare R2, MinIO).
 * Uses presigned URLs for direct browser/SDK uploads and downloads —
 * traffic never proxies through the Vortex server.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const;
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: PutObjectInput): Promise<PutObjectResult> {
    const body = input.body instanceof Buffer ? input.body : Buffer.from(input.body);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.key,
        Body: body,
        ContentType: input.contentType,
      }),
    );
    return {
      key: input.key,
      size: body.byteLength,
      contentType: input.contentType ?? 'application/octet-stream',
    };
  }

  async get(key: string): Promise<GetObjectResult> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      const bytes = await res.Body?.transformToByteArray();
      const body = Buffer.from(bytes ?? []);
      return {
        body,
        contentType: res.ContentType ?? 'application/octet-stream',
        size: body.byteLength,
      };
    } catch {
      throw ApiError.notFound(`Object not found: "${key}"`);
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async list(prefix: string, limit: number): Promise<string[]> {
    const res = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        MaxKeys: limit,
      }),
    );
    return (res.Contents ?? [])
      .map((obj) => obj.Key)
      .filter((key): key is string => typeof key === 'string');
  }

  private expiresInSeconds(expiresIn?: number): number {
    return Math.min(Math.max(expiresIn ?? DEFAULT_EXPIRES, 1), MAX_EXPIRES);
  }

  async presignUpload(input: PresignUploadInput): Promise<PresignedUrl> {
    const seconds = this.expiresInSeconds(input.expiresIn);
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.key,
      ContentType: input.contentType,
    });
    const url = await getSignedUrl(this.client, command, { expiresIn: seconds });
    return {
      key: input.key,
      method: 'PUT',
      url,
      headers: input.contentType ? { 'content-type': input.contentType } : {},
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }

  async presignDownload(key: string, expiresIn: number): Promise<PresignedUrl> {
    const seconds = this.expiresInSeconds(expiresIn);
    const command = new GetObjectCommand({ Bucket: this.config.bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: seconds });
    return {
      key,
      method: 'GET',
      url,
      headers: {},
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }
}
