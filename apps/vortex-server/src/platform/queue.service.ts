import type { Knex } from 'knex';

export interface Job {
  id: string;
  queue_name: string;
  job_type: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'delayed';
  priority: number;
  attempts: number;
  max_attempts: number;
  run_after: Date | null;
  error: string | null;
}

/**
 * QueueService — Job queues with priorities, retries, and dead-letter queues.
 * Background workers process jobs from the queue, retry on failure,
 * and move exhausted jobs to the DLQ.
 */
export class QueueService {
  constructor(private readonly db: Knex) {}

  async enqueue(
    jobType: string,
    payload: Record<string, unknown>,
    opts: { queue?: string; priority?: number; maxAttempts?: number; runAfter?: Date } = {},
  ): Promise<{ id: string }> {
    const [id] = await this.db('job_queue').insert({
      queue_name: opts.queue ?? 'default',
      job_type: jobType,
      payload,
      status: opts.runAfter ? 'delayed' : 'queued',
      priority: opts.priority ?? 0,
      max_attempts: opts.maxAttempts ?? 3,
      run_after: opts.runAfter ?? null,
    });
    return { id: String(id) };
  }

  /** Get the next job to process from a queue. */
  async dequeue(queueName = 'default'): Promise<Job | null> {
    const db = this.db;
    const job = await db('job_queue')
      .where({ queue_name: queueName, status: 'queued' })
      .orWhere(function() {
        this.where({ queue_name: queueName, status: 'delayed' })
          .where('run_after', '<=', db.fn.now());
      })
      .orderBy('priority', 'desc')
      .orderBy('created_at', 'asc')
      .first();

    if (!job) return null;

    // Lock the job
    await this.db('job_queue').where({ id: job.id }).update({
      status: 'running',
      locked_by: 'worker',
      locked_at: this.db.fn.now(),
    });

    return job;
  }

  /** Mark a job as completed. */
  async complete(jobId: string): Promise<void> {
    await this.db('job_queue').where({ id: jobId }).update({
      status: 'completed',
      completed_at: this.db.fn.now(),
      locked_by: null,
      locked_at: null,
    });
  }

  /** Mark a job as failed. Retries if attempts remain, otherwise DLQ. */
  async fail(jobId: string, error: string): Promise<'retry' | 'dlq'> {
    const job = await this.db('job_queue').where({ id: jobId }).first();
    if (!job) return 'dlq';

    const newAttempts = job.attempts + 1;

    if (newAttempts < job.max_attempts) {
      await this.db('job_queue').where({ id: jobId }).update({
        attempts: newAttempts,
        status: 'queued',
        error,
        locked_by: null,
        locked_at: null,
      });
      return 'retry';
    }

    // Move to dead-letter queue
    await this.db('dead_letter_queue').insert({
      queue_name: job.queue_name,
      job_type: job.job_type,
      payload: job.payload,
      error,
      attempts: newAttempts,
      original_id: job.id,
    });
    await this.db('job_queue').where({ id: jobId }).update({
      status: 'failed',
      error,
      locked_by: null,
      locked_at: null,
    });
    return 'dlq';
  }

  async list(queueName?: string, status?: string, limit = 50) {
    const q = this.db('job_queue').orderBy('created_at', 'desc').limit(limit);
    if (queueName) q.where({ queue_name: queueName });
    if (status) q.where({ status });
    return q;
  }

  async listDLQ(limit = 50) {
    return this.db('dead_letter_queue').orderBy('failed_at', 'desc').limit(limit);
  }

  /** Requeue a job from the DLQ. */
  async requeueDLQ(dlqId: string): Promise<void> {
    const dlqJob = await this.db('dead_letter_queue').where({ id: dlqId }).first();
    if (!dlqJob) return;

    await this.db('job_queue').insert({
      queue_name: dlqJob.queue_name,
      job_type: dlqJob.job_type,
      payload: dlqJob.payload,
      status: 'queued',
      priority: 0,
      attempts: dlqJob.attempts,
      max_attempts: dlqJob.attempts + 1,
    });
    await this.db('dead_letter_queue').where({ id: dlqId }).del();
  }

  async stats(queueName = 'default') {
    const rows = await this.db('job_queue')
      .select('status')
      .count({ count: '*' })
      .where({ queue_name: queueName })
      .groupBy('status');
    const map: Record<string, number> = {};
    for (const row of rows as Array<{ status: string; count: string }>) {
      map[row.status] = Number(row.count);
    }
    return { queued: map['queued'] ?? 0, running: map['running'] ?? 0, completed: map['completed'] ?? 0, failed: map['failed'] ?? 0, delayed: map['delayed'] ?? 0 };
  }
}
