import type { HttpClient } from './http.js';
import type { CronJob, CronJobCreate, CronJobUpdate, CronRun } from './types.js';

/**
 * Vortex Cron — autonomous scheduled jobs for Vortex Functions.
 *
 * ```ts
 * // Create a scheduled job that runs a function every hour
 * await vortex.cron.createJob({
 *   name: 'hourly-cleanup',
 *   functionName: 'cleanup-task',
 *   cronExpression: '0 * * * *',
 *   payload: { limit: 100 },
 * });
 *
 * // List all jobs
 * const { jobs } = await vortex.cron.listJobs();
 *
 * // Manually trigger a job
 * const { result } = await vortex.cron.trigger('hourly-cleanup');
 *
 * // View execution history
 * const { runs } = await vortex.cron.listRuns('hourly-cleanup');
 * ```
 */
export class Cron {
  constructor(private readonly http: HttpClient) {}

  /** Create a new scheduled job. */
  async createJob(input: CronJobCreate): Promise<CronJob> {
    const { job } = await this.http.request<{ job: CronJob }>(
      '/v1/cron/jobs',
      { method: 'POST', body: input },
    );
    return job;
  }

  /** List all scheduled jobs. */
  async listJobs(): Promise<CronJob[]> {
    const { jobs } = await this.http.request<{ jobs: CronJob[] }>(
      '/v1/cron/jobs',
    );
    return jobs;
  }

  /** Get a single scheduled job by name. */
  async getJob(name: string): Promise<CronJob> {
    const { job } = await this.http.request<{ job: CronJob }>(
      `/v1/cron/jobs/${name}`,
    );
    return job;
  }

  /** Update a scheduled job (expression, payload, status). */
  async updateJob(name: string, input: CronJobUpdate): Promise<CronJob> {
    const { job } = await this.http.request<{ job: CronJob }>(
      `/v1/cron/jobs/${name}`,
      { method: 'PUT', body: input },
    );
    return job;
  }

  /** Delete a scheduled job and its run history. */
  async deleteJob(name: string): Promise<void> {
    await this.http.request(`/v1/cron/jobs/${name}`, { method: 'DELETE' });
  }

  /** Manually trigger a job immediately. Returns the execution result. */
  async trigger(name: string, payload?: Record<string, unknown>): Promise<{
    job: CronJob;
    result: Record<string, unknown> | null;
  }> {
    const { job, result } = await this.http.request<{
      job: CronJob;
      result: Record<string, unknown> | null;
    }>(
      `/v1/cron/jobs/${name}/trigger`,
      { method: 'POST', body: payload ? { payload } : {} },
    );
    return { job, result };
  }

  /** List execution history for a job. */
  async listRuns(name: string, limit = 50): Promise<CronRun[]> {
    const { runs } = await this.http.request<{ runs: CronRun[] }>(
      `/v1/cron/jobs/${name}/runs?limit=${limit}`,
    );
    return runs;
  }

  /** Get scheduler status (running, tick count). */
  async schedulerStatus(): Promise<{ running: boolean; tickCount: number }> {
    return this.http.request<{ running: boolean; tickCount: number }>(
      '/v1/cron/scheduler',
    );
  }
}
