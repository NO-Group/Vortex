import type { AppContext } from '../context.js';
import { CronService } from './cron.service.js';
import { FunctionsService } from '../functions/functions.service.js';
import { QueryService } from '../db/query.service.js';
import { RbacService } from '../db/rbac.js';
import {
  compileFunction,
  runFunction,
  FunctionTimeoutError,
  FunctionCompileError,
  type FnSandboxGlobals,
} from '../functions/runtime.js';
import type { FunctionRequest } from '../functions/functions.types.js';
import type { CronJobRow } from './cron.service.js';

const TICK_INTERVAL_MS = 60_000; // 60-second tick
const FUNCTION_TIMEOUT_MS = 30_000; // 30s per scheduled run

/**
 * Cron Scheduler — the autonomous tick loop.
 *
 * Every 60 seconds, checks all enabled jobs whose `next_run_at` has passed.
 * For each due job:
 *   1. Fetch the linked Vortex Function source
 *   2. Compile + execute it in the VM sandbox with the job's payload
 *   3. Record the result (success / error / timeout) in vortex_cron_runs
 *   4. Schedule the next run via the cron expression
 *
 * Jobs with a null function_name are skipped (scheduled SQL is a future
 * capability — the scheduler currently requires a linked function).
 *
 * The scheduler starts when `start()` is called and stops on `stop()`.
 * It's designed to be resilient — a failed job never crashes the loop.
 */
export class CronScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private _tickCount = 0;

  constructor(private readonly ctx: AppContext) {}

  /** Start the tick loop. Safe to call multiple times — no-op if already running. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_INTERVAL_MS);

    // Run an immediate tick so newly-created jobs with imminent next_run_at
    // get picked up without waiting up to 60s.
    void this.tick();

    // eslint-disable-next-line no-console
    console.log(`[vortex] cron scheduler started (tick every ${TICK_INTERVAL_MS / 1000}s)`);
  }

  /** Stop the tick loop. Safe to call when not running. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    // eslint-disable-next-line no-console
    console.log('[vortex] cron scheduler stopped');
  }

  get isRunning(): boolean {
    return this.running;
  }

  get tickCount(): number {
    return this._tickCount;
  }

  /** One tick: find due jobs and execute them. */
  async tick(): Promise<void> {
    this._tickCount++;
    const now = new Date();
    const cron = new CronService(this.ctx.db);

    let dueJobs: CronJobRow[];
    try {
      dueJobs = await cron.getDueJobs(now);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[vortex] cron: failed to fetch due jobs:', err);
      return;
    }

    for (const job of dueJobs) {
      await this.executeJobRow(job);
    }
  }

  /**
   * Trigger a specific job by name. Used by the manual-trigger API endpoint.
   * Returns the execution result.
   */
  async triggerJob(jobName: string, payloadOverride?: Record<string, unknown>): Promise<{
    status: 'success' | 'error' | 'timeout';
    result: Record<string, unknown> | null;
    errorMessage: string | null;
    durationMs: number;
  }> {
    const cron = new CronService(this.ctx.db);
    const job = await cron.requireOwned(jobName, 'system', true);
    return this.executeJobRow(job, payloadOverride);
  }

  /** Execute a single job row. Core logic shared by tick and trigger. */
  private async executeJobRow(
    job: CronJobRow,
    payloadOverride?: Record<string, unknown>,
  ): Promise<{
    status: 'success' | 'error' | 'timeout';
    result: Record<string, unknown> | null;
    errorMessage: string | null;
    durationMs: number;
  }> {
    const startedAt = Date.now();
    const cron = new CronService(this.ctx.db);

    if (!job.function_name) {
      await cron.markRun(job, 'error', null, 'No function linked to this cron job', 0);
      return { status: 'error', result: null, errorMessage: 'No function linked', durationMs: 0 };
    }

    const functions = new FunctionsService(this.ctx.db);
    const fnRow = await functions.getForInvoke(job.function_name);
    if (!fnRow) {
      await cron.markRun(job, 'error', null, `Function "${job.function_name}" not found`, 0);
      return {
        status: 'error',
        result: null,
        errorMessage: `Function "${job.function_name}" not found`,
        durationMs: 0,
      };
    }

    let handler;
    try {
      handler = compileFunction(fnRow.source);
    } catch (err) {
      const msg = err instanceof FunctionCompileError ? err.message : (err as Error).message;
      await cron.markRun(job, 'error', null, `Compile error: ${msg}`, 0);
      return { status: 'error', result: null, errorMessage: msg, durationMs: 0 };
    }

    const queryService = new QueryService(this.ctx.db, new RbacService(this.ctx.db), this.ctx.bus);
    const fnRequest: FunctionRequest = {
      method: 'SCHEDULED',
      path: `/cron/${job.name}`,
      query: {},
      headers: { 'content-type': 'application/json', 'x-vortex-cron': job.name },
      body: payloadOverride ?? job.payload ?? null,
      user: null,
    };

    const sandboxGlobals: FnSandboxGlobals = {
      data: {
        query: (table, q = {}) => queryService.select({ userId: 'system', role: 'admin' }, table, q as never),
        insert: (table, rows) => queryService.insert({ userId: 'system', role: 'admin' }, table, rows),
        update: (table, patch, filters = []) =>
          queryService.update({ userId: 'system', role: 'admin' }, table, patch, filters as never),
        delete: (table, filters) => queryService.delete({ userId: 'system', role: 'admin' }, table, filters as never),
      },
      storage: {
        get: async (key) => {
          const object = await this.ctx.storage.get(key);
          return { size: object.size, contentType: object.contentType, body: object.body.toString('base64') };
        },
        put: async (key, body, contentType = 'text/plain') => {
          const result = await this.ctx.storage.put({
            key,
            body: Buffer.from(body, 'utf8'),
            contentType,
          });
          return { key: result.key, size: result.size };
        },
        list: async (prefix = '') => {
          const keys = await this.ctx.storage.list(prefix, 1000);
          return keys.map((key) => ({ key }));
        },
      },
      env: {},
    };

    try {
      const outcome = await runFunction(handler, fnRequest, sandboxGlobals, FUNCTION_TIMEOUT_MS);
      const durationMs = Date.now() - startedAt;

      let result: Record<string, unknown> | null = null;
      if (outcome.body.length > 0) {
        try {
          result = JSON.parse(outcome.body.toString('utf8')) as Record<string, unknown>;
        } catch {
          result = { body: outcome.body.toString('utf8').slice(0, 2000) };
        }
      }

      await cron.markRun(job, 'success', result, null, durationMs);
      return { status: 'success', result, errorMessage: null, durationMs };
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      const isTimeout = err instanceof FunctionTimeoutError;
      const status = isTimeout ? 'timeout' : 'error';
      const message = (err as Error).message;
      await cron.markRun(job, status, null, message, durationMs);
      return { status, result: null, errorMessage: message, durationMs };
    }
  }
}
