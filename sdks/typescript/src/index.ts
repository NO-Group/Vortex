/**
 * @nogroup/vortex — TypeScript/JavaScript SDK for Vortex BaaS
 *
 * Works in Node.js, browsers, and edge runtimes.
 *
 * ```ts
 * import { VortexClient } from '@nogroup/vortex';
 *
 * const vortex = new VortexClient({ url: 'https://your-vortex.example.com' });
 * const session = await vortex.auth.signup({ email, password });
 * await vortex.database.insert('notes', [{ title: 'Hello' }]);
 * ```
 */

export { VortexClient } from './client.js';
export { Auth } from './auth.js';
export { Database, QueryBuilder } from './database.js';
export { Realtime } from './realtime.js';
export { Storage } from './storage.js';
export { Functions } from './functions.js';
export { Apps } from './apps.js';
export { Billing } from './billing.js';
export { Admin } from './admin.js';
export { VCaptcha } from './vcaptcha.js';
export { VortexApiError, HttpClient } from './http.js';

export type {
  AuthSession, AuthUser, SignupInput, LoginInput,
  QueryRequest, QueryResult, QueryFilter,
  BillingPlan, BillingTransaction, BillingSubscription,
  StorageObject, Bucket,
  VortexFunction, VortexApp, VortexPolicy,
  TableEvent, PresencePeer,
  OAuthProvider, OAuthAccount,
  NotificationDevice, Notification,
  VCaptchaMode, VCaptchaChallenge, VCaptchaSolution,
  VCaptchaVerifyResult, VCaptchaConfig, VCaptchaStats,
} from './types.js';
