import type { Knex } from 'knex';
import type { CronJob, CronJobCreate, CronJobUpdate, CronRun } from '@vortex/core';
import { ApiError } from '../errors.js';
import { CronExpressionParser } from 'cron-parser';

interface CronJobRow {
  id: string;
  user_id: string;
  name: string;
  function_name: string | null;
  cron_expression: string;
  payload: Record<string, unknown> | null;
  status: string;
  last_run_at: Date | null;
  next_run_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type { CronJobRow };

interface CronRunRow {
  id: string;
  job_id: string;
  function_name: string | null;
  status: string;
  error_message: string | null;
  result: Record<string, unknown> | null;
  duration_ms: number | null;
  started_at: Date;
  completed_at: Date | null;
}

function toJob(row: CronJobRow): CronJob {
  return {
    id: row.id,
    name: row.name,
    functionName: row.function_name,
    cronExpression: row.cron_expression,
    payload: row.payload,
    status: row.status as 'enabled' | 'disabled',
    lastRunAt: row.last_run_at?.toISOString() ?? null,
    nextRunAt: row.next_run_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toRun(row: CronRunRow): CronRun {
  return {
    id: row.id,
    jobId: row.job_id,
    functionName: row.function_name,
    status: row.status as CronRun['status'],
    errorMessage: row.error_message,
    result: row.result,
    durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
    startedAt: row.started_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  };
}

const CRON_NAME = /^[a-z0-9][a-z0-9-]{1,38}$/;

/** Validate a cron expression and return the next run time after `from`. */
export function validateCronExpression(expr: string, from: Date = new Date()): Date {
  try {
    const interval = CronExpressionParser.parse(expr);
    return interval.next().toDate();
  } catch {
    throw ApiError.badRequest(
      `Invalid cron expression: "${expr}". Use standard 5-field format: "min hour day month weekday"`,
    );
  }
}

function validateJobName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!CRON_NAME.test(trimmed)) {
    throw ApiError.badRequest(
      'Job name must be 2-39 chars of lowercase letters, digits, and dashes',
    );
  }
  return trimmed;
}

/** Cron job registry — CRUD + execution history. */
export class CronService {
  constructor(private readonly db: Knex) {}

  async create(userId: string, input: CronJobCreate): Promise<CronJob> {
    const name = validateJobName(input.name);

    // Validate cron expression early.
    const nextRun = validateCronExpression(input.cronExpression);

    const existing = await this.db<CronJobRow>('vortex_cron_jobs')
      .where({ user_id: userId, name })
      .first();
    if (existing) throw ApiError.conflict(`Cron job "${name}" already exists`);

    const [row] = await this.db<CronJobRow>('vortex_cron_jobs')
      .insert({
        user_id: userId,
        name,
        function_name: input.functionName ?? null,
        cron_expression: input.cronExpression,
        payload: input.payload ?? null,
        status: 'enabled',
        next_run_at: nextRun,
      })
      .returning('*');
    return toJob(row!);
  }

  async list(userId: string, isAdmin: boolean): Promise<CronJob[]> {
    const query = this.db<CronJobRow>('vortex_cron_jobs').orderBy('created_at', 'desc');
    if (!isAdmin) query.where({ user_id: userId });
    return (await query).map(toJob);
  }

  async get(name: string, userId: string, isAdmin: boolean): Promise<CronJob> {
    const row = await this.requireOwned(name, userId, isAdmin);
    return toJob(row);
  }

  async requireOwned(name: string, userId: string, isAdmin: boolean): Promise<CronJobRow> {
    const row = await this.db<CronJobRow>('vortex_cron_jobs')
      .where({ name })
      .first();
    if (!row) throw ApiError.notFound(`Cron job "${name}" not found`);
    if (!isAdmin && row.user_id !== userId) {
      throw ApiError.forbidden('You do not own this cron job');
    }
    return row;
  }

  async update(
    name: string,
    userId: string,
    isAdmin: boolean,
    patch: CronJobUpdate,
  ): Promise<CronJob> {
    const row = await this.requireOwned(name, userId, isAdmin);
    const updates: Record<string, unknown> = { updated_at: new Date() };

    if (patch.functionName !== undefined) {
      updates.function_name = patch.functionName;
    }
    if (patch.cronExpression !== undefined) {
      updates.cron_expression = patch.cronExpression;
      updates.next_run_at = validateCronExpression(patch.cronExpression);
    }
    if (patch.payload !== undefined) {
      updates.payload = patch.payload;
    }
    if (patch.status !== undefined) {
      updates.status = patch.status;
      if (patch.status === 'enabled') {
        updates.next_run_at = validateCronExpression(row.cron_expression);
      } else {
        updates.next_run_at = null;
      }
    }

    const [updated] = await this.db<CronJobRow>('vortex_cron_jobs')
      .where({ id: row.id })
      .update(updates)
      .returning('*');
    return toJob(updated!);
  }

  async remove(name: string, userId: string, isAdmin: boolean): Promise<void> {
    const row = await this.requireOwned(name, userId, isAdmin);
    await this.db('vortex_cron_jobs').where({ id: row.id }).del();
  }

  /** Get all enabled jobs due for execution before `deadline`. */
  async getDueJobs(deadline: Date): Promise<CronJobRow[]> {
    return this.db<CronJobRow>('vortex_cron_jobs')
      .where('status', 'enabled')
      .where('next_run_at', '<=', deadline)
      .orderBy('next_run_at', 'asc');
  }

  /** Mark a job as run and schedule its next occurrence. */
  async markRun(
    jobRow: CronJobRow,
    status: 'success' | 'error' | 'timeout',
    result: Record<string, unknown> | null,
    errorMessage: string | null,
    durationMs: number,
  ): Promise<void> {
    const now = new Date();
    const run = await this.db<CronRunRow>('vortex_cron_runs')
      .insert({
        job_id: jobRow.id,
        function_name: jobRow.function_name,
        status,
        error_message: errorMessage,
        result,
        duration_ms: durationMs,
        started_at: now,
        completed_at: now,
      })
      .returning('*');

    // Schedule the next run.
    let nextRun: Date | null = null;
    try {
      const interval = CronExpressionParser.parse(jobRow.cron_expression);
      nextRun = interval.next().toDate();
    } catch {
      // If the cron expression is now invalid, disable the job.
      await this.db('vortex_cron_jobs')
        .where({ id: jobRow.id })
        .update({ status: 'disabled', next_run_at: null });
      return;
    }

    await this.db('vortex_cron_jobs')
      .where({ id: jobRow.id })
      .update({ last_run_at: now, next_run_at: nextRun });

    void run; // run row captured for future inspection
  }

  /** List execution history for a job. */
  async listRuns(
    jobName: string,
    userId: string,
    isAdmin: boolean,
    limit = 50,
  ): Promise<CronRun[]> {
    const job = await this.requireOwned(jobName, userId, isAdmin);
    const rows = await this.db<CronRunRow>('vortex_cron_runs')
      .where({ job_id: job.id })
      .orderBy('started_at', 'desc')
      .limit(Math.min(limit, 200));
    return rows.map(toRun);
  }
}
