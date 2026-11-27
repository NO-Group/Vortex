import type { Knex } from 'knex';

export type MediaOperation = 'thumbnail' | 'transcode' | 'extract_audio' | 'compress' | 'resize' | 'watermark';

/**
 * MediaService — Media processing pipeline.
 * Handles image/video/audio processing jobs (thumbnails, transcoding, compression).
 * Actual media processing is delegated to worker processes; this manages job lifecycle.
 */
export class MediaService {
  constructor(private readonly db: Knex) {}

  async createJob(
    type: 'image' | 'video' | 'audio',
    operation: MediaOperation,
    sourceUrl: string,
    options: Record<string, unknown> = {},
    ownerId?: string,
  ) {
    const [id] = await this.db('media_jobs').insert({
      media_type: type,
      operation,
      source_url: sourceUrl,
      options,
      owner_id: ownerId ?? null,
      status: 'queued',
    });
    return { id };
  }

  async getJob(id: string) {
    return this.db('media_jobs').where({ id }).first();
  }

  async list(status?: string, limit = 50) {
    const q = this.db('media_jobs').orderBy('created_at', 'desc').limit(limit);
    if (status) q.where({ status });
    return q;
  }

  async markRunning(id: string) {
    await this.db('media_jobs').where({ id }).update({
      status: 'running',
      started_at: this.db.fn.now(),
    });
  }

  async markCompleted(id: string, result: Record<string, unknown>) {
    await this.db('media_jobs').where({ id }).update({
      status: 'completed',
      result,
      completed_at: this.db.fn.now(),
    });
  }

  async markFailed(id: string, error: string) {
    await this.db('media_jobs').where({ id }).update({
      status: 'failed',
      error,
      completed_at: this.db.fn.now(),
    });
  }

  async delete(id: string): Promise<number> {
    return this.db('media_jobs').where({ id }).del();
  }

  async stats() {
    const rows = await this.db('media_jobs').select('operation', 'status').count({ count: '*' }).groupBy('operation, status');
    const map: Record<string, Record<string, number>> = {};
    for (const row of rows as Array<{ operation: string; status: string; count: string }>) {
      if (!map[row.operation]) map[row.operation] = {};
      map[row.operation]![row.status] = Number(row.count);
    }
    return map;
  }
}
