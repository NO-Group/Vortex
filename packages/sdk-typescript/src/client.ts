import { HttpClient } from './http.js';
import { Auth } from './auth.js';
import { Database } from './database.js';
import { Realtime } from './realtime.js';
import { Storage } from './storage.js';
import { Functions } from './functions.js';
import { Apps } from './apps.js';
import { Admin } from './admin.js';
import { Webhooks } from './webhooks.js';
import { Audit } from './audit.js';
import { ApiKeys } from './apikeys.js';
import { Flags } from './flags.js';
import { Vector } from './vector.js';
import { Cron } from './cron.js';
import { Search } from './search.js';
import { QrCode } from './qrcode.js';
import { Biometric } from './biometric.js';
import { ChunkedUpload } from './chunked-upload.js';
import { Transformations } from './transformations.js';
import { Shield } from './shield.js';
import type {
  AuthSession, LoginInput, SignupInput, TwoFactorChallenge,
  TableChangeHandler, PresenceHandler, BroadcastHandler, ReplayHandler, StatusHandler,
} from './types.js';

export interface VortexClientOptions {
  /**
   * Base URL of your Vortex engine. In browser, defaults to the current origin.
   * In Node.js, you must provide it explicitly.
   */
  url?: string;
  /** Pre-existing JWT token (optional — you can also sign in later). */
  token?: string;
  /** Request timeout in ms (default: 30000). */
  timeout?: number;
}

/**
 * VortexClient — the one entry point for the entire platform.
 *
 * ```ts
 * import { VortexClient } from '@vortex/client';
 *
 * const vortex = new VortexClient({ url: 'https://vortex.example.com' });
 *
 * // Auth
 * const session = await vortex.auth.signup({ email, password });
 *
 * // Database
 * const notes = await vortex.database.from('notes')
 *   .filter('owner_id', 'eq', session.user.id)
 *   .limit(10)
 *   .execute();
 *
 * // Realtime
 * vortex.realtime.connect(session.token);
 * vortex.realtime.subscribe('table:notes');
 * vortex.realtime.onTableChange((event) => {
 *   console.log(event.action, event.rows);
 * });
 *
 * // Storage
 * await vortex.storage.upload('uploads', file, 'avatar.png');
 *
 * // Functions
 * const result = await vortex.functions.invoke('hello', { name: 'world' });
 * ```
 */
export class VortexClient {
  readonly http: HttpClient;
  readonly auth: Auth;
  readonly database: Database;
  readonly storage: Storage;
  readonly functions: Functions;
  readonly apps: Apps;
  readonly admin: Admin;
  readonly webhooks: Webhooks;
  readonly audit: Audit;
  readonly apiKeys: ApiKeys;
  readonly flags: Flags;
  readonly vector: Vector;
  readonly cron: Cron;
  readonly search: Search;
  readonly qrCode: QrCode;
  readonly biometric: Biometric;
  readonly chunkedUpload: ChunkedUpload;
  readonly transformations: Transformations;
  readonly shield: Shield;

  private rt: Realtime | null = null;

  constructor(options: VortexClientOptions = {}) {
    const url = options.url ?? (typeof location !== 'undefined' ? location.origin : undefined);

    if (!url) {
      throw new Error(
        'VortexClient requires a `url` option. In Node.js, pass `url: "https://your-vortex.example.com"`.',
      );
    }

    this.http = new HttpClient(url, {
      baseUrl: url,
      token: options.token ?? null,
      timeout: options.timeout,
    });

    this.auth = new Auth(this.http);
    this.database = new Database(this.http);
    this.storage = new Storage(this.http, url);
    this.functions = new Functions(this.http, url);
    this.apps = new Apps(this.http, url);
    this.admin = new Admin(this.http);
    this.webhooks = new Webhooks(this.http);
    this.audit = new Audit(this.http);
    this.apiKeys = new ApiKeys(this.http);
    this.flags = new Flags(this.http);
    this.vector = new Vector(this.http);
    this.cron = new Cron(this.http);
    this.search = new Search(this.http);
    this.qrCode = new QrCode(this.http);
    this.biometric = new Biometric(this.http);
    this.chunkedUpload = new ChunkedUpload(this.http);
    this.transformations = new Transformations(this.http);
    this.shield = new Shield(this.http);
  }

  /**
   * Get or create a realtime connection. Pass handlers to register
   * callbacks. If already connected, returns the existing instance.
   */
  realtime(handlers?: {
    onTableChange?: TableChangeHandler;
    onPresence?: PresenceHandler;
    onBroadcast?: BroadcastHandler;
    onReplay?: ReplayHandler;
    onStatus?: StatusHandler;
  }): Realtime {
    if (this.rt) return this.rt;

    const base = this.http.baseUrl.replace(/^https?:\/\//, '');
    const rt = new Realtime(base, handlers);
    this.rt = rt;

    const token = this.http.getToken();
    if (token) rt.connect(token);

    return rt;
  }

  /** Connect realtime with a specific token. */
  connectRealtime(
    token: string,
    handlers?: {
      onTableChange?: TableChangeHandler;
      onPresence?: PresenceHandler;
      onBroadcast?: BroadcastHandler;
      onReplay?: ReplayHandler;
      onStatus?: StatusHandler;
    },
  ): Realtime {
    const rt = this.realtime(handlers);
    rt.connect(token);
    return rt;
  }

  /** Sign in and update the token on all clients. */
  async signIn(input: LoginInput | SignupInput): Promise<AuthSession | TwoFactorChallenge> {
    const isSignup = !('password' in input) || !input.email;
    // Distinguish by which method to call
    if ('email' in input && 'password' in input && !('metadata' in input)) {
      const session = await this.auth.login({ email: input.email, password: input.password });
      return session;
    }
    if ('email' in input && 'password' in input && 'metadata' in input) {
      return this.auth.signup(input as SignupInput);
    }
    throw new Error('Unsupported sign-in input');
  }

  /** Sign out — clears the token. */
  signOut(): void {
    this.auth.signOut();
    if (this.rt) {
      this.rt.disconnect();
      this.rt = null;
    }
  }
}
