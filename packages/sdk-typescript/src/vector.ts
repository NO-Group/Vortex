import type { HttpClient } from './http.js';
import type { VectorCollection, VectorItem, VectorSearchResult } from './types.js';

/**
 * Vortex Vector Search — semantic similarity for AI applications.
 *
 * ```ts
 * // Create a collection for OpenAI embeddings (1536 dimensions)
 * await vortex.vector.createCollection({
 *   name: 'documents',
 *   dimensions: 1536,
 * });
 *
 * // Insert a vector with metadata
 * await vortex.vector.insert('collection-id', {
 *   itemId: 'doc-1',
 *   vector: embedding,
 *   payload: { title: 'Hello', category: 'docs' },
 * });
 *
 * // Semantic search
 * const results = await vortex.vector.search('collection-id', queryEmbedding, {
 *   limit: 5,
 *   filter: { category: 'docs' },
 * });
 * // [{ item_id: 'doc-1', score: 0.95, payload: {...} }]
 * ```
 */
export class Vector {
  constructor(private readonly http: HttpClient) {}

  /** Create a vector collection. */
  async createCollection(input: {
    name: string;
    description?: string;
    dimensions: number;
  }): Promise<VectorCollection> {
    const { collection } = await this.http.request<{ collection: VectorCollection }>(
      '/v1/vector/collections',
      { method: 'POST', body: input },
    );
    return collection;
  }

  /** List vector collections. */
  async listCollections(): Promise<VectorCollection[]> {
    const { collections } = await this.http.request<{ collections: VectorCollection[] }>(
      '/v1/vector/collections',
    );
    return collections;
  }

  /** Delete a vector collection (and all its items). */
  async deleteCollection(collectionId: string): Promise<void> {
    await this.http.request(`/v1/vector/collections/${collectionId}`, {
      method: 'DELETE',
    });
  }

  /** Insert a vector into a collection. */
  async insert(collectionId: string, input: {
    itemId: string;
    vector: number[];
    payload?: Record<string, unknown>;
  }): Promise<VectorItem> {
    const { item } = await this.http.request<{ item: VectorItem }>(
      `/v1/vector/collections/${collectionId}/items`,
      { method: 'POST', body: input },
    );
    return item;
  }

  /** Upsert a vector (insert or update by item_id). */
  async upsert(collectionId: string, input: {
    itemId: string;
    vector: number[];
    payload?: Record<string, unknown>;
  }): Promise<VectorItem> {
    const { item } = await this.http.request<{ item: VectorItem }>(
      `/v1/vector/collections/${collectionId}/items`,
      { method: 'PATCH', body: input },
    );
    return item;
  }

  /** Delete a vector from a collection. */
  async delete(collectionId: string, itemId: string): Promise<void> {
    await this.http.request(
      `/v1/vector/collections/${collectionId}/items/${itemId}`,
      { method: 'DELETE' },
    );
  }

  /** List vectors in a collection. */
  async list(collectionId: string, limit?: number): Promise<VectorItem[]> {
    const params = limit ? `?limit=${limit}` : '';
    const { items } = await this.http.request<{ items: VectorItem[] }>(
      `/v1/vector/collections/${collectionId}/items${params}`,
    );
    return items;
  }

  /** Search for similar vectors using cosine similarity. */
  async search(collectionId: string, queryVector: number[], opts?: {
    limit?: number;
    filter?: Record<string, unknown>;
  }): Promise<VectorSearchResult[]> {
    const { results } = await this.http.request<{ results: VectorSearchResult[] }>(
      `/v1/vector/collections/${collectionId}/search`,
      {
        method: 'POST',
        body: { vector: queryVector, limit: opts?.limit, filter: opts?.filter },
      },
    );
    return results;
  }
}
