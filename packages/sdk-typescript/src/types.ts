/**
 * Vortex Client SDK — shared types.
 *
 * All types mirror the server's wire format. The SDK is zero-dependency:
 * it uses `fetch` and `WebSocket`, both built into modern browsers and
 * Node.js 18+.
 */

/** Filter operators supported by the query engine. */
export type FilterOp =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'like' | 'ilike' | 'in' | 'is' | 'contains';

export interface QueryFilter {
  column: string;
  op?: FilterOp;
  value: unknown;
}

export interface QueryOrder {
  column: string;
  direction?: 'asc' | 'desc';
}

export interface QueryInclude {
  table: string;
  localKey: string;
  foreignKey: string;
  as: string;
  select?: string[];
}

export interface QueryRequest {
  select?: string[];
  filters?: QueryFilter[];
  or?: QueryFilter[][];
  orderBy?: QueryOrder[];
  limit?: number;
  offset?: number;
  include?: QueryInclude[];
  countTotal?: boolean;
  explain?: boolean;
}

export interface QueryPlan {
  cost: number | null;
  summary: string[];
}

export interface QueryExplain {
  plan: QueryPlan;
  sql: string;
  bindings: unknown[];
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  count: number;
  total?: number;
  explain?: QueryExplain;
}

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  token: string;
  expiresIn: number;
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

export interface MagicLinkResult {
  ok: boolean;
  delivery: 'email' | 'inline' | 'unconfigured';
  expiresAt: string;
  devToken?: string;
}

export interface Bucket {
  name: string;
  public: boolean;
  ownerId: string | null;
  createdAt: string;
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

export interface StorageObject {
  key: string;
  size: number;
  contentType: string;
  ownerId: string | null;
  createdAt: string;
}

export interface VortexFunction {
  id: string;
  name: string;
  title: string;
  status: 'active' | 'paused';
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VortexApp {
  name: string;
  title: string;
  ownerId: string;
  createdAt: string;
}

export interface TablePermission {
  role: string;
  tableName: string;
  canSelect: boolean;
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  ownerColumn: string | null;
}

export interface VortexPolicy {
  id: string;
  name: string;
  tableName: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  roles: string[];
  using: PolicyNode;
  withCheck: PolicyNode | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PolicyNode =
  | { column: string; op?: FilterOp; value?: unknown; valueRef?: string }
  | { and?: PolicyNode[]; or?: PolicyNode[]; not?: PolicyNode };

export interface PolicyPreview {
  table: string;
  action: string;
  role: string;
  matchedPolicies: number;
  using: { sql: string; bindings: unknown[] } | null;
  withCheck: { sql: string; bindings: unknown[] } | null;
  notes: string[];
  comparison?: {
    vortex: string | null;
    perRowEquivalent: string;
    whyItMatters: string;
  };
}

export interface SqlResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

export interface QueryLogEntry {
  id: string;
  table: string | null;
  action: string | null;
  sql: string | null;
  cost: number | null;
  durationMs: number;
  userId: string | null;
  outcome: string;
  createdAt: string;
}

export interface InsightsOverview {
  window: string;
  total: number;
  avgDurationMs: number;
  maxDurationMs: number;
  maxCost: number;
  rejected: number;
  ceiling: number | null;
  slowQueryMs: number;
}

/** Table change event from the realtime wire. */
export interface TableEvent {
  id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  rows: Record<string, unknown>[];
  actorId: string | null;
  timestamp: string;
  seq?: number;
  replay?: boolean;
}

export interface PresencePeer {
  clientId: string;
  userId: string | null;
  state: Record<string, unknown>;
}

/** Event handler for realtime table changes. */
export type TableChangeHandler = (event: TableEvent) => void;
/** Event handler for realtime presence changes. */
export type PresenceHandler = (info: {
  channel: string;
  kind: 'sync' | 'joins' | 'leaves';
  peers: PresencePeer[];
}) => void;
/** Event handler for realtime room broadcasts. */
export type BroadcastHandler = (frame: {
  channel: string;
  event: string;
  payload: unknown;
  from?: string;
}) => void;
/** Event handler for reconnect replay. */
export type ReplayHandler = (info: {
  channel: string;
  count: number;
  truncated: boolean;
  cursor: number;
}) => void;
/** Event handler for connection status changes. */
export type StatusHandler = (status: 'offline' | 'connecting' | 'online') => void;

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ── OAuth providers ─────────────────────────────────────────────────────

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

export interface OAuthAccount {
  id: string;
  userId: string;
  provider: string;
  providerUserId: string;
  providerEmail: string | null;
  profile: Record<string, unknown> | null;
  linkedAt: string;
}

export interface OAuthLoginResult {
  session: AuthSession;
  isNewUser: boolean;
  linkedProvider: string;
}

// ── Push Notifications ───────────────────────────────────────────────────

export interface NotificationDevice {
  id: string;
  platform: string;
  pushService: string;
  active: boolean;
  createdAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  status: string;
  createdAt: string;
  deliveredAt: string | null;
}

// ── Webhooks ────────────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  success_count: number;
  failure_count: number;
  last_delivered_at: string | null;
  created_at: string;
}

export interface WebhookLogEntry {
  id: string;
  event: string;
  payload: Record<string, unknown> | null;
  status: string;
  http_status: number | null;
  error: string | null;
  created_at: string;
}

// ── Audit Trail ──────────────────────────────────────────────────────────

export interface AuditEntry {
  id: string;
  user_id: string;
  role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditStats {
  totalActions: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  lastActive: string | null;
}

// ── API Keys ─────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  scopes: string[] | null;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  scopes: string[] | null;
  created_at: string;
}

// ── Two-Factor Authentication ──────────────────────────────────────────

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  tempToken: string;
}

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUrl: string;
  backupCodes: string[];
}
