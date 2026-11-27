import type { Knex } from 'knex';

/**
 * AnalyticsService — Application, database, API, and user analytics.
 * Records events, API usage metrics, and provides query capabilities.
 */
export class AnalyticsService {
  constructor(private readonly db: Knex) {}

  // ─── Event Tracking ──────────────────────────────────────────────

  async track(eventType: string, eventName: string, userId: string | null, metadata: Record<string, unknown>) {
    await this.db('analytics_events').insert({
      event_type: eventType,
      event_name: eventName,
      user_id: userId,
      metadata,
    });
  }

  async queryEvents(opts: {
    eventType?: string;
    eventName?: string;
    userId?: string;
    limit?: number;
    offset?: number;
    from?: Date;
    to?: Date;
  }) {
    const q = this.db('analytics_events').orderBy('created_at', 'desc');
    if (opts.eventType) q.where({ event_type: opts.eventType });
    if (opts.eventName) q.where({ event_name: opts.eventName });
    if (opts.userId) q.where({ user_id: opts.userId });
    if (opts.from) q.where('created_at', '>=', opts.from);
    if (opts.to) q.where('created_at', '<=', opts.to);
    if (opts.limit) q.limit(opts.limit);
    if (opts.offset) q.offset(opts.offset);
    return q;
  }

  async eventStats(eventType: string, since?: Date) {
    const q = this.db('analytics_events').where({ event_type: eventType });
    if (since) q.where('created_at', '>=', since);
    const rows = await q.select('event_name').count({ count: '*' }).groupBy('event_name');
    return (rows as Array<{ event_name: string; count: string }>).map((r) => ({ eventName: r.event_name, count: Number(r.count) }));
  }

  // ─── API Usage Metrics ───────────────────────────────────────────

  async recordApiCall(
    apiKeyId: string | null,
    method: string,
    endpoint: string,
    statusCode: number,
    durationMs: number,
  ) {
    await this.db('api_usage_metrics').insert({
      api_key_id: apiKeyId,
      method,
      endpoint,
      status_code: statusCode,
      duration_ms: durationMs,
    });
  }

  async apiUsageStats(apiKeyId?: string, since?: Date) {
    const q = this.db('api_usage_metrics');
    if (apiKeyId) q.where({ api_key_id: apiKeyId });
    if (since) q.where('created_at', '>=', since);

    const byMethod = await q.select('method').count({ count: '*' }).groupBy('method');
    const byEndpoint = await q.select('endpoint').count({ count: '*' }).groupBy('endpoint').orderBy('count', 'desc').limit(20);
    const errors = await q.whereBetween('status_code', [400, 599]).count({ count: '*' }).first();
    const avg = await q.avg('duration_ms').first();

    return {
      byMethod: (byMethod as Array<{ method: string; count: string }>).map((r) => ({ method: r.method, count: Number(r.count) })),
      topEndpoints: (byEndpoint as Array<{ endpoint: string; count: string }>).map((r) => ({ endpoint: r.endpoint, count: Number(r.count) })),
      errorCount: Number(errors?.count ?? 0),
      avgDurationMs: Math.round(Number(avg?.avg ?? 0)),
    };
  }

  // ─── Activity Aggregation ───────────────────────────────────────

  async userActivity(userId: string, since?: Date) {
    const q = this.db('analytics_events').where({ user_id: userId });
    if (since) q.where('created_at', '>=', since);
    const rows = await q.select('event_type').count({ count: '*' }).groupBy('event_type');
    return (rows as Array<{ event_type: string; count: string }>).map((r) => ({ eventType: r.event_type, count: Number(r.count) }));
  }
}
