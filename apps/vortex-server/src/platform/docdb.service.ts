import type { Knex } from 'knex';

/**
 * DocDBService — Document Database.
 * Provides a JSON document store with collection-based organization,
 * schema validation, and indexed lookups on top of PostgreSQL's JSONB.
 */
export class DocDBService {
  constructor(private readonly db: Knex) {}

  async createCollection(name: string, ownerId?: string, schema?: Record<string, unknown>, indexed = false) {
    const [id] = await this.db('document_collections').insert({
      name,
      owner_id: ownerId ?? null,
      schema: schema ?? null,
      indexed,
    });
    return { id, name };
  }

  async listCollections(ownerId?: string) {
    if (ownerId) {
      return this.db('document_collections').where({ owner_id: ownerId }).orderBy('created_at', 'desc');
    }
    return this.db('document_collections').orderBy('created_at', 'desc');
  }

  async deleteCollection(id: string): Promise<number> {
    await this.db('documents').where({ collection_id: id }).del();
    return this.db('document_collections').where({ id }).del();
  }

  async insert(collectionId: string, data: Record<string, unknown>, ownerId?: string) {
    const [id] = await this.db('documents').insert({
      collection_id: collectionId,
      owner_id: ownerId ?? null,
      data,
    });
    return { id };
  }

  async findById(collectionId: string, docId: string) {
    return this.db('documents').where({ collection_id: collectionId, id: docId }).first();
  }

  async query(collectionId: string, opts: {
    limit?: number;
    offset?: number;
    where?: Record<string, unknown>;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
  }) {
    const q = this.db('documents').where({ collection_id: collectionId });

    if (opts.where) {
      for (const [key, value] of Object.entries(opts.where)) {
        q.where(`data->>${key}`, String(value));
      }
    }

    if (opts.orderBy) {
      q.orderBy(`data->>${opts.orderBy}`, opts.orderDir ?? 'asc');
    }

    if (opts.limit) q.limit(opts.limit);
    if (opts.offset) q.offset(opts.offset);

    return q;
  }

  async update(collectionId: string, docId: string, patch: Record<string, unknown>): Promise<number> {
    return this.db('documents')
      .where({ collection_id: collectionId, id: docId })
      .update({ data: this.db.raw('data || ?::jsonb', [patch]), updated_at: this.db.fn.now() });
  }

  async delete(collectionId: string, docId: string): Promise<number> {
    return this.db('documents').where({ collection_id: collectionId, id: docId }).del();
  }

  async count(collectionId: string): Promise<number> {
    const row = await this.db('documents').where({ collection_id: collectionId }).count({ count: '*' }).first();
    return Number(row?.count ?? 0);
  }
}
