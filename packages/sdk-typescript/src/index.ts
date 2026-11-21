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
export { Webhooks } from './webhooks.js';
export { Audit } from './audit.js';
export { ApiKeys } from './apikeys.js';
export { Flags } from './flags.js';
export { Vector } from './vector.js';
export { Cron } from './cron.js';
export { Search } from './search.js';
export { QrCode } from './qrcode.js';
export { Biometric } from './biometric.js';
export { ChunkedUpload } from './chunked-upload.js';
export { Transformations } from './transformations.js';
export { Shield } from './shield.js';
export { Sessions } from './sessions.js';
export { PasswordSecurity } from './password-security.js';
export { SecurityScore } from './security-score.js';
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
  OAuthProvider, OAuthAccount, OAuthLoginResult,
  NotificationDevice, Notification,
  Webhook, WebhookLogEntry,
  AuditEntry, AuditStats,
  ApiKey, ApiKeyCreateResult,
  TwoFactorChallenge, TwoFactorSetupResult,
  FeatureFlag, FlagEvaluation,
  VectorCollection, VectorItem, VectorSearchResult,
  CustomDomain, DnsInstructions,
  CronJob, CronJobCreate, CronJobUpdate, CronRun,
  FulltextIndex, FulltextSearchResult,
  QrCodeSession,
  BiometricAttestation, BiometricChallenge, BiometricKind,
  ChunkedUploadInit, ChunkedUploadStatus, BulkDeleteResult,
  MediaTransformation, TransformOperation,
  ShieldAttestation, AttestationType, ThrottleStatus,
  UserSession,
  PasswordSecurityStatus, PasswordValidationResult, PasswordHistoryEntry,
  SecurityCheck, SecurityPostureScore, SecurityScoreEntry, EncryptionInfo,
  StorageProviderType, StorageObjectMetadata, PresignedUrlResult,
  MultipartPart,
  MultipartUploadInit, RenderParams, TransformResult, StorageEngineHealth,
} from './types.js';

export type { FilterOp } from './types.js';
