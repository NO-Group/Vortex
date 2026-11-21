/** Vortex Functions — server functions executed by the engine. */

export interface VortexFunctionRow {
  id: string;
  name: string;
  title: string;
  source: string;
  status: 'active' | 'paused';
  owner_id: string | null;
  created_at: Date;
  updated_at: Date;
}

const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/;

/** Engine route families that function names must not shadow. */
export const RESERVED_FUNCTION_NAMES = new Set([
  'v1',
  'apps',
  'functions',
  'api',
  'healthz',
  'auth',
  'db',
  'storage',
  'realtime',
  'sql',
]);

/** Validate a function name (URL slug). Throws ApiError-able Error. */
export function validateFunctionName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  if (!NAME_PATTERN.test(trimmed)) {
    throw new Error(
      'Function name must be 1-30 chars of lowercase letters, digits, and dashes (no leading/trailing dash)',
    );
  }
  if (RESERVED_FUNCTION_NAMES.has(trimmed)) {
    throw new Error(`"${trimmed}" is a reserved function name`);
  }
  return trimmed;
}

/** The request shape a function handler receives. */
export interface FunctionRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: unknown;
  /** Verified caller, when a JWT was presented. */
  user: { sub: string; role: string; email?: string; meta?: Record<string, unknown> } | null;
}

/** What a function handler may return. */
export type FunctionResult =
  | void
  | null
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[]
  | {
      status?: number;
      headers?: Record<string, string>;
      body?: unknown;
    };
