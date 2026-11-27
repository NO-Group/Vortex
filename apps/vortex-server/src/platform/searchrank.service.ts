import type { Knex } from 'knex';

/**
 * SearchRankingService — Search ranking + trending.
 * Tunes document ranking, tracks click-through trends, and surface trending content.
 */
export class SearchRankingService {
  constructor(private readonly db: Knex) {}

  /** Set or update a ranking weight for a field on a search index. */
  async upsertRanking(indexName: string, fieldName: string, weight: number, boost = 1) {
    await this.db('search_rankings').insert({
      index_name: indexName,
      field_name: fieldName,
      weight,
      boost,
    }).onConflict(['index_name', 'field_name']).merge();
  }

  async listRankings(indexName?: string) {
    if (indexName) {
      return this.db('search_rankings').where({ index_name: indexName });
    }
    return this.db('search_rankings');
  }

  async deleteRanking(indexName: string, fieldName: string): Promise<number> {
    return this.db('search_rankings').where({ index_name: indexName, field_name: fieldName }).del();
  }

  /** Record a click-through event to update trending. */
  async recordClick(indexName: string, docId: string, query: string) {
    // Bump trending content
    await this.db('trending_content')
      .insert({ index_name: indexName, content_id: docId, query, score: 1, updated_at: this.db.fn.now() })
      .onConflict(['index_name', 'content_id'])
      .merge({
        score: this.db.raw('trending_content.score + 1'),
        updated_at: this.db.fn.now(),
      });
  }

  async getTrending(indexName: string, limit = 20) {
    return this.db('trending_content')
      .where({ index_name: indexName })
      .orderBy('score', 'desc')
      .limit(limit);
  }
}
