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
  /** Custom claims from user metadata (attached at sign-in). */
  meta?: Record<string, unknown>;
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
  | 'ilike'
  | 'in'
  | 'is'
  | 'contains';

export interface QueryFilter {
  column: string;
  op?: FilterOp; // default: 'eq'
  value: unknown;
}

export interface QueryOrder {
  column: string;
  direction?: 'asc' | 'desc'; // default: 'asc'
}

/**
 * Attach related rows from another table (explicit join — the query
 * spells out the keys, no schema introspection magic).
 */
export interface QueryInclude {
  /** Remote table to pull rows from. */
  table: string;
  /** Column on the parent rows carrying the join value. */
  localKey: string;
  /** Column on the remote table to match against. */
  foreignKey: string;
  /** Field name to attach the related rows under. */
  as: string;
  /** Remote columns to fetch (default: all). */
  select?: string[];
}

export interface QueryRequest {
  select?: string[];
  filters?: QueryFilter[];
  /** OR-groups: each group is AND-ed internally, groups are OR-ed together. */
  or?: QueryFilter[][];
  orderBy?: QueryOrder[];
  limit?: number;
  offset?: number;
  /** Related rows to attach via `include`. */
  include?: QueryInclude[];
  /** Return the total number of matching rows (ignores limit/offset). */
  countTotal?: boolean;
  /**
   * Return the planner's assessment of this query (cost + plan summary)
   * alongside the rows, instead of running it blind.
   */
  explain?: boolean;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  count: number;
  /** Present when `countTotal` was requested. */
  total?: number;
  /** Present when `explain` was requested. */
  explain?: QueryExplain;
}

/** A storage bucket namespace. Object keys are `<bucket>/<path>`. */
export interface Bucket {
  name: string;
  public: boolean;
  ownerId: string | null;
  createdAt: string;
}

/** A deployed server function (Vortex Functions). */
export interface VortexFunctionMeta {
  id: string;
  name: string;
  title: string;
  status: 'active' | 'paused';
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Result of a SQL console statement. */
export interface SqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
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

// ── Row policies (the Vortex Policy Engine) ────────────────────────────────
//
// Supabase's row policies call `auth.uid()` once per scanned row — their most
// documented performance footgun, which their own docs work around by telling
// you to hand-wrap it as `(select auth.uid())`. Forget that and your table
// crawls.
//
// Vortex policies compile to a single parameterized predicate instead: caller
// identity is resolved to a literal ONCE per query and bound as a parameter,
// so the planner sees a constant and can use an index. There is no per-row
// function call, and therefore no footgun to remember.

/** Values a policy can compare a column against, resolved once per query. */
export type PolicyValueRef =
  | 'user.id'
  | 'user.role'
  | 'user.email'
  | 'now'
  | `user.meta.${string}`;

/** A single column constraint inside a policy. */
export interface PolicyPredicate {
  /** Column on the target row. */
  column: string;
  /** Comparison operator (default `eq`). */
  op?: FilterOp;
  /** Literal value — mutually exclusive with `valueRef`. */
  value?: unknown;
  /** Identity reference, resolved to a literal once per query. */
  valueRef?: PolicyValueRef;
}

/** A boolean group of predicates. */
export interface PolicyPredicateGroup {
  and?: PolicyNode[];
  or?: PolicyNode[];
  not?: PolicyNode;
}

/** Any node in a policy expression tree. */
export type PolicyNode = PolicyPredicate | PolicyPredicateGroup;

/** A stored row policy. */
export interface VortexPolicy {
  id: string;
  name: string;
  tableName: string;
  action: PermissionAction;
  /** Roles this policy applies to. `['*']` matches every role. */
  roles: RoleName[];
  /** USING predicate — which existing rows the caller can see. */
  using: PolicyNode;
  /** WITH CHECK predicate — which new rows the caller may write. */
  withCheck?: PolicyNode | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Caller identity available to policy compilation. */
export interface PolicyIdentity {
  userId: string | null;
  role: RoleName;
  email: string | null;
  meta?: Record<string, unknown>;
}

/** A compiled policy — ready to bind into a SQL fragment. */
export interface CompiledPredicate {
  /**
   * SQL fragment: column identifiers are quoted inline (strictly validated),
   * every value is a `?` placeholder.
   */
  sql: string;
  /** Bound values only — every identity ref already resolved to a literal. */
  bindings: unknown[];
}

// ── Query governance ───────────────────────────────────────────────────────
//
// Supabase will happily run an accidental full-table scan into the ground and
// bill you for it. Vortex measures every query the planner sees and can
// refuse to execute one past a cost ceiling you set.

/** Planner output for a governed query. */
export interface QueryPlan {
  /** Planner cost estimate (Postgres `Total Cost`). */
  cost: number | null;
  /** Human-readable plan summary. */
  summary: string[];
}

/** Explain metadata returned when a query asks for it. */
export interface QueryExplain {
  plan: QueryPlan;
  /** The SQL Vortex generated for the query. */
  sql: string;
  /** Bind values applied to that SQL. */
  bindings: unknown[];
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

// ── OAuth providers (v0.8) ───────────────────────────────────────────────

/** Built-in OAuth provider definitions. */
export interface OAuthProviderDef {
  name: string;
  displayName: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string;
}

/** OAuth provider as configured by an admin. */
export interface OAuthProvider {
  id: string;
  name: string;
  displayName: string;
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  scopes: string;
  extra: Record<string, unknown> | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Linked OAuth account for a Vortex user. */
export interface OAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  providerEmail: string | null;
  profile: Record<string, unknown> | null;
  linkedAt: string;
}

/** Result of an OAuth login/callback. */
export interface OAuthLoginResult {
  session: AuthSession;
  isNewUser: boolean;
  linkedProvider: string;
}

// ── Cron / Scheduled Jobs ───────────────────────────────────────────────

export interface CronJob {
  id: string;
  name: string;
  functionName: string | null;
  cronExpression: string;
  payload: Record<string, unknown> | null;
  status: 'enabled' | 'disabled';
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CronJobCreate {
  name: string;
  functionName?: string | null;
  cronExpression: string;
  payload?: Record<string, unknown> | null;
}

export interface CronJobUpdate {
  functionName?: string | null;
  cronExpression?: string;
  payload?: Record<string, unknown> | null;
  status?: 'enabled' | 'disabled';
}

export interface CronRun {
  id: string;
  jobId: string;
  functionName: string | null;
  status: 'pending' | 'success' | 'error' | 'timeout';
  errorMessage: string | null;
  result: Record<string, unknown> | null;
  durationMs: number | null;
  startedAt: string;
  completedAt: string | null;
}

// ── Full-text Search ───────────────────────────────────────────────────

export interface FulltextIndex {
  id: string;
  tableName: string;
  name: string;
  columns: string[];
  language: string;
  indexName: string;
  createdAt: string;
}

export interface FulltextSearchResult {
  id: string;
  rank: number;
  row: Record<string, unknown>;
}
