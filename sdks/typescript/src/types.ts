/** Shared type definitions for the Vortex TypeScript SDK. */

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  metadata?: Record<string, unknown>;
}

export interface AuthSession {
  token: string;
  expiresIn: number;
  user: AuthUser;
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

export interface QueryFilter {
  column: string;
  op?: string;
  value?: unknown;
}

export interface QueryRequest {
  filters: QueryFilter[];
  countTotal?: boolean;
  select?: string[];
  limit?: number;
  offset?: number;
  orderBy?: Array<{ column: string; direction: string }>;
}

export interface QueryResult {
  rows: unknown[];
  count: number;
  total?: number;
}

export interface BillingPlan {
  name: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
}

export interface BillingTransaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  plan: string;
  createdAt: string;
}

export interface BillingSubscription {
  plan: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface StorageObject {
  bucket: string;
  path: string;
  size: number;
  contentType: string;
  updatedAt: string;
}

export interface Bucket {
  id: string;
  name: string;
  isPublic: boolean;
  createdAt: string;
}

export interface VortexFunction {
  name: string;
  description: string;
  language: string;
  size: number;
  createdAt: string;
}

export interface VortexApp {
  id: string;
  name: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface VortexPolicy {
  table: string;
  policy: Record<string, unknown>;
}

export interface TableEvent {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  rows: unknown[];
}

export interface PresencePeer {
  id: string;
  metadata: Record<string, unknown>;
}

export interface OAuthProvider {
  id: string;
  name: string;
  type: string;
}

export interface OAuthAccount {
  provider: string;
  userId: string;
  email: string;
}

export interface NotificationDevice {
  token: string;
  platform: string;
  pushService?: string;
}

export interface Notification {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
