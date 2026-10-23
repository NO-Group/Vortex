import { Script, createContext } from 'node:vm';
import type { FunctionRequest, FunctionResult } from './functions.types.js';

export interface FnSandboxGlobals {
  /** Service-level data helpers (admin-scoped). */
  data: {
    query: (table: string, req?: Record<string, unknown>) => Promise<unknown>;
    insert: (table: string, rows: Record<string, unknown>[]) => Promise<unknown>;
    update: (
      table: string,
      patch: Record<string, unknown>,
      filters?: Record<string, unknown>[],
    ) => Promise<unknown>;
    delete: (table: string, filters: Record<string, unknown>[]) => Promise<unknown>;
  };
  storage: {
    get: (key: string) => Promise<unknown>;
    put: (key: string, body: string, contentType?: string) => Promise<unknown>;
    list: (prefix?: string) => Promise<unknown>;
  };
  env: Record<string, string>;
}

export interface RunOutcome {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
}

export class FunctionTimeoutError extends Error {
  constructor(ms: number) {
    super(`Function timed out after ${ms}ms`);
    this.name = 'FunctionTimeoutError';
  }
}

export class FunctionCompileError extends Error {
  constructor(cause: string) {
    super(`Function failed to load: ${cause}`);
    this.name = 'FunctionCompileError';
  }
}

/**
 * Compile a function source (a function expression) into a callable.
 *
 * Contract: the source IS a JavaScript function expression, e.g.
 *   async (req, ctx) => ({ status: 200, body: { hello: 'world' } })
 */
export function compileFunction(source: string): (req: unknown, ctx: unknown) => unknown {
  if (source.length > 200_000) {
    throw new FunctionCompileError('source exceeds 200 KB');
  }

  const captured: string[] = [];
  const sandbox: Record<string, unknown> = {
    fetch, // network egress (engine policy may restrict hosts)
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    URL,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    console: {
      log: (...args: unknown[]) => captured.push(args.map(String).join(' ')),
      warn: (...args: unknown[]) => captured.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => captured.push(args.map(String).join(' ')),
    },
  };
  const context = createContext(sandbox);

  let handler: unknown;
  try {
    handler = new Script(`(${source})`, { filename: 'vortex-function.js' }).runInContext(context, {
      timeout: 1_000,
    });
  } catch (err) {
    throw new FunctionCompileError((err as Error).message);
  }

  if (typeof handler !== 'function') {
    throw new FunctionCompileError('source must evaluate to a function expression');
  }

  const fn = handler as (req: unknown, ctx: unknown) => unknown;
  (fn as { __logs?: string[] }).__logs = captured;
  return fn;
}

/** Normalize any handler return value into an HTTP response. */
export function toHttpResponse(result: unknown): RunOutcome {
  if (result === undefined || result === null) {
    return { status: 204, headers: {}, body: Buffer.alloc(0) };
  }

  if (typeof result === 'string') {
    return {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: Buffer.from(result, 'utf8'),
    };
  }

  if (typeof result === 'number' || typeof result === 'boolean') {
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify(result), 'utf8'),
    };
  }

  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    const looksHttp =
      'status' in obj || 'headers' in obj || 'body' in obj;

    if (looksHttp) {
      const status = typeof obj.status === 'number' ? obj.status : 200;
      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries((obj.headers ?? {}) as Record<string, unknown>)) {
        headers[k.toLowerCase()] = String(v);
      }
      const body = obj.body;
      if (body === undefined || body === null) {
        return { status, headers, body: Buffer.alloc(0) };
      }
      if (typeof body === 'string') {
        headers['content-type'] ??= 'text/plain; charset=utf-8';
        return { status, headers, body: Buffer.from(body, 'utf8') };
      }
      headers['content-type'] ??= 'application/json';
      return { status, headers, body: Buffer.from(JSON.stringify(body), 'utf8') };
    }

    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: Buffer.from(JSON.stringify(result), 'utf8'),
    };
  }

  return {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body: Buffer.from(String(result), 'utf8'),
  };
}

/**
 * Execute a compiled handler with a wall-clock budget.
 * (The compile step carries a vm timeout; async work is bounded here.)
 */
export async function runFunction(
  fn: (req: unknown, ctx: unknown) => unknown,
  req: FunctionRequest,
  ctx: FnSandboxGlobals,
  timeoutMs: number,
): Promise<RunOutcome> {
  const execution = Promise.resolve()
    .then(() => fn(req, ctx))
    .then((result) => toHttpResponse(result as FunctionResult));

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FunctionTimeoutError(timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([execution, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
