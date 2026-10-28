import type { HttpClient } from './http.js';
import type { FulltextIndex, FulltextSearchResult } from './types.js';

/**
 * Vortex Full-text Search — PostgreSQL native keyword search.
 *
 * ```ts
 * // Create a full-text index on the articles table
 * await vortex.search.createIndex({
 *   name: 'articles-fts',
 *   tableName: 'articles',
 *   columns: ['title', 'body'],
 *   language: 'english',
 * });
 *
 * // Search
 * const { results } = await vortex.search.fulltext({
 *   tableName: 'articles',
 *   query: 'migration + climate',
 *   limit: 10,
 * });
 *
 * // Natural language search
 * const { results: plain } = await vortex.search.fulltext({
 *   tableName: 'articles',
 *   query: 'articles about renewable energy',
 *   mode: 'plain',
 * });
 *
 * // List indexes
 * const indexes = await vortex.search.listIndexes();
 *
 * // Drop an index
 * await vortex.search.dropIndex('articles-fts');
 * ```
 */
export class Search {
  constructor(private readonly http: HttpClient) {}

  /** Create a full-text GIN index on the specified table columns. */
  async createIndex(input: {
    name: string;
    tableName: string;
    columns: string[];
    language?: string;
  }): Promise<FulltextIndex> {
    const { index } = await this.http.request<{ index: FulltextIndex }>(
      '/v1/search/fulltext/index',
      { method: 'POST', body: input },
    );
    return index;
  }

  /** List all full-text indexes. */
  async listIndexes(): Promise<FulltextIndex[]> {
    const { indexes } = await this.http.request<{ indexes: FulltextIndex[] }>(
      '/v1/search/fulltext/index',
    );
    return indexes;
  }

  /** Drop a full-text index. */
  async dropIndex(name: string): Promise<void> {
    await this.http.request(`/v1/search/fulltext/index/${name}`, { method: 'DELETE' });
  }

  /**
   * Search a table using full-text query.
   *
   * @param input.tableName - Table to search
   * @param input.query - Search query (supports boolean operators: AND, OR, NOT)
   * @param input.columns - Columns to search (defaults to index columns)
   * @param input.language - tsvector language (default: 'english')
   * @param input.limit - Max results (default: 20, max: 100)
   * @param input.mode - 'match' for boolean queries, 'plain' for natural language
   */
  async fulltext(input: {
    tableName: string;
    query: string;
    columns?: string[];
    language?: string;
    limit?: number;
    mode?: 'match' | 'plain';
  }): Promise<{ results: FulltextSearchResult[]; count: number }> {
    return this.http.request<{ results: FulltextSearchResult[]; count: number }>(
      '/v1/search/fulltext',
      { method: 'POST', body: input },
    );
  }
}
