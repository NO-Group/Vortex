/**
 * Vortex Core — Shared types for the Vortex BaaS engine.
 */

// ── Authentication ───────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'developer' | 'viewer';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  iat?: number;
  exp?: number;
}

// ── Database ────────────────────────────────────────────────────────────────

export type QueryOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'in';

export interface QueryFilter {
  column: string;
  op: QueryOperator;
  value: unknown;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  count: number;
  /** For paginated results */
  total?: number;
}

export interface MutationActor {
  userId: string;
  role: UserRole;
  /** Optional app/tenant scope for multi-tenant isolation */
  appId?: string | null;
}

// ── Storage ────────────────────────────────────────────────────────────────

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  ownerId: string | null;
  /** App/tenant this object belongs to */
  appId?: string | null;
  createdAt: string;
}

export interface StorageObjectMeta extends StorageObject {
  etag?: string;
}

export interface PresignedUrl {
  url: string;
  expiresAt: string;
  expiresIn: number;
  method: 'PUT' | 'GET' | 'POST';
}

// ── Realtime ────────────────────────────────────────────────────────────────

export type RealtimeEventType = 'insert' | 'update' | 'delete' | 'presence';

export interface RealtimeEvent {
  type: RealtimeEventType;
  table: string;
  row: Record<string, unknown> | null;
  actorId?: string;
  timestamp: number;
}

export interface RealtimeSubscription {
  table: string;
  filters?: QueryFilter[];
}

// ── API ─────────────────────────────────────────────────────────────────────

export interface ApiErrorBody {
  error: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessBody<T = unknown> {
  data: T;
}
