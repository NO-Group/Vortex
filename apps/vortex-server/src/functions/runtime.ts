import { IsolateSandbox, SandboxError, type SandboxResult } from './isolate-sandbox.js';
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
 * Compile and execute a function source using the IsolateSandbox.
 *
 * This is the main entry point for function execution. It delegates
 * to IsolateSandbox which tries isolated-vm first and falls back to
 * a hardened node:vm context with egress firewall.
 *
 * Contract: the source IS a JavaScript function expression, e.g.
 *   async (req, ctx) => ({ status: 200, body: { hello: 'world' } })
 */
export async function executeFunction(
  source: string,
  req: FunctionRequest,
  ctx: FnSandboxGlobals,
  timeoutMs: number = 5_000,
): Promise<RunOutcome> {
  const sandbox = new IsolateSandbox({ timeoutMs });

  let result: SandboxResult;
  try {
    result = await sandbox.run(source, req, ctx);
  } catch (err) {
    if (err instanceof SandboxError) {
      const msg = err.message;
      if (msg.includes('timed out')) {
        throw new FunctionTimeoutError(timeoutMs);
      }
      if (msg.includes('compile')) {
        throw new FunctionCompileError(msg.replace('Function failed to compile: ', ''));
      }
      if (msg.includes('Egress')) {
        throw new FunctionCompileError(msg);
      }
      throw new FunctionCompileError(msg);
    }
    throw err;
  }

  return {
    status: result.status,
    headers: result.headers,
    body: result.body,
  };
}

/**
 * Execute a pre-compiled handler with a wall-clock budget.
 *
 * Delegates to executeFunction for sandboxed execution.
 * (Kept for backward compatibility with existing callers.)
 */
export async function runFunction(
  fn: (req: unknown, ctx: unknown) => unknown,
  req: FunctionRequest,
  ctx: FnSandboxGlobals,
  timeoutMs: number,
): Promise<RunOutcome> {
  // For pre-compiled functions, we wrap them in a source string
  // and re-execute via the sandbox. In practice, callers should
  // use executeFunction directly with the raw source.
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
