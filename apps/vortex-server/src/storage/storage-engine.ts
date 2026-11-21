import type { IVortexStorageDriver, DriverConfig } from './driver.interface.js';
import { createStorageDriver } from './storage.factory.js';

/**
 * Storage Engine — manages primary and fallback drivers with automatic
 * failover. If the primary provider returns repeated 5xx errors or
 * connection timeouts (>3000ms), the engine logs a high-severity alert
 * and fails gracefully without crashing the Node.js event loop.
 */
export class StorageEngine {
  private readonly primary: IVortexStorageDriver;
  private readonly fallback?: IVortexStorageDriver;
  private primaryFailures = 0;
  private readonly maxFailures = 3;
  private readonly timeoutMs = 3000;

  constructor(
    primaryConfig: DriverConfig,
    fallbackConfig?: DriverConfig,
  ) {
    this.primary = createStorageDriver(primaryConfig);
    this.fallback = fallbackConfig ? createStorageDriver(fallbackConfig) : undefined;
  }

  /** Get the active driver (primary if healthy, fallback if primary is failing). */
  get activeDriver(): IVortexStorageDriver {
    if (this.primaryFailures >= this.maxFailures && this.fallback) {
      return this.fallback;
    }
    return this.primary;
  }

  /** Get the primary driver (for status/health checks). */
  get primaryDriver(): IVortexStorageDriver {
    return this.primary;
  }

  /** Get the fallback driver (if configured). */
  get fallbackDriver(): IVortexStorageDriver | undefined {
    return this.fallback;
  }

  /** Record a successful operation (resets failure counter). */
  recordSuccess(): void {
    this.primaryFailures = 0;
  }

  /** Record a failure. Returns true if fallback should be used. */
  recordFailure(): boolean {
    this.primaryFailures++;
    if (this.primaryFailures >= this.maxFailures && this.fallback) {
      console.error(
        `[vortex] CRITICAL: Primary storage driver (${this.primary.name}) has failed ${this.primaryFailures} times. Switching to fallback (${this.fallback.name}).`,
      );
      return true;
    }
    return false;
  }

  /**
   * Execute an operation with automatic fallback.
   * Tries primary first; on repeated failure, switches to fallback.
   */
  async execute<T>(
    operation: (driver: IVortexStorageDriver) => Promise<T>,
  ): Promise<T> {
    try {
      const result = await this.withTimeout(operation(this.primary), this.timeoutMs);
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();

      if (this.fallback) {
        try {
          console.warn(
            `[vortex] Retrying with fallback storage driver (${this.fallback.name})...`,
          );
          return await this.withTimeout(operation(this.fallback), this.timeoutMs);
        } catch (fallbackErr) {
          console.error(
            `[vortex] Both primary and fallback storage drivers failed:`,
            err instanceof Error ? err.message : String(err),
            '|',
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
          );
          throw err;
        }
      }

      throw err;
    }
  }

  /** Wrap a promise with a timeout to prevent hanging requests. */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Storage operation timed out after ${ms}ms`));
      }, ms);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }

  /** Get engine health status. */
  getHealth(): {
    primary: string;
    primaryHealthy: boolean;
    fallback: string | null;
    fallbackHealthy: boolean;
    active: string;
  } {
    return {
      primary: this.primary.name,
      primaryHealthy: this.primaryFailures < this.maxFailures,
      fallback: this.fallback?.name ?? null,
      fallbackHealthy: !!this.fallback,
      active: this.activeDriver.name,
    };
  }
}
