import type { Knex } from 'knex';
import { randomUUID } from 'node:crypto';

export interface TraceSpan {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  service: string;
  operation: string;
  start_time: Date;
  end_time: Date | null;
  duration_ms: number | null;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
}

/**
 * TracingService — Distributed tracing.
 * Records trace spans across services for observability and debugging.
 */
export class TracingService {
  constructor(private readonly db: Knex) {}

  /** Start a new trace with a root span. */
  async startTrace(service: string, operation: string, attributes: Record<string, unknown> = {}): Promise<TraceSpan> {
    const traceId = randomUUID();
    const spanId = randomUUID();
    const now = new Date();

    const span: TraceSpan = {
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: null,
      service,
      operation,
      start_time: now,
      end_time: null,
      duration_ms: null,
      status: 'ok',
      attributes,
    };

    await this.recordSpan(span);
    return span;
  }

  /** Record a child span under a parent. */
  async recordChildSpan(parentSpanId: string, traceId: string, service: string, operation: string, attributes: Record<string, unknown> = {}): Promise<TraceSpan> {
    const spanId = randomUUID();
    const now = new Date();

    const span: TraceSpan = {
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId,
      service,
      operation,
      start_time: now,
      end_time: null,
      duration_ms: null,
      status: 'ok',
      attributes,
    };

    await this.recordSpan(span);
    return span;
  }

  async recordSpan(span: TraceSpan): Promise<void> {
    await this.db('traces').insert({
      trace_id: span.trace_id,
      span_id: span.span_id,
      parent_span_id: span.parent_span_id,
      service: span.service,
      operation: span.operation,
      start_time: span.start_time,
      end_time: span.end_time,
      duration_ms: span.duration_ms,
      status: span.status,
      attributes: span.attributes,
    });
  }

  async endSpan(spanId: string, status: 'ok' | 'error' = 'ok', attributes: Record<string, unknown> = {}) {
    const start = await this.db('traces').where({ span_id: spanId }).first();
    if (!start) return;
    const end = new Date();
    const duration = Math.round((end.getTime() - new Date(start.start_time).getTime()));

    await this.db('traces').where({ span_id: spanId }).update({
      end_time: end,
      duration_ms: duration,
      status,
      attributes: this.db.raw('attributes || ?::jsonb', [attributes]),
    });
  }

  async getTrace(traceId: string) {
    return this.db('traces').where({ trace_id: traceId }).orderBy('start_time', 'asc');
  }

  async listTraces(opts: { service?: string; status?: string; limit?: number; from?: Date; to?: Date }) {
    const q = this.db('traces').orderBy('start_time', 'desc');
    if (opts.service) q.where({ service: opts.service });
    if (opts.status) q.where({ status: opts.status });
    if (opts.from) q.where('start_time', '>=', opts.from);
    if (opts.to) q.where('start_time', '<=', opts.to);
    if (opts.limit) q.limit(opts.limit);
    return q;
  }

  async stats() {
    const rows = await this.db('traces').select('service').count({ count: '*' }).groupBy('service');
    const errors = await this.db('traces').where({ status: 'error' }).count({ count: '*' }).first();
    const avgDur = await this.db('traces').avg('duration_ms').first();

    return {
      byService: (rows as Array<{ service: string; count: string }>).map((r) => ({ service: r.service, count: Number(r.count) })),
      errorCount: Number(errors?.count ?? 0),
      avgDurationMs: Math.round(Number(avgDur?.avg ?? 0)),
    };
  }
}
