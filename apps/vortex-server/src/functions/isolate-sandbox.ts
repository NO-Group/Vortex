/**
 * IsolateSandbox — secure execution environment for Vortex Functions.
 *
 * Uses `isolated-vm` (true V8 isolate with separate heap, separate GC,
 * and hard memory limits). This is the ONLY supported execution path.
 * The `node:vm` fallback has been REMOVED because `node:vm` is not a
 * security boundary — it can be escaped with prototype pollution.
 *
 * The sandbox exposes a curated API surface to the function code:
 *   fetch (firewalled), crypto, TextEncoder, TextDecoder, URL,
 *   setTimeout/clearTimeout, queueMicrotask, console (captured)
 *
 * NO access to: process, require, module, global, Buffer, etc.
 *
 * Service context (data.query, storage.get, etc.) is exposed via
 * cross-isolate proxy objects that forward calls back to the main thread.
 */

import { createRequire } from 'node:module';
import type { FnSandboxGlobals } from './runtime.js';
import { createFirewalledFetch, EgressFirewallError } from './egress-firewall.js';
import type { FunctionRequest } from './functions.types.js';

// --- isolated-vm (required, loaded at startup) ---

type IVM = any;
let ivmModule: IVM | null = null;

function loadIVM(): IVM {
  if (ivmModule) return ivmModule;
  try {
    const require = createRequire(import.meta.url);
    const mod = require('isolated-vm') as IVM;
    const lib = mod.createIsolate ? mod : (mod.lib ?? mod.default ?? mod);
    if (!lib || typeof lib.createIsolate !== 'function') {
      throw new Error('isolated-vm createIsolate not found');
    }
    ivmModule = lib as IVM;
    return ivmModule;
  } catch (err) {
    throw new Error(`isolated-vm is required for function sandboxing: ${(err as Error).message}`);
  }
}

// --- Sandbox error types ---

export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxError';
  }
}

export class SandboxMemoryLimitError extends Error {
  constructor(limitBytes: number) {
    super(`Function exceeded memory limit of ${(limitBytes / 1024 / 1024).toFixed(1)} MB`);
    this.name = 'SandboxMemoryLimitError';
  }
}

export class SandboxUnavailableError extends Error {
  constructor() {
    super('Function sandbox is not available — isolated-vm must be installed');
    this.name = 'SandboxUnavailableError';
  }
}

// --- Configuration ---

export interface SandboxConfig {
  /** Maximum wall-clock execution time in milliseconds. */
  timeoutMs: number;
  /** Maximum memory usage in bytes. */
  maxHeapSize?: number;
  /** Whether to enable egress firewall on fetch. Default true. */
  firewall?: boolean;
}

export const DEFAULT_SANDBOX_CONFIG: SandboxConfig = {
  timeoutMs: 5_000,
  maxHeapSize: 64 * 1024 * 1024, // 64 MB
  firewall: true,
};

// --- IsolateSandbox ---

export interface SandboxResult {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  logs: string[];
}

export class IsolateSandbox {
  private captured: string[] = [];
  private config: SandboxConfig;

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config };
  }

  /**
   * Compile and execute a function source in a true V8 isolate.
   * The isolate has its own heap, GC, and cannot access the main process.
   */
  async run(
    source: string,
    req: FunctionRequest,
    ctx: FnSandboxGlobals,
  ): Promise<SandboxResult> {
    this.captured = [];

    let ivm: IVM;
    try {
      ivm = loadIVM();
    } catch {
      throw new SandboxUnavailableError();
    }

    const isolate = await ivm.createIsolate({
      maxHeapSize: this.config.maxHeapSize ?? 64 * 1024 * 1024,
    });

    try {
      const context = await isolate.createContext();

      // --- Set up the sandbox globals ---
      // These are safe, pure JavaScript APIs with no Node.js access.

      const firewalledFetch = this.config.firewall
        ? createFirewalledFetch(globalThis.fetch)
        : globalThis.fetch;

      // Console — captured to array, never reaches real stdout
      await context.global.set('console', {
        log: (...args: unknown[]) => this.captured.push(args.map(String).join(' ')),
        warn: (...args: unknown[]) => this.captured.push(args.map(String).join(' ')),
        error: (...args: unknown[]) => this.captured.push(args.map(String).join(' ')),
      });

      await context.global.set('fetch', firewalledFetch);
      await context.global.set('crypto', globalThis.crypto);
      await context.global.set('TextEncoder', TextEncoder);
      await context.global.set('TextDecoder', TextDecoder);
      await context.global.set('URL', URL);
      await context.global.set('setTimeout', setTimeout);
      await context.global.set('clearTimeout', clearTimeout);
      await context.global.set('queueMicrotask', queueMicrotask);

      // --- Create the service context proxy ---
      // The service context contains async functions (data.query, storage.get, etc.)
      // that must be callable from inside the isolate. We create a proxy object
      // on the isolate side that forwards each call back to the main thread.

      // Build a plain object describing the service API — the isolate will
      // receive a proxy that calls back through isolated-vm's Reference API.
      const ctxForIsolate = {
        data: {
          query: ctx.data.query,
          insert: ctx.data.insert,
          update: ctx.data.update,
          delete: ctx.data.delete,
        },
        storage: {
          get: ctx.storage.get,
          put: ctx.storage.put,
          list: ctx.storage.list,
        },
        env: ctx.env,
      };

      // Use context.global.set to install the ctx proxy.
      // isolated-vm automatically creates a proxy for objects containing
      // functions — calling them from the isolate forwards to the main thread.
      await context.global.set('ctx', ctxForIsolate);

      // --- Compile and execute the function ---
      // The source is `async (req, ctx) => { ... }`.
      // We compile it, get a Reference, and call it with the timeout.

      const fnScript = await isolate.compileScript(
        `var __vortex_fn = (${source});`,
        { filename: 'vortex-function.js' },
      );
      await fnScript.run(context);

      // Get the function reference from the isolate
      const fnRef = await context.global.get('__vortex_fn');

      // Call the function with a wall-clock timeout
      // The `promise: true` option allows async functions to work —
      // isolated-vm will resolve the promise from the main thread.
      const reqForIsolate = req;

      let result: unknown;
      try {
        result = await fnRef.apply([reqForIsolate, ctxForIsolate], {
          promise: true,
          timeout: this.config.timeoutMs,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('timed out')) {
          throw new SandboxError(`Function timed out after ${this.config.timeoutMs}ms`);
        }
        if (msg.includes('Memory limit')) {
          throw new SandboxMemoryLimitError(this.config.maxHeapSize ?? 64 * 1024 * 1024);
        }
        throw new SandboxError(`Function execution error: ${msg}`);
      }

      // Normalize the result into an HTTP response
      return {
        status: this.resultStatus(result),
        headers: this.resultHeaders(result),
        body: this.resultBody(result),
        logs: this.captured,
      };
    } finally {
      await isolate.dispose();
    }
  }

  private resultStatus(result: unknown): number {
    if (result === undefined || result === null) return 204;
    if (typeof result === 'string') return 200;
    if (typeof result === 'number' || typeof result === 'boolean') return 200;
    if (typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      if ('status' in obj && typeof obj.status === 'number') return obj.status;
    }
    return 200;
  }

  private resultHeaders(result: unknown): Record<string, string> {
    if (result !== null && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries((obj.headers ?? {}) as Record<string, unknown>)) {
        headers[k.toLowerCase()] = String(v);
      }
      if (result === undefined || result === null) return headers;
      if (typeof result === 'string') {
        headers['content-type'] ??= 'text/plain; charset=utf-8';
        return headers;
      }
      if (typeof result === 'number' || typeof result === 'boolean') {
        headers['content-type'] ??= 'application/json';
        return headers;
      }
      const looksHttp = 'status' in obj || 'headers' in obj || 'body' in obj;
      if (!looksHttp) {
        headers['content-type'] ??= 'application/json';
      }
      return headers;
    }
    return { 'content-type': 'text/plain; charset=utf-8' };
  }

  private resultBody(result: unknown): Buffer {
    if (result === undefined || result === null) return Buffer.alloc(0);
    if (typeof result === 'string') return Buffer.from(result, 'utf8');
    if (typeof result === 'number' || typeof result === 'boolean') {
      return Buffer.from(JSON.stringify(result), 'utf8');
    }
    if (typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      const body = obj.body;
      if (body === undefined || body === null) return Buffer.alloc(0);
      if (typeof body === 'string') return Buffer.from(body, 'utf8');
      return Buffer.from(JSON.stringify(body), 'utf8');
    }
    return Buffer.from(String(result), 'utf8');
  }
}

/**
 * Check if isolated-vm is available.
 */
export async function isIsolatedVmAvailable(): Promise<boolean> {
  try {
    loadIVM();
    return true;
  } catch {
    return false;
  }
}
