# Phase 4 Architecture Review — Beyond Gemini's Analysis

> Inspired by Gemini's assessment of Vortex as a conglomerate backend, but refined
> through direct codebase inspection. This document corrects inaccuracies, adds
> deeper architectural insight, and proposes concrete implementation paths.

---

## Executive Summary

Gemini's four pillars are directionally correct but need refinement. Two of the
four already exist in the codebase (one partially, one fully). The real gaps
are narrower and more nuanced than Gemini described.

| Pillar | Gemini's Priority | Reality | Refined Priority |
|--------|-------------------|---------|------------------|
| Multi-Tenant App Scoping | 🔥 Critical | Partially exists — `apps` table exists but no tenant binding in query compiler | 🔥 Critical |
| Resumable Chunked Storage | 📦 Low | **Already built** — `chunked-upload.service.ts` + Phase 3 `multipart.routes.ts` | ✅ Done |
| Secure Function Sandbox | 🔥 Critical | **Accurate** — `node:vm` is not a security boundary | 🔥 Critical |
| OIDC / SSO Identity Server | ⚡ Medium | **Accurate** — OAuth client exists, no provider | ⚡ High |

---

## 1. Matrix Multi-Tenancy — The Real Gap

### What Gemini Got Right

Vortex currently maps RLS policies to `owner_id` / `user_id` only. There is no
`tenant_id` column on core tables, and no tenant binding in the query compiler.
A query from BookNest could theoretically read N.O Workspace rows if the RLS
policy is misconfigured.

### What Gemini Missed

The `apps` table **already exists** (`migrations/20261023000003_apps.ts`) with
`id`, `name`, `owner_id`, and `app_files` with `app_id`. Custom domains are
also supported. The skeleton of multi-tenancy is already in place — what's
missing is the **binding layer** that connects a request to an app context.

### Improved Architecture

Instead of a flat `tenant_id` column on every table (which would require
touching every migration), use an **app-scoped query compiler** that:

1. **Extracts `app_id` from the request context** — via `X-App-ID` header,
   subdomain (`app.vortex.local`), or custom domain lookup.

2. **Injects it into the `AppContext`** as an immutable field:
   ```typescript
   interface AppContext {
     // ... existing fields
     app: { id: string; name: string; ownerId: string } | null;
   }
   ```

3. **Auto-appends `AND app_id = $app_bound`** in the `QueryService` compiler
   for tables that have an `app_id` column (`apps`, `app_files`,
   `chunked_uploads`, `storage_objects`).

4. **Uses PostgreSQL `SET LOCAL app.current_app`** for RLS policies, so
   policies can reference `current_setting('app.current_app')` instead of
   hardcoding app IDs.

5. **Falls back to `owner_id` scoping** when `app_id` is null (backward
   compat for single-tenant deployments).

### Implementation Plan

```
Phase 4.1:
  - Add app resolution middleware (header → subdomain → custom domain)
  - Add `app` field to AppContext
  - Update QueryService to auto-scope when app_id is present
  - Add app_id column to storage_objects, chunked_uploads
  - Update RLS policies to check app.current_app

Phase 4.2:
  - App isolation on storage: prefix keys with app_id
  - App isolation on functions: namespace by app
  - App-scoped API keys (each app gets its own key set)
```

---

## 2. Large Object Binary (LOB) — Already Done

### What Gemini Got Wrong

Gemini lists this as "📦 Low" priority and says it's "missing." **It is not
missing.** Two independent implementations exist:

1. **`chunked-upload.service.ts`** (Phase 1) — Full chunked upload service
   with:
   - `init()` — creates upload session with `upload_id`, `total_chunks`
   - `uploadChunk()` — accepts 5MB blocks, validates hashes, tracks progress
   - `complete()` — assembles local files or calls S3 `CompleteMultipartUpload`
   - `abort()` — cancels upload, cleans up temp files
   - `list()` — shows in-progress uploads for resumability
   - `cleanupOrphaned()` — removes abandoned uploads

2. **`multipart.routes.ts`** (Phase 3) — S3-native multipart abstraction with:
   - `POST /v1/storage/multipart/initiate`
   - `PUT /v1/storage/multipart/upload-part`
   - `POST /v1/storage/multipart/complete`
   - `POST /v1/storage/multipart/abort`
   - `POST /v1/storage/multipart/cleanup` (24h orphan cleanup)

3. **`chunked-upload.routes.ts`** — REST API exposing the chunked service with
   `init`, `chunk`, `complete`, `abort` endpoints.

**The LOB problem is solved.** What's missing is a **TUS protocol adapter** for
standards-based resumable uploads (the TUS specification), which would allow
Nextcloud and other TUS-compatible clients to use Vortex natively.

### Remaining Gap (Low Priority)

- TUS protocol support (`/v1/storage/tus/*`)
- Streaming assembly for very large files (>10GB) without loading into memory
- Content-type validation per chunk

---

## 3. Serverless Isolated Runtimes — The Real Security Bug

### What Gemini Got Right

This is the most accurate assessment. The current `runtime.ts` uses
`node:vm.createContext()` + `Script.runInContext()`, which is **not a security
boundary**. Key vulnerabilities:

1. **`fetch` is exposed** — malicious code can hit internal services
2. **`crypto`, `TextEncoder`, `URL` are exposed** — useful for obfuscation
3. **`setTimeout`/`setInterval` are exposed** — can be abused for
   resource exhaustion
4. **`console` is exposed** — log injection
5. **The VM context can access `process` via prototype pollution** —
   `node:vm` does NOT protect against `process` access through the global
   object's prototype chain
6. **`require` is not blocked** — if the script can access `process.mainModule`,
   it can load any module

### What Gemini Missed

The current runtime already has some protections Gemini didn't mention:

- **200KB source limit** — prevents DoS via giant scripts
- **1-second compile timeout** — prevents infinite loops during compilation
- **Executed function receives `(req, ctx)`** — the `ctx` is a curated
  service-level helper, not the raw process

But these are **not sufficient** for a security boundary.

### Improved Architecture

**Option A: `isolated-vm` (Recommended)**

Replace `node:vm` with `isolated-vm`, which provides true V8 isolates with:
- Separate heap (no shared objects)
- Explicit marshalling of data between host and isolate
- No access to `process`, `require`, or any host APIs
- Hard memory limits (`maxHeapSize`)
- Hard CPU limits via `timeout`

```typescript
import isolatedVM from 'isolated-vm';

const isolate = await isolatedVM.createIsolate({
  maxHeapSize: 64 * 1024 * 1024,  // 64MB
  maxExecutionTime: 5_000,        // 5s wall clock
});

const context = await isolate.createContext();
await context.global.set('fetch', undefined); // no network egress
await context.global.set('console', {
  log: (...args) => captured.push(args.map(String).join(' ')),
});

// Expose only curated service helpers via marshalled references
await context.global.set('ctx', {
  data: {
    query: async (table: string) => {
      // ... host-side DB call, results are marshalled back
    },
  },
});

const result = await isolate.compileScript(source).then(s =>
  s.run(context)
);
```

**Option B: Worker Threads with Message Passing**

For simpler deployments, spawn a Worker Thread with a minimal bootstrap that:
- Receives only serialized inputs
- Executes the function in a separate V8 isolate (worker threads have
  separate isolates)
- Returns only serialized outputs
- Has no shared memory or object references

**Option C: Container-level Isolation (Heavy)**

For maximum security (AI-generated code in Tungsten), run functions in
ephemeral containers via Docker/Firecracker. This is the most secure but
adds significant latency (~100ms+ per invocation).

### Recommendation

Use **Option A (`isolated-vm`)** as the default. It provides the right
security/performance tradeoff:
- True V8 isolate (separate heap, no prototype access)
- No `process`, `require`, or `global` leakage
- Explicit API surface (you control what's exposed)
- Sub-millisecond startup

Fall back to **Option B (Worker Threads)** if `isolated-vm` native
compilation is unavailable.

### Implementation Plan

```
Phase 4.3:
  - Install isolated-vm
  - Rewrite runtime.ts to use isolated-vm
  - Create IsolateSandbox class with explicit API surface
  - Add per-function memory/CPU limits
  - Add egress firewall (block internal IPs, localhost)
  - Add function quota (max invocations per user per hour)
  - Backward-compatible: falls back to node:vm if isolated-vm unavailable
```

---

## 4. Consolidated Identity & SSO — The Real Opportunity

### What Gemini Got Right

Vortex currently acts only as an **OAuth client** (connecting to Google,
Microsoft, Apple). There is no authorization code flow for external apps to
use Vortex as an identity provider.

### What Gemini Missed

The OAuth infrastructure is already partially in place:

- `oauth_providers` table with `client_id`, `client_secret`, `auth_url`,
  `token_url`, `userinfo_url`
- `oauth_accounts` table linking provider accounts to Vortex users
- `signToken()` with full JWT claims (`sub`, `email`, `role`, `iss`, `aud`)
- API key system with `api_keys` table

What's missing is the **authorization server** layer:

1. **Client registration** — external apps register with Vortex to get
   `client_id` / `client_secret`
2. **Authorization endpoint** — `GET /v1/auth/oauth/authorize` renders a
   consent screen, issues `code` on approval
3. **Token endpoint** — `POST /v1/auth/oauth/token` exchanges `code` for
   `access_token` (JWT) and `refresh_token`
4. **UserInfo endpoint** — `GET /v1/auth/oauth/userinfo` returns the
   authenticated user's profile (OIDC-compatible)
5. **JWKS endpoint** — `GET /v1/auth/oauth/jwks` publishes public keys for
   JWT verification by external apps
6. **Discovery endpoint** — `GET /v1/auth/oauth/.well-known/openid-configuration`
   for OIDC auto-discovery

### Improved Architecture

Build on the existing JWT infrastructure. The key insight: **Vortex already
issues JWTs with the right claims.** The OIDC provider is mostly a thin
protocol layer on top:

```
┌─────────────────────────────────────────────┐
│            Vortex OIDC Provider              │
│                                              │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │ Authorize    │   │ Token            │    │
│  │ Endpoint     │──▶│ Endpoint         │    │
│  │ (consent UI) │   │ (code→JWT swap)  │    │
│  └──────────────┘   └──────────────────┘    │
│         │                      │              │
│         ▼                      ▼              │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │ Redirect     │   │ JWKS             │    │
│  │ with code    │   │ (public keys)    │    │
│  └──────────────┘   └──────────────────┘    │
│                     ┌──────────────────┐    │
│                     │ UserInfo         │    │
│                     │ (profile data)   │    │
│                     └──────────────────┘    │
└─────────────────────────────────────────────┘
         │
         ▼
   ┌─────────────┐
   │  External   │
   │  App (e.g., │
   │  BookNest)  │
   └─────────────┘
```

### Implementation Plan

```
Phase 4.4:
  - Add oauth_clients table (client_id, client_secret, redirect_uris, scopes)
  - Add oauth_auth_codes table (code, client_id, user_id, expires_at)
  - Build Authorization endpoint with consent screen
  - Build Token endpoint (authorization_code + refresh_token grants)
  - Build UserInfo endpoint (OIDC-compatible)
  - Build JWKS endpoint (RSA key pair for signing)
  - Build OIDC discovery endpoint
  - Add scope management (openid, profile, email, offline_access)
  - Add "Sign in with N.O Group" button to login UI
```

---

## Priority Matrix (Corrected)

| Feature | Gemini's Priority | Corrected Priority | Why |
|---------|-------------------|-------------------|-----|
| Secure Function Sandbox | 🔥 Critical | 🔥 Critical | Real security vulnerability; `node:vm` is not isolation |
| Multi-Tenant App Scoping | 🔥 Critical | 🔥 Critical | `apps` table exists but no binding layer |
| OIDC / SSO Identity Server | ⚡ Medium | ⚡ High | Revenue-enabling; "Sign in with N.O Group" |
| TUS Protocol Adapter | 📦 Low | 📦 Low | Standards-based resumable uploads for Nextcloud |
| Chunked Upload | 📦 Low | ✅ Done | Already implemented (Phase 1 + Phase 3) |

---

## Recommended Phase 4 Build Order

1. **Phase 4.1: Multi-Tenant App Scoping** (2 weeks)
   - App resolution middleware
   - Query compiler auto-scoping
   - RLS policy updates
   - App-scoped storage keys

2. **Phase 4.3: Secure Function Sandbox** (1 week)
   - `isolated-vm` integration
   - API surface restriction
   - Egress firewall
   - Quota system

3. **Phase 4.4: OIDC / SSO Identity Server** (2 weeks)
   - Client registration
   - Authorization + Token endpoints
   - UserInfo + JWKS endpoints
   - OIDC discovery
   - "Sign in with N.O Group"

4. **Phase 4.2: TUS Protocol Adapter** (1 week)
   - TUS endpoint (`/v1/storage/tus/*`)
   - Nextcloud-compatible upload headers
   - Resumability via `Upload-Offset` header

---

## What Gemini's Analysis Got Wrong (Summary)

1. **Chunked upload is not missing** — Two implementations exist
   (`chunked-upload.service.ts` + `multipart.routes.ts`). Gemini's "📦 Low"
   priority is moot because the work is done.

2. **Multi-tenancy is partially built** — The `apps` table, `app_files`
   table, and custom domains exist. What's missing is the binding layer,
   not the data model.

3. **OAuth infrastructure is more mature than described** — The
   `oauth_providers` table, `oauth_accounts` table, and JWT signing are
   already in place. The OIDC provider is a protocol layer, not a from-scratch
   build.

4. **The Function runtime has some protections** — 200KB source limit,
   1s compile timeout, and curated `ctx` helpers. But `node:vm` is still
   not a security boundary, so the core concern stands.

---

## What Gemini's Analysis Got Right

1. **`node:vm` is not isolation** — This is the most accurate and critical
   finding. Tungsten's AI code generation makes this a real attack vector.

2. **Cross-app data leakage risk is real** — Without app scoping, a
   policy bug in one app can leak data to another.

3. **Vortex needs to be an identity provider** — "Sign in with N.O Group"
   is the correct strategic direction.

4. **The architectural vision is correct** — Vortex as the universal
   backbone for N.O Group requires these four pillars.

---

*This analysis was refined through direct codebase inspection. Gemini's
original assessment was directionally sound but missed existing
infrastructure. The corrections above ensure we build on what exists,
not what's assumed to be missing.*
