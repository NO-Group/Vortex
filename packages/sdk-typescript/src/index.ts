/**
 * @vortex/client — TypeScript/JavaScript SDK for Vortex BaaS.
 *
 * One import, the whole platform:
 *
 * ```ts
 * import { VortexClient } from '@vortex/client';
 *
 * const vortex = new VortexClient({ url: 'https://your-vortex.example.com' });
 * const session = await vortex.auth.signup({ email, password });
 * await vortex.database.from('notes').filter('owner_id', 'eq', session.user.id).execute();
 * ```
 */

export { VortexClient } from './client.js';
export { Auth } from './auth.js';
export { Database, QueryBuilder } from './database.js';
export { Realtime } from './realtime.js';
export { Storage, type ImageTransforms } from './storage.js';
export { Functions } from './functions.js';
export { Apps } from './apps.js';
export { Admin } from './admin.js';
export { HttpClient, VortexApiError } from './http.js';

export type {
  AuthSession, AuthUser, SignupInput, LoginInput, MagicLinkResult,
  QueryRequest, QueryResult, QueryFilter, QueryOrder, QueryInclude,
  QueryPlan, QueryExplain,
  Bucket, PresignUploadResponse, PresignDownloadResponse, StorageObject,
  VortexFunction, VortexApp, VortexPolicy, PolicyNode, PolicyPreview,
  SqlResult, QueryLogEntry, InsightsOverview,
  TableEvent, PresencePeer, TableChangeHandler, PresenceHandler,
  BroadcastHandler, ReplayHandler, StatusHandler,
} from './types.js';

export type { FilterOp } from './types.js';
