/**
 * Vortex Server — Storage Registry: tracks object metadata in PostgreSQL.
 */

import type { Knex } from 'knex';
import type { StorageObjectMeta } from '@vortex/core';

export class StorageRegistry {
  constructor(private db: Knex) {}

  async record(opts: {
    key: string;
    size: number;
    contentType: string;
    ownerId: string | null;
    appId?: string | null;
  }): Promise<StorageObjectMeta> {
    await this.db('storage_objects')
      .where({ key: opts.key })
      .delete();

    const [row] = await this.db('storage_objects')
      .insert({
        key: opts.key,
        size: opts.size,
        content_type: opts.contentType,
        owner_id: opts.ownerId,
        app_id: opts.appId ?? null,
      })
      .returning('*');

    return this.toMeta(row);
  }

  async find(key: string): Promise<StorageObjectMeta | null> {
    const row = await this.db('storage_objects').where({ key }).first<Record<string, unknown>>();
    if (!row) return null;
    return this.toMeta(row);
  }

  async listForOwner(ownerId: string, limit: number = 100, appId?: string | null): Promise<StorageObjectMeta[]> {
    let query = this.db('storage_objects').where({ owner_id: ownerId });
    if (appId) query = query.where({ app_id: appId });
    query = query.orderBy('created_at', 'desc').limit(limit);

    const rows = (await query) as Record<string, unknown>[];
    return rows.map((r) => this.toMeta(r));
  }

  async remove(key: string): Promise<void> {
    await this.db('storage_objects').where({ key }).delete();
  }

  private toMeta(row: Record<string, unknown>): StorageObjectMeta {
    return {
      key: row.key as string,
      size: Number(row.size) || 0,
      contentType: row.content_type as string,
      ownerId: row.owner_id as string | null,
      appId: (row.app_id as string | null) ?? null,
      createdAt: row.created_at as string,
      etag: row.etag as string | undefined,
    };
  }
}
