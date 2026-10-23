import type { Knex } from 'knex';
import type { Bucket } from '@vortex/core';
import { ApiError } from '../errors.js';

interface BucketRow {
  name: string;
  public: boolean;
  owner_id: string | null;
  created_at: Date;
}

function toBucket(row: BucketRow): Bucket {
  return {
    name: row.name,
    public: row.public,
    ownerId: row.owner_id,
    createdAt: row.created_at.toISOString(),
  };
}

const BUCKET_NAME = /^[a-z0-9][a-z0-9-]{1,30}$/;

/** Names that belong to engine families, never to user buckets. */
export const RESERVED_BUCKETS = new Set(['apps', 'v1', 'vortex', 'healthz', 'realtime']);

export function validateBucketName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!BUCKET_NAME.test(trimmed)) {
    throw ApiError.badRequest(
      'Bucket name must be 2-31 chars of lowercase letters, digits, and dashes',
    );
  }
  if (RESERVED_BUCKETS.has(trimmed)) {
    throw ApiError.badRequest(`"${trimmed}" is a reserved bucket name`);
  }
  return trimmed;
}

/** Extract the bucket segment from an object key (`<bucket>/<path>`). */
export function bucketOfKey(key: string): string {
  return key.split('/')[0] ?? '';
}

/** Bucket registry — storage namespaces with public/private visibility. */
export class BucketService {
  constructor(private readonly db: Knex) {}

  async create(name: string, isPublic: boolean, ownerId: string | null): Promise<Bucket> {
    let safe: string;
    try {
      safe = validateBucketName(name);
    } catch (err) {
      throw err instanceof ApiError ? err : ApiError.badRequest((err as Error).message);
    }

    const existing = await this.db<BucketRow>('buckets').where({ name: safe }).first();
    if (existing) throw ApiError.conflict(`Bucket "${safe}" already exists`);

    const [row] = await this.db<BucketRow>('buckets')
      .insert({ name: safe, public: isPublic, owner_id: ownerId })
      .returning('*');
    return toBucket(row!);
  }

  async list(): Promise<Bucket[]> {
    const rows = await this.db<BucketRow>('buckets').orderBy('created_at', 'asc');
    return rows.map(toBucket);
  }

  async get(name: string): Promise<Bucket | null> {
    const row = await this.db<BucketRow>('buckets').where({ name }).first();
    return row ? toBucket(row) : null;
  }

  /** Assert the key's bucket exists (write paths only). */
  async assertKeyAllowed(key: string): Promise<Bucket> {
    const bucketName = bucketOfKey(key);
    if (!bucketName || bucketName.includes(' ') || bucketName === 'apps') {
      throw ApiError.badRequest(
        `Object keys must start with a bucket name ("my-bucket/file.txt"); got "${key}"`,
      );
    }
    const bucket = await this.get(bucketName);
    if (!bucket) {
      throw ApiError.badRequest(`Bucket "${bucketName}" does not exist — create it first`);
    }
    return bucket;
  }

  /** Delete a bucket and every object registered under it. */
  async remove(name: string, userId: string, isAdmin: boolean): Promise<string[]> {
    const bucket = await this.get(name);
    if (!bucket) throw ApiError.notFound(`Bucket "${name}" not found`);
    if (!isAdmin && bucket.ownerId && bucket.ownerId !== userId) {
      throw ApiError.forbidden('You do not own this bucket');
    }
    if (!isAdmin && !bucket.ownerId) {
      throw ApiError.forbidden('Only admins can delete default buckets');
    }

    const prefix = `${name}/`;
    const rows = await this.db<{ key: string }>('storage_objects')
      .where('key', 'like', `${prefix}%`)
      .select('key');
    await this.db('storage_objects').where('key', 'like', `${prefix}%`).del();
    await this.db('buckets').where({ name }).del();
    return rows.map((r) => r.key);
  }
}
