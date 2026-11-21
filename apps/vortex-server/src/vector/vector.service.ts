import type { Knex } from 'knex';

export interface VectorCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  dimensions: number;
  created_at: Date | string;
}

export interface VectorItem {
  id: string;
  collection_id: string;
  item_id: string;
  vector: number[];
  payload: Record<string, unknown> | null;
  created_at: Date | string;
}

export interface VectorSearchResult {
  item_id: string;
  score: number;
  payload: Record<string, unknown> | null;
}

export interface VectorService {
  createCollection(
    userId: string,
    input: { name: string; description?: string; dimensions: number },
  ): Promise<VectorCollection>;
  listCollections(userId: string): Promise<VectorCollection[]>;
  deleteCollection(userId: string, collectionId: string): Promise<boolean>;

  insert(
    collectionId: string,
    input: { itemId: string; vector: number[]; payload?: Record<string, unknown> },
  ): Promise<VectorItem>;
  upsert(
    collectionId: string,
    input: { itemId: string; vector: number[]; payload?: Record<string, unknown> },
  ): Promise<VectorItem>;
  delete(collectionId: string, itemId: string): Promise<boolean>;
  list(collectionId: string, limit?: number): Promise<VectorItem[]>;

  search(
    collectionId: string,
    queryVector: number[],
    opts?: { limit?: number; filter?: Record<string, unknown> },
  ): Promise<VectorSearchResult[]>;
}

/** Cosine similarity: (a · b) / (|a| × |b|). Returns -1 to 1. */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function createVectorService(db: Knex): VectorService {
  return {
    async createCollection(userId, input) {
      const [row] = await db('vortex_vector_collections').insert({
        user_id: userId,
        name: input.name,
        description: input.description ?? null,
        dimensions: input.dimensions,
      }).returning('*');
      return row;
    },

    async listCollections(userId) {
      return db('vortex_vector_collections')
        .select('*')
        .where('user_id', userId)
        .orderBy('created_at', 'desc');
    },

    async deleteCollection(userId, collectionId) {
      const result = await db('vortex_vector_collections')
        .where({ id: collectionId, user_id: userId })
        .delete();
      if (result > 0) {
        await db('vortex_vector_items').where({ collection_id: collectionId }).delete();
      }
      return result > 0;
    },

    async insert(collectionId, input) {
      const [row] = await db('vortex_vector_items').insert({
        collection_id: collectionId,
        item_id: input.itemId,
        vector: input.vector,
        payload: input.payload ?? null,
      }).returning('*');
      return row;
    },

    async upsert(collectionId, input) {
      // Delete existing item with same item_id, then insert
      await db('vortex_vector_items')
        .where({ collection_id: collectionId, item_id: input.itemId })
        .delete();
      return this.insert(collectionId, input);
    },

    async delete(collectionId, itemId) {
      const result = await db('vortex_vector_items')
        .where({ collection_id: collectionId, item_id: itemId })
        .delete();
      return result > 0;
    },

    async list(collectionId, limit = 100) {
      return db('vortex_vector_items')
        .select('*')
        .where({ collection_id: collectionId })
        .orderBy('created_at', 'desc')
        .limit(limit);
    },

    async search(collectionId, queryVector, opts = {}) {
      const limit = opts.limit ?? 10;
      const items = await db('vortex_vector_items')
        .select('item_id', 'vector', 'payload')
        .where({ collection_id: collectionId })
        .limit(5000); // cap for in-process computation

      const scored = items.map((item) => ({
        item_id: item.item_id,
        score: cosineSimilarity(queryVector, item.vector as number[]),
        payload: item.payload as Record<string, unknown> | null,
      }));

      // Apply payload filter
      const filtered = opts.filter
        ? scored.filter((s) => {
            if (!s.payload) return false;
            return Object.entries(opts.filter!).every(([k, v]) => s.payload?.[k] === v);
          })
        : scored;

      // Sort by score descending and limit
      return filtered
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    },
  };
}
