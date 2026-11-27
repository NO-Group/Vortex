/**
 * Minimal Vortex BaaS HTTP client for the CLI.
 */
export class VortexClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = '';
  }

  setToken(token) {
    this.token = token;
  }

  async request(method, path, body) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined && body !== null) {
      headers['Content-Type'] = 'application/json';
    }
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const resp = await fetch(this.baseUrl + path, {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });

    const text = await resp.text();
    const data = text ? JSON.parse(text) : {};

    if (!resp.ok) {
      const err = data.error || {};
      throw new Error(`Vortex error ${err.code || resp.status}: ${err.message || resp.statusText}`);
    }
    return data;
  }

  auth() {
    return new AuthService(this);
  }

  database() {
    return new DatabaseService(this);
  }

  storage() {
    return new StorageService(this);
  }

  functions() {
    return new FunctionsService(this);
  }

  apps() {
    return new AppsService(this);
  }

  billing() {
    return new BillingService(this);
  }

  admin() {
    return new AdminService(this);
  }
}

class AuthService {
  constructor(client) { this.client = client; }

  async signup(email, password) {
    const session = await this.client.request('POST', '/v1/auth/signup', { email, password });
    this.client.setToken(session.token);
    return session;
  }

  async login(email, password) {
    const session = await this.client.request('POST', '/v1/auth/login', { email, password });
    this.client.setToken(session.token);
    return session;
  }

  async me() {
    return this.client.request('GET', '/v1/auth/me');
  }
}

class DatabaseService {
  constructor(client) { this.client = client; }

  from(table) {
    return new QueryBuilder(this.client, table);
  }

  async listTables() {
    return this.client.request('GET', '/v1/db/tables');
  }
}

class QueryBuilder {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.filters = [];
    this.orderBy = [];
    this.limit = null;
    this.offset = null;
    this.countTotal = false;
    this.select = null;
  }

  filter(column, op, value) {
    this.filters.push({ column, op, value });
    return this;
  }

  limit(n) { this.limit = n; return this; }
  offset(n) { this.offset = n; return this; }

  orderBy(column, direction = 'asc') {
    this.orderBy.push({ column, direction });
    return this;
  }

  countTotal() { this.countTotal = true; return this; }
  select(cols) { this.select = cols; return this; }

  async execute(extraBody = {}) {
    const body = { filters: this.filters, ...extraBody };
    if (this.countTotal) body.countTotal = true;
    if (this.select) body.select = this.select;
    if (this.limit !== null) body.limit = this.limit;
    if (this.offset !== null) body.offset = this.offset;
    if (this.orderBy.length) body.orderBy = this.orderBy;
    return this.client.request('POST', `/v1/db/${this.table}/query`, body);
  }
}

class StorageService {
  constructor(client) { this.client = client; }

  async listBuckets() {
    return this.client.request('GET', '/v1/storage/buckets');
  }

  async createBucket(name, isPublic = false) {
    return this.client.request('POST', '/v1/storage/buckets', { name, isPublic });
  }
}

class FunctionsService {
  constructor(client) { this.client = client; }

  async list() {
    return this.client.request('GET', '/v1/functions');
  }

  async invoke(name, data) {
    return this.client.request('POST', `/functions/${name}`, data);
  }

  async deploy(name, language, code, description = '') {
    return this.client.request('POST', '/v1/functions', { name, language, code, description });
  }
}

class AppsService {
  constructor(client) { this.client = client; }

  async list() {
    return this.client.request('GET', '/v1/apps');
  }
}

class BillingService {
  constructor(client) { this.client = client; }

  async status() {
    return this.client.request('GET', '/v1/billing/status');
  }

  async listPlans() {
    return this.client.request('GET', '/v1/billing/plans');
  }

  async checkout(planName, email, successUrl, cancelUrl) {
    const body = { planName, email };
    if (successUrl) body.successUrl = successUrl;
    if (cancelUrl) body.cancelUrl = cancelUrl;
    return this.client.request('POST', '/v1/billing/checkout', body);
  }
}

class AdminService {
  constructor(client) { this.client = client; }

  async sql(statement) {
    return this.client.request('POST', '/v1/sql', { sql: statement });
  }
}
