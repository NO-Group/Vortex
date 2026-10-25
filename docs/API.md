# Vortex API Reference

Every endpoint under `/v1` is documented here. All endpoints require a
JWT bearer token in the `Authorization` header unless marked as public.

## Base URL

```
https://<your-vortex-url>/v1
```

## Authentication

All requests (except public ones) must include:

```
Authorization: Bearer <jwt>
```

Admin-only endpoints additionally require the `admin` role.

---

## Auth

### POST /v1/auth/signup

Register a new account. Returns a session with a JWT.

**Body:**
```json
{ "email": "user@example.com", "password": "secret123", "metadata": {} }
```

**Response (201):**
```json
{ "user": { "id": "...", "email": "...", "role": "user", "metadata": {}, "createdAt": "..." }, "token": "...", "expiresIn": 3600 }
```

### POST /v1/auth/login

Log in with email + password.

**Body:**
```json
{ "email": "user@example.com", "password": "secret123" }
```

**Response (200):** Same as signup.

### GET /v1/auth/me

Get the authenticated user's profile.

**Response (200):**
```json
{ "id": "...", "email": "...", "role": "user", "metadata": {}, "createdAt": "..." }
```

### POST /v1/auth/magic-link

Request a magic link for passwordless login.

**Body:**
```json
{ "email": "user@example.com" }
```

### POST /v1/auth/magic-link/verify

Verify a magic link token and receive a session.

**Body:**
```json
{ "token": "..." }
```

### POST /v1/auth/password-reset

Request a password reset link.

**Body:**
```json
{ "email": "user@example.com" }
```

### POST /v1/auth/password-reset/confirm

Set a new password using a reset token.

**Body:**
```json
{ "token": "...", "password": "newsecret123" }
```

### PATCH /v1/auth/profile

Update your own profile metadata.

**Body:**
```json
{ "metadata": { "displayName": "Alice", "avatar": "/me.png" } }
```

### POST /v1/auth/password

Change your password (verifies current password first).

**Body:**
```json
{ "currentPassword": "oldpass", "newPassword": "newpass123" }
```

### DELETE /v1/auth/account

Delete your own account. Irreversible.

### GET /v1/auth/users *(admin)*

List all accounts.

### PATCH /v1/auth/users/:id *(admin)*

Change a user's role or metadata.

**Body:**
```json
{ "role": "admin", "metadata": {} }
```

### DELETE /v1/auth/users/:id *(admin)*

Delete a user account.

---

## OAuth

### GET /v1/auth/oauth/providers

List available OAuth providers.

### GET /v1/auth/oauth/:provider/authorize

Get the OAuth authorize URL for a provider.

### POST /v1/auth/oauth/:provider/callback

Handle the OAuth callback. Returns a session.

### GET /v1/auth/oauth/accounts

List linked OAuth accounts.

### DELETE /v1/auth/oauth/accounts/:provider

Unlink an OAuth account.

---

## Database

### POST /v1/db/:table/query

Execute a query against a table.

**Body:**
```json
{
  "columns": ["id", "title"],
  "filters": [{ "column": "owner_id", "op": "eq", "value": "..." }],
  "order": [{ "column": "created_at", "direction": "desc" }],
  "limit": 20,
  "offset": 0
}
```

### POST /v1/db/:table

Insert rows into a table.

**Body:**
```json
{ "rows": [{ "title": "Hello", "owner_id": "..." }] }
```

### POST /v1/db/:table/upsert

Insert or update rows on conflict.

**Body:**
```json
{ "rows": [{ "id": "...", "title": "Updated" }], "conflictKeys": ["id"], "patch": { "title": "Updated" } }
```

### PATCH /v1/db/:table

Update rows matching filters.

**Body:**
```json
{ "patch": { "status": "done" }, "filters": [{ "column": "id", "op": "eq", "value": "..." }] }
```

### DELETE /v1/db/:table

Delete rows matching filters.

**Body:**
```json
{ "filters": [{ "column": "id", "op": "eq", "value": "..." }] }
```

### GET /v1/db/tables

List non-system table names.

### POST /v1/db/:table/create

Create a new table with custom columns.

**Body:**
```json
{ "columns": [{ "name": "title", "type": "text", "required": true }] }
```

### GET /v1/db/:table/schema

Get the column definitions for a table.

---

## Storage

### POST /v1/storage/buckets

Create a bucket.

**Body:**
```json
{ "name": "images", "public": false }
```

### GET /v1/storage/buckets

List all buckets.

### DELETE /v1/storage/buckets/:name

Delete a bucket.

### POST /v1/storage/upload?key=<path>

Upload an object. Body is the raw file bytes.

### GET /v1/storage/object?key=<path>

Download an object.

### DELETE /v1/storage/object

Delete an object.

**Body:**
```json
{ "key": "images/photo.jpg" }
```

### GET /v1/storage/list?bucket=<name>&prefix=<prefix>

List objects in a bucket.

### GET /v1/storage/stats

Get storage usage statistics.

**Response:**
```json
{ "totalObjects": 42, "totalSize": 1048576, "byBucket": { "images": { "count": 10, "size": 524288 } } }
```

### POST /v1/storage/presign-upload

Get a presigned upload URL for direct-to-storage uploads.

### POST /v1/storage/presign-download

Get a presigned download URL.

### GET /v1/storage/:bucket/:path

Access a public object (no auth required for public buckets).

**Query params:** `w`, `h`, `fit`, `fmt`, `quality`, `crop`, `grayscale`, `sepia`, `rotate`, `flipH`, `flipV`

---

## Realtime

### WS /v1/realtime?token=<jwt>

WebSocket connection for realtime subscriptions.

**Client → Server messages:**
```json
{ "type": "vortex:subscribe", "channel": "table:notes", "since": 0 }
{ "type": "vortex:unsubscribe", "channel": "table:notes" }
{ "type": "vortex:broadcast", "channel": "room:general", "event": "message", "payload": { "body": "Hello" } }
{ "type": "vortex:presence", "action": "track", "channel": "room:general", "state": { "name": "Alice" } }
{ "type": "vortex:presence", "action": "untrack", "channel": "room:general" }
```

**Server → Client messages:**
```json
{ "type": "vortex:welcome", "clientId": "..." }
{ "type": "vortex:event", "seq": 1, "table": "notes", "action": "INSERT", "rows": [...] }
{ "type": "vortex:replay", "channel": "table:notes", "count": 3, "cursor": 5, "truncated": false }
{ "type": "vortex:broadcast", "channel": "room:general", "event": "message", "payload": { "body": "Hello" } }
{ "type": "vortex:presence_sync", "channel": "room:general", "peers": [...] }
{ "type": "vortex:presence_diff", "channel": "room:general", "joins": [...], "leaves": [...] }
```

---

## Functions

### POST /v1/functions

Deploy a function.

**Body:**
```json
{ "name": "hello", "source": "export default async function(ctx) { return { status: 200, body: 'Hello' }; }", "title": "Hello Function" }
```

### GET /v1/functions

List your functions.

### GET /v1/functions/:name

Get a function's details.

### PATCH /v1/functions/:name

Update a function (source, title, or status).

### DELETE /v1/functions/:name

Delete a function.

### ALL /v1/functions/:name

Invoke a function via any HTTP method. The function's default export receives a context object and returns a response.

---

## Apps

### POST /v1/apps

Create an app.

**Body:**
```json
{ "name": "my-app", "title": "My App" }
```

### GET /v1/apps

List your apps.

### GET /v1/apps/:name

Get an app's details.

### DELETE /v1/apps/:name

Delete an app.

### POST /v1/apps/:name/files

Deploy files to an app.

### GET /v1/apps/:name/files

List app files.

### DELETE /v1/apps/:name/files

Delete app files.

---

## Policies

### POST /v1/policies

Create a row policy.

**Body:**
```json
{ "name": "users_read_own", "tableName": "notes", "action": "select", "using": { "column": "owner_id", "op": "eq", "value": "{identity.sub}" }, "roles": ["user"], "enabled": true }
```

### GET /v1/policies

List all policies.

### GET /v1/policies/:name

Get a policy's details.

### PATCH /v1/policies/:name

Update a policy.

### DELETE /v1/policies/:name

Delete a policy.

### POST /v1/policies/preview

Preview a policy's SQL without saving.

---

## SQL

### POST /v1/sql *(admin)*

Execute raw SQL. The query is EXPLAINed before execution for cost governance.

**Body:**
```json
{ "sql": "SELECT * FROM notes WHERE owner_id = $1", "params": ["..."] }
```

---

## Insights

### GET /v1/insights

Get governance insights (query log, cost statistics, slow queries).

---

## Notifications

### POST /v1/notifications/devices

Register a push notification device.

**Body:**
```json
{ "token": "...", "platform": "web", "pushService": "web_push" }
```

### GET /v1/notifications/devices

List registered devices.

### GET /v1/notifications

List notifications.

### POST /v1/notifications

Send a notification.

**Body:**
```json
{ "title": "Hello", "body": "World", "target": "all", "data": {} }
```

### GET /v1/notifications/stats

Get notification statistics.

---

## Webhooks

### POST /v1/webhooks

Register a webhook endpoint.

**Body:**
```json
{ "url": "https://example.com/webhooks", "events": ["database.insert"] }
```

### GET /v1/webhooks

List your webhooks.

### PATCH /v1/webhooks/:id

Update a webhook (url, events, active).

### DELETE /v1/webhooks/:id

Delete a webhook.

### POST /v1/webhooks/:id/secret

Regenerate the signing secret.

### GET /v1/webhooks/:id/log?limit=50

View delivery history.

---

## Health

### GET /v1/health

Check engine health (public, no auth required).

**Response:**
```json
{ "status": "ok", "engine": "vortex", "version": "0.9.0", "realtime": { "connections": 3 } }
```

---

## Audit

### GET /v1/audit/log

List audit log entries for the authenticated user (or any user if admin).

**Query params:** `action`, `userId` *(admin only)*, `limit` (default 50, max 200), `offset`

**Response (200):**
```json
{
  "entries": [{
    "id": "...", "user_id": "...", "role": "user",
    "action": "database.insert", "resource_type": "table",
    "resource_id": "notes", "metadata": { "count": 3 },
    "created_at": "..."
  }],
  "count": 1
}
```

### GET /v1/audit/stats

Get audit statistics for the authenticated user (or a target user if admin).

**Query params:** `userId` *(admin only)*

**Response (200):**
```json
{
  "totalActions": 42,
  "byAction": { "database.insert": 10, "storage.upload": 5 },
  "byResource": { "table": 15, "object": 5 },
  "lastActive": "..."
}
```

---

## API Keys

### POST /v1/api-keys

Create a new service API key. The full key is returned only at creation.

**Body:**
```json
{ "name": "production-server", "scopes": ["database:read", "storage:write"] }
```

**Response (201):**
```json
{
  "apiKey": {
    "id": "...", "name": "production-server",
    "key": "vortex_live_abc123...", "key_prefix": "vortex_live_abc1",
    "scopes": ["database:read", "storage:write"], "created_at": "..."
  }
}
```

### GET /v1/api-keys

List active API keys for the authenticated user.

**Response (200):**
```json
{
  "apiKeys": [{
    "id": "...", "name": "...", "key_prefix": "vortex_live_...",
    "scopes": ["database:read"], "last_used_at": "...",
    "created_at": "...", "revoked_at": null
  }]
}
```

### DELETE /v1/api-keys/:id

Revoke (permanently delete) an API key. Irreversible.

**Response:** 204 No Content

### Using API keys

API keys authenticate via the standard bearer header:

```
Authorization: Bearer vortex_live_abc123...
```

Keys can be used on any endpoint that requires authentication — no JWT needed. The key's `scopes` field controls access (optional; unscoped keys have full access).

---

## Two-Factor Authentication (2FA)

### POST /v1/auth/2fa/setup

Begin 2FA enrollment. Requires authentication.

**Response (200):**
```json
{
  "secret": "JBSWY3DPEHPK3PXP...",
  "otpauthUrl": "otpauth://totp/Vortex:user@example.com?secret=...",
  "backupCodes": ["CODE1", "CODE2", "CODE3", "CODE4", "CODE5", "CODE6", "CODE7", "CODE8"]
}
```

### POST /v1/auth/2fa/enable

Confirm 2FA enrollment with a 6-digit code.

**Body:**
```json
{ "code": "123456" }
```

**Response (200):**
```json
{ "enabled": true }
```

### POST /v1/auth/2fa/verify

Complete 2FA login. Uses a temporary token from the login challenge.

**Body:**
```json
{ "tempToken": "abc123...", "code": "123456" }
```

**Response (200):**
```json
{ "user": { "...": "..." }, "token": "...", "expiresIn": 3600 }
```

### POST /v1/auth/2fa/disable

Disable 2FA. Requires authentication + current password.

**Body:**
```json
{ "password": "currentpass", "code": "123456" }
```

**Response (200):**
```json
{ "disabled": true }
```

### POST /v1/auth/2fa/backup-codes

Regenerate backup codes. Requires authentication.

**Response (200):**
```json
{ "backupCodes": ["NEW1", "NEW2", "NEW3", "NEW4", "NEW5", "NEW6", "NEW7", "NEW8"] }
```

### 2FA Login Flow

When a user with 2FA enabled logs in, the `/v1/auth/login` endpoint returns a challenge instead of a session:

```json
{ "twoFactorRequired": true, "tempToken": "abc123..." }
```

The client then calls `/v1/auth/2fa/verify` with the `tempToken` and the 6-digit code from the user's authenticator app (or a backup code).

Supported authenticator apps: Google Authenticator, Authy, 1Password, Bitwarden, any TOTP-compatible app.

---

## Feature Flags

### POST /v1/flags

Create a new feature flag.

**Body:**
```json
{
  "key": "new-dashboard",
  "description": "New dashboard UI",
  "status": "gradual",
  "rolloutPercentage": 25,
  "targeting": { "roles": ["admin"] },
  "variants": [{ "name": "A", "value": "control" }, { "name": "B", "value": "treatment" }]
}
```

**Response (201):**
```json
{ "flag": { "id": "...", "key": "new-dashboard", "status": "gradual", "...": "..." } }
```

### GET /v1/flags

List all feature flags for the authenticated user.

### PATCH /v1/flags/:id

Update a feature flag (status, rollout percentage, targeting, variants).

### DELETE /v1/flags/:id

Delete a feature flag.

### GET /v1/flags/evaluate?key=

Evaluate a single flag for the authenticated user.

**Response (200):**
```json
{
  "key": "new-dashboard",
  "enabled": true,
  "variant": "A",
  "reason": "gradual_in"
}
```

The `reason` field is one of: `on`, `off`, `gradual_in`, `gradual_out`, `targeted_out`, `not_found`.

### GET /v1/flags/evaluate-all

Evaluate all flags for the authenticated user at once.

**Response (200):**
```json
{ "flags": { "new-dashboard": true, "dark-mode": false } }
```

### Flag Statuses

| Status | Behavior |
|---|---|
| `off` | Flag is disabled for all users |
| `on` | Flag is enabled for all users |
| `gradual` | Flag is enabled for a percentage of users (0-100) |

### Targeting

Flags can target specific users and roles:

```json
{
  "targeting": {
    "roles": ["admin", "beta-tester"],
    "userIds": ["user-uuid-1", "user-uuid-2"]
  }
}
```

If either `roles` or `userIds` is specified and the user doesn't match, the flag is disabled with reason `targeted_out`.

### Gradual Rollouts

Gradual rollouts use deterministic hash bucketing — the same user always gets the same result for the same flag. The `rolloutPercentage` field controls how many users see the flag (0-100).
