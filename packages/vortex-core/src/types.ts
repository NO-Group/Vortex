/**
 * Shared domain types for the Vortex platform (server, dashboard, SDKs).
 */

/** Role names understood by the RBAC layer. `admin` bypasses row scoping. */
export type RoleName = 'admin' | 'user' | (string & {});

/** Permission actions on a table. */
export type PermissionAction = 'select' | 'insert' | 'update' | 'delete';

/** JWT claims carried by Vortex access tokens. */
export interface JwtClaims {
  /** Subject — the user id. */
  sub: string;
  email: string;
  role: RoleName;
  /** Token issuer (default `vortex`). */
  iss: string;
  /** Issued-at (seconds). */
  iat: number;
  /** Expiry (seconds). */
  exp: number;
}

/** Authenticated user as seen by request handlers. */
export interface AuthUser {
  id: string;
  email: string;
  role: RoleName;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface SignupInput {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/** Comparison operators supported by the dynamic query engine. */
export type FilterOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'in'
  | 'is';

export interface QueryFilter {
  column: string;
  op?: FilterOp; // default: 'eq'
  value: unknown;
}

export interface QueryOrder {
  column: string;
  direction?: 'asc' | 'desc'; // default: 'asc'
}

export interface QueryRequest {
  select?: string[];
  filters?: QueryFilter[];
  orderBy?: QueryOrder[];
  limit?: number;
  offset?: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  count: number;
}

/** A row-level RBAC grant for a role on a table. */
export interface TablePermission {
  role: RoleName;
  tableName: string;
  canSelect: boolean;
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  /**
   * When set, select/update/delete are scoped to rows where this column equals
   * the caller's user id (unless the caller is an admin).
   */
  ownerColumn: string | null;
}

/** Storage object metadata persisted in the `storage_objects` table. */
export interface StorageObjectMeta {
  id: string;
  key: string;
  size: number;
  contentType: string;
  ownerId: string | null;
  createdAt: string;
}

export interface PresignUploadRequest {
  key: string;
  contentType?: string;
  /** URL lifetime in seconds (default 900, max 3600). */
  expiresIn?: number;
}

export interface PresignUploadResponse {
  key: string;
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface PresignDownloadResponse {
  key: string;
  method: 'GET';
  url: string;
  expiresAt: string;
}

/** Standard error envelope for all Vortex HTTP APIs. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
