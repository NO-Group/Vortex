import type { Knex } from 'knex';
import type { StorageObjectMeta } from '@vortex/core';
import type { ServerEnv } from '../config/env.js';
import { LocalStorageDriver } from './local.driver.js';
import { S3StorageDriver } from './s3.driver.js';
import type { StorageDriver } from './storage.types.js';

interface StorageObjectRow {
  id: string;
  key: string;
  size: string | number;
  content_type: string;
  owner_id: string | null;
  created_at: Date;
}

function toMeta(row: StorageObjectRow): StorageObjectMeta {
  return {
    id: row.id,
    key: row.key,
    size: Number(row.size),
    contentType: row.content_type,
    ownerId: row.owner_id,
    createdAt: row.created_at.toISOString(),
  };
}

/** Construct the configured storage driver. */
export function createStorageDriver(env: ServerEnv): StorageDriver {
  if (env.storage.driver === 's3') {
    return new S3StorageDriver(env.storage.s3);
  }
  return new LocalStorageDriver(
    env.storage.localDir,
    env.jwt.secret,
    env.storage.publicApiBase,
  );
}

/** Persisted metadata registry for storage objects. */
export class StorageRegistry {
  constructor(private readonly db: Knex) {}

  async record(input: {
    key: string;
    size: number;
    contentType: string;
    ownerId: string | null;
  }): Promise<StorageObjectMeta> {
    const [row] = await this.db<StorageObjectRow>('storage_objects')
      .insert({
        key: input.key,
        size: input.size,
        content_type: input.contentType,
        owner_id: input.ownerId,
      })
      .onConflict('key')
      .merge({ size: input.size, content_type: input.contentType })
      .returning('*');
    return toMeta(row!);
  }

  async find(key: string): Promise<StorageObjectMeta | null> {
    const row = await this.db<StorageObjectRow>('storage_objects').where({ key }).first();
    return row ? toMeta(row) : null;
  }

  async remove(key: string): Promise<void> {
    await this.db('storage_objects').where({ key }).del();
  }

  async listForOwner(ownerId: string, limit = 100): Promise<StorageObjectMeta[]> {
    const rows = await this.db<StorageObjectRow>('storage_objects')
      .where({ owner_id: ownerId })
      .orderBy('created_at', 'desc')
      .limit(limit);
    return rows.map(toMeta);
  }
}
