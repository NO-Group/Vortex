import { HttpClient } from './http.js';
import { Auth } from './auth.js';
import { Database } from './database.js';
import { Realtime } from './realtime.js';
import { Storage } from './storage.js';
import { Functions } from './functions.js';
import { Apps } from './apps.js';
import { Billing } from './billing.js';
import { Admin } from './admin.js';
import { VCaptcha } from './vcaptcha.js';

export interface VortexClientOptions {
  url: string;
  token?: string;
  timeout?: number;
}

export class VortexClient {
  readonly http: HttpClient;
  readonly auth: Auth;
  readonly database: Database;
  readonly storage: Storage;
  readonly functions: Functions;
  readonly apps: Apps;
  readonly billing: Billing;
  readonly admin: Admin;
  readonly vcaptcha: VCaptcha;

  private rt: Realtime | null = null;

  constructor(opts: VortexClientOptions) {
    this.http = new HttpClient(opts.url, { token: opts.token, timeout: opts.timeout });
    this.auth = new Auth(this.http);
    this.database = new Database(this.http);
    this.storage = new Storage(this.http, opts.url);
    this.functions = new Functions(this.http, opts.url);
    this.apps = new Apps(this.http);
    this.billing = new Billing(this.http);
    this.admin = new Admin(this.http);
    this.vcaptcha = new VCaptcha(this.http);
  }

  connectRealtime(
    token: string,
    handlers?: {
      onTableChange?: (event: unknown) => void;
      onPresence?: (info: unknown) => void;
      onBroadcast?: (frame: unknown) => void;
      onReplay?: (info: unknown) => void;
    },
  ): Realtime {
    const rt = this.realtime(handlers);
    rt.connect(token);
    return rt;
  }

  realtime(handlers?: {
    onTableChange?: (event: unknown) => void;
    onPresence?: (info: unknown) => void;
    onBroadcast?: (frame: unknown) => void;
    onReplay?: (info: unknown) => void;
  }): Realtime {
    if (this.rt) return this.rt;
    const base = this.http['baseUrl'].replace(/^https?:\/\//, '');
    const rt = new Realtime(base, handlers);
    this.rt = rt;
    const token = this.http.getToken();
    if (token) rt.connect(token);
    return rt;
  }
}
