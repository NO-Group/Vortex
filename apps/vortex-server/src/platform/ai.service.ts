import type { Knex } from 'knex';

/**
 * AIService — AI capabilities: moderation, spam detection, auto-tagging,
 * recommendations, and personalized search ranking.
 * The AI processing is done via pluggable hooks — the platform provides
 * the data flow and persistence, and models can be plugged in.
 */
export class AIService {
  constructor(private readonly db: Knex) {}

  // ─── Moderation Queue ─────────────────────────────────────────────

  async submitModeration(contentType: string, contentId: string, content: string, submittedBy?: string) {
    const [id] = await this.db('moderation_queue').insert({
      content_type: contentType,
      content_id: contentId,
      content,
      submitted_by: submittedBy ?? null,
      status: 'pending',
    });
    return { id };
  }

  async listModeration(status?: string, limit = 50) {
    const q = this.db('moderation_queue').orderBy('created_at', 'desc').limit(limit);
    if (status) q.where({ status });
    return q;
  }

  async reviewModeration(id: string, verdict: 'approved' | 'flagged' | 'rejected', reason?: string) {
    return this.db('moderation_queue').where({ id }).update({
      status: verdict === 'rejected' ? 'rejected' : verdict === 'flagged' ? 'flagged' : 'approved',
      verdict,
      review_reason: reason ?? null,
      reviewed_at: this.db.fn.now(),
    });
  }

  // ─── Auto-Tagging ────────────────────────────────────────────────

  async tag(contentType: string, contentId: string, tags: string[]) {
    for (const tag of tags) {
      await this.db('auto_tags').insert({
        content_type: contentType,
        content_id: contentId,
        tag,
        source: 'ai',
      }).onConflict(['content_type', 'content_id', 'tag']).merge();
    }
  }

  async getTags(contentType: string, contentId: string) {
    return this.db('auto_tags').where({ content_type: contentType, content_id: contentId });
  }

  async searchByTags(contentType: string, tags: string[]) {
    return this.db('auto_tags')
      .where({ content_type: contentType })
      .whereIn('tag', tags)
      .select('content_id')
      .distinct();
  }

  // ─── Recommendations ────────────────────────────────────────────

  async recordInteraction(userId: string, contentType: string, contentId: string, interaction: 'view' | 'like' | 'share' | 'comment') {
    await this.db('recommendations').insert({
      user_id: userId,
      content_type: contentType,
      content_id: contentId,
      interaction,
      score: this.interactionScore(interaction),
    });
  }

  async getRecommendations(userId: string, contentType: string, limit = 10) {
    // Get top interacted content
    const rows = await this.db('recommendations')
      .where({ user_id: userId, content_type: contentType })
      .orderBy('score', 'desc')
      .limit(limit);

    const contentIds = rows.map((r) => r.content_id);

    // Get similar content via auto-tags overlap
    const userTags = await this.db('auto_tags')
      .whereIn('content_id', contentIds)
      .select('tag')
      .distinct();
    const tagList = userTags.map((r) => r.tag);

    if (tagList.length === 0) return [];

    return this.db('auto_tags')
      .where({ content_type: contentType })
      .whereIn('tag', tagList)
      .select('content_id')
      .distinct()
      .whereNotIn('content_id', contentIds)
      .limit(limit);
  }

  private interactionScore(interaction: string): number {
    switch (interaction) {
      case 'view': return 1;
      case 'like': return 3;
      case 'comment': return 4;
      case 'share': return 5;
      default: return 1;
    }
  }
}
