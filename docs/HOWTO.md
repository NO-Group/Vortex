# Vortex — Complete Guide

**The Backend-as-a-Service that does everything Supabase, Firebase, Cloudflare, and Cloudinary do — and does it better.**

---

## Table of Contents

1. [What is Vortex?](#1-what-is-vortex)
2. [Quick Start (5 minutes)](#2-quick-start-5-minutes)
3. [Architecture](#3-architecture)
4. [Authentication](#4-authentication)
5. [Database & Query Engine](#5-database--query-engine)
6. [Row Policies (the Supabase killer)](#6-row-policies-the-supabase-killer)
7. [Query Governance (the cost guardrail)](#7-query-governance-the-cost-guardrail)
8. [Realtime (durable, not fire-and-forget)](#8-realtime-durable-not-fire-and-forget)
9. [Storage & Image Transforms](#9-storage--image-transforms)
10. [Edge Cache (Cloudflare CDN parity)](#10-edge-cache-cloudflare-cdn-parity)
11. [Vortex Functions](#11-vortex-functions)
12. [Apps Hosting](#12-apps-hosting)
13. [Push Notifications](#13-push-notifications)
14. [OAuth Providers](#14-oauth-providers)
15. [TypeScript/JavaScript SDK](#15-typescriptjavascript-sdk)
16. [Console](#16-console)
17. [Deployment](#17-deployment)
18. [Multi-Node Setup](#18-multi-node-setup)
19. [API Reference](#19-api-reference)
20. [Vortex vs. the Competition](#20-vortex-vs-the-competition)

---

## 1. What is Vortex?

Vortex is a self-hostable Backend-as-a-Service platform that gives you everything you need to build a full-stack application — auth, database, realtime, storage, functions, hosting, notifications, and image transforms — in a single deployable container.

**One container. One port. Everything included.**

```
┌─────────────────────────────────────────────────┐
│  Vortex Engine (http://your-server:8080)         │
│                                                   │
│  ┌─────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Auth    │ │ Database │ │ Realtime (durable) │ │
│  │ +OAuth  │ │ +Policies│ │ +Presence          │ │
│  │ +Magic  │ │ +Governance│ +Broadcast        │ │
│  └─────────┘ └──────────┘ └────────────────────┘ │
│                                                   │
│  ┌─────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Storage │ │ Functions│ │ Apps Hosting       │ │
│  │ +Image  │ │ +VM Sandbox│ +Static Sites     │ │
│  │ +Edge   │ │           │                      │ │
│  │  Cache  │ │           │                      │ │
│  └─────────┘ └──────────┘ └────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ Console (glassmorphic admin UI)              │ │
│  │ at /  — dashboard, policy editor, OAuth, etc.│ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Why Vortex instead of Supabase?

| Feature | Supabase | Vortex |
|---|---|---|
| Row policies | `auth.uid()` per row (slow) | Compiled once, bound as parameter (fast) |
| Query cost | No ceiling — runs to the bill | EXPLAIN before execute, refuses over `MAX_QUERY_COST` |
| Realtime replay | Fire-and-forget (events lost on disconnect) | Durable replay with `since: <seq>` |
| Self-hosting | Self-hosting is complex | `docker compose up -d` |
| Image transforms | Not built in | Cloudinary-compatible, URL-based |
| OAuth | Built in | Built in (6 providers) |
| SDK | `supabase-js` | `@vortex/client` (zero-dep, fully typed) |
| Cost | Scales with usage | You control the cost ceiling |

### Why Vortex instead of Firebase?

| Feature | Firebase | Vortex |
|---|---|---|
| Hosting | Firebase Hosting | Vortex Apps (static hosting from the engine) |
| Functions | Cloud Functions | Vortex Functions (VM sandbox, wall-clock budget) |
| Realtime | Firestore realtime (loses events on disconnect) | Durable replay |
| Notifications | FCM (built in) | FCM-compatible push notifications |
| Auth | Firebase Auth | Vortex Auth (email, magic links, OAuth, bcrypt) |
| Pricing | Per-request pricing | Self-hosted, flat cost |

### Why Vortex instead of Cloudflare?

| Feature | Cloudflare | Vortex |
|---|---|---|
| Workers | Cloudflare Workers | Vortex Functions |
| KV/R2 | Cloudflare KV/R2 | Vortex Storage (local disk or S3/R2) |
| CDN | Cloudflare CDN | Vortex Edge Cache |
| DNS | Cloudflare DNS | Use any DNS provider |
| Self-hosted | No | Yes |

### Why Vortex instead of Cloudinary?

| Feature | Cloudinary | Vortex |
|---|---|---|
| Image transforms | URL-based | URL-based (same API) |
| Format conversion | Yes | Yes (webp, avif, mozjpeg, png, gif) |
| On-the-fly resize | Yes | Yes (powered by sharp) |
| Self-hosted | No | Yes |
| Bundled with BaaS | No (separate service) | Yes (part of storage) |

---

## 2. Quick Start (5 minutes)

### Prerequisites

- Docker and Docker Compose (or Node.js 20+)
- A terminal

### Option A: Docker (recommended)

```bash
git clone https://github.com/NO-Group/Vortex.git
cd Vortex
cp .env.example .env
# Edit .env: set JWT_SECRET to a long random string
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
docker compose up -d --build
```

Vortex is running at `http://localhost:8080`. The console is at `/`, the API at `/v1/`, and hosted apps at `/apps/<name>/`.

### Option B: Node.js

```bash
git clone https://github.com/NO-Group/Vortex.git
cd Vortex
npm install
npm run build
cp .env.example .env
# Set JWT_SECRET in .env
npm run dev
```

### First steps

```bash
# 1. Make yourself admin
npm run admin -- promote you@example.com

# 2. Sign in at the console (http://localhost:8080)
#    Or via API:
curl -X POST http://localhost:8080/v1/auth/signup \
  -H "content-type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}'

# 3. Create a table
curl -X POST http://localhost:8080/v1/sql \
  -H "content-type: application/json" \
  -H "authorization: Bearer YOUR_TOKEN" \
  -d '{"sql":"create table notes (id uuid primary key default gen_random_uuid(), title text, body text, owner_id uuid)"}'

# 4. Insert a row
curl -X POST http://localhost:8080/v1/db/notes \
  -H "content-type: application/json" \
  -H "authorization: Bearer YOUR_TOKEN" \
  -d '{"rows":[{"title":"Hello","body":"First note"}]}'

# 5. Query it
curl -X POST http://localhost:8080/v1/db/notes/query \
  -H "content-type: application/json" \
  -H "authorization: Bearer YOUR_TOKEN" \
  -d '{"filters":[{"column":"title","op":"eq","value":"Hello"}]}'
```

---

## 3. Architecture

### Components

| Component | Path | Description |
|---|---|---|
| **Vortex Core** | `packages/vortex-core` | Shared types, wire protocol, brand tokens |
| **Vortex Server** | `apps/vortex-server` | The engine: auth, DB, realtime, storage, functions, apps, notifications |
| **Vortex Console** | `apps/vortex-dashboard` | Glassmorphic admin UI (served by the engine) |
| **TypeScript SDK** | `packages/sdk-typescript` | `@vortex/client` — zero-dependency client |
| **Dart SDK** | `packages/sdk-dart` | Flutter/Dart client |

### Tech Stack

- **Runtime**: Node.js 20+, Express 4
- **Database**: PostgreSQL 16 (embedded or external)
- **Realtime**: WebSocket (`ws`), optional Redis bridge for multi-node
- **Storage**: Local disk or S3-compatible (AWS S3, Cloudflare R2, MinIO)
- **Image processing**: sharp
- **Auth**: JWT (HS256), bcrypt (12 rounds), one-time tokens
- **Console**: React 18, Vite, TypeScript
- **SDK**: Zero-dependency (uses `fetch` + `WebSocket`)

### Data Flow

```
Browser / Mobile App
        │
        ▼
  Vortex SDK (@vortex/client)
        │
        ▼
  Vortex Engine (Express)
    ├── Auth (JWT verify)
    ├── RBAC + Row Policies
    ├── Query Governance (EXPLAIN)
    ├── Realtime Hub (WebSocket)
    ├── Storage (Local/S3 + sharp + Edge Cache)
    ├── Functions (VM sandbox)
    ├── Apps (static hosting)
    └── Notifications (FCM)
        │
        ▼
  PostgreSQL 16
```

---

## 4. Authentication

### Email + Password

```ts
const session = await vortex.auth.signup({
  email: 'user@example.com',
  password: 'secure-password',
  metadata: { plan: 'free' }, // custom claims
});
// → { user: { id, email, role, metadata }, token, expiresIn }
```

### Magic Links (passwordless)

```ts
// Request a magic link
const result = await vortex.auth.requestMagicLink('user@example.com');
// → { ok: true, delivery: 'email' | 'inline' | 'unconfigured' }

// Verify the token (from the email link or dev-links mode)
const session = await vortex.auth.verifyMagicLink(token);
```

### OAuth (Google, GitHub, GitLab, Discord, Apple, Microsoft)

See [OAuth Providers](#14-oauth-providers).

### Password Reset

```ts
await vortex.auth.requestPasswordReset('user@example.com');
// User receives an email with a reset link
const session = await vortex.auth.confirmPasswordReset(token, 'new-password');
```

### Admin Operations

```ts
// List all users
const users = await vortex.auth.listUsers();

// Change a user's role or metadata
await vortex.auth.updateUser(userId, { role: 'admin', metadata: { plan: 'pro' } });

// Delete a user
await vortex.auth.deleteUser(userId);
```

### JWT Claims

Every Vortex access token carries:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "user",
  "meta": { "plan": "pro", "team": "n-o" },
  "iss": "vortex",
  "iat": 1730000000,
  "exp": 1730003600
}
```

---

## 5. Database & Query Engine

### Query Builder (SDK)

```ts
const notes = await vortex.database
  .from('notes')
  .select(['id', 'title', 'body'])
  .filter('owner_id', 'eq', session.user.id)
  .or([
    [{ column: 'status', value: 'active' }],
    [{ column: 'public', value: true }],
  ])
  .orderBy('created_at', 'desc')
  .limit(10)
  .countTotal()
  .execute();
// → { rows: [...], count: 10, total: 42 }
```

### Raw API

```bash
POST /v1/db/notes/query
{
  "select": ["id", "title"],
  "filters": [
    { "column": "owner_id", "op": "eq", "value": "uuid" },
    { "column": "status", "op": "in", "value": ["active", "pending"] }
  ],
  "or": [
    [{ "column": "public", value: true }],
    [{ "column": "starred", value: true }]
  ],
  "orderBy": [{ "column": "created_at", "direction": "desc" }],
  "limit": 20,
  "offset": 0,
  "include": [
    { "table": "comments", "localKey": "id", "foreignKey": "note_id", "as": "comments" }
  ],
  "countTotal": true,
  "explain": true
}
```

### Supported Operators

| Op | Meaning | Example |
|---|---|---|
| `eq` | Equal (default) | `{ column: 'status', value: 'active' }` |
| `neq` | Not equal | `{ column: 'archived', value: false }` |
| `gt` / `gte` / `lt` / `lte` | Comparison | `{ column: 'views', op: 'gt', value: 100 }` |
| `like` / `ilike` | Pattern match | `{ column: 'title', op: 'ilike', value: '%hello%' }` |
| `in` | Array membership | `{ column: 'status', op: 'in', value: ['a', 'b'] }` |
| `is` | Null check | `{ column: 'deleted_at', op: 'is' }` |
| `contains` | JSONB containment | `{ column: 'tags', op: 'contains', value: { tag: 'x' } }` |

### Insert / Update / Delete

```ts
// Insert
await vortex.database.insert('notes', [
  { title: 'New note', body: 'Content' },
  { title: 'Another', body: 'More content' },
]);

// Update (filters required — never updates all rows blindly)
await vortex.database.update('notes',
  { body: 'Updated content' },
  [{ column: 'title', op: 'eq', value: 'New note' }]
);

// Delete (filters required — refuses to truncate)
await vortex.database.delete('notes',
  [{ column: 'archived', value: true }]
);
```

---

## 6. Row Policies (the Supabase killer)

### The Problem

Supabase row policies emit `owner_id = auth.uid()` into every query. Postgres treats `auth.uid()` as a per-row function call — it cannot constant-fold it, cardinality estimates collapse, and index usage degrades. Their own performance guide tells you to hand-wrap it as `owner_id = (select auth.uid())` by hand.

### The Vortex Solution

Vortex resolves identity to a literal **once**, at compile time, and binds it as a query parameter:

```
Supabase:  owner_id = auth.uid()                    ← evaluated per row
Vortex:    "owner_id" = $3   bindings: ["7f3e…"]    ← constant, indexable
```

### Create a Policy

```ts
await vortex.admin.createPolicy({
  name: 'notes are private',
  tableName: 'notes',
  action: 'select',
  roles: ['user'],
  using: { column: 'owner_id', valueRef: 'user.id' },
});
```

### WITH CHECK (write validation)

```ts
await vortex.admin.createPolicy({
  name: 'notes stay owned',
  tableName: 'notes',
  action: 'insert',
  roles: ['user'],
  using: { column: 'owner_id', valueRef: 'user.id' },
});
```

This blocks inserting a row where `owner_id` doesn't match the caller's ID.

### Preview the Compiled SQL

```ts
const preview = await vortex.admin.previewPolicy({
  tableName: 'notes',
  action: 'select',
  role: 'user',
});
// → {
//   using: { sql: '"owner_id" = ?', bindings: ['7f3e…'] },
//   comparison: {
//     vortex: '"owner_id" = ?   -- bindings: ["7f3e…"]',
//     perRowEquivalent: 'owner_id = auth.uid()',
//     whyItMatters: 'The per-row form calls auth.uid() for every candidate row…'
//   }
// }
```

### Console

The **Policies** page in the console shows both forms side by side — the bound predicate and the per-row equivalent it replaces.

---

## 7. Query Governance (the cost guardrail)

### The Problem

Supabase has no cost ceiling. An accidental unindexed scan runs to completion and shows up on the bill.

### The Vortex Solution

Set `MAX_QUERY_COST` in your `.env`:

```env
MAX_QUERY_COST=1000
```

Every `/v1/db` query is EXPLAINed before execution. Queries above the ceiling are refused:

```json
HTTP 429
{
  "error": {
    "code": "query_too_expensive",
    "message": "Query plan cost 1234.56 exceeds the configured ceiling of 1000",
    "details": { "plan": ["Seq Scan on notes [cost=1234.56, rows=10000]"] }
  }
}
```

### Explain on Any Query

```ts
const result = await vortex.database
  .from('notes')
  .limit(5)
  .explain()
  .execute();
// → { rows: [...], count: 5, explain: { plan: { cost: 25.5, summary: [...] }, sql: "...", bindings: [...] } }
```

### Insights

```ts
// Recent slow / refused queries
const log = await vortex.admin.queryLog(50);

// Aggregate stats (last hour)
const stats = await vortex.admin.insightsOverview();
// → { total: 142, avgDurationMs: 3.2, maxCost: 1234.56, rejected: 3, ceiling: 1000 }
```

---

## 8. Realtime (durable, not fire-and-forget)

### The Problem

Fire-and-forget realtime (Supabase included) drops everything that happens while a client is disconnected. A tunnel blip silently loses your events.

### The Vortex Solution

Every event carries a per-channel `seq`. The server keeps a bounded ring buffer. A client that reconnects with `since: <seq>` is replayed what it missed.

### SDK

```ts
const rt = vortex.connectRealtime(session.token, {
  onTableChange: (event) => {
    console.log(event.action, event.rows);
  },
  onReplay: (info) => {
    console.log(`Replayed ${info.count} events (truncated: ${info.truncated})`);
  },
  onPresence: (info) => {
    if (info.kind === 'joins') console.log('Peer joined:', info.peers);
    if (info.kind === 'leaves') console.log('Peer left:', info.peers);
  },
  onBroadcast: (frame) => {
    console.log('Room message:', frame.event, frame.payload);
  },
});

rt.subscribe('table:notes');   // table changes
rt.subscribe('table:*');       // all tables
rt.subscribe('room:lobby');    // freeform room
rt.track('room:lobby', { name: 'Alice' });  // presence
rt.broadcast('room:lobby', 'message', { text: 'Hello' });
```

### Raw WebSocket

```javascript
const ws = new WebSocket('ws://localhost:8080/v1/realtime?token=YOUR_JWT');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'vortex:subscribe',
    channel: 'table:notes',
    since: 0, // resume from cursor 0 (or last seen seq)
  }));
};

ws.onmessage = (frame) => {
  const msg = JSON.parse(frame.data);
  if (msg.type === 'vortex:event') {
    console.log(msg.action, msg.rows, 'seq:', msg.seq);
  }
  if (msg.type === 'vortex:replay') {
    console.log(`Replayed ${msg.count} events, truncated: ${msg.truncated}`);
  }
};
```

### Channels

| Channel | Description |
|---|---|
| `table:<name>` | Change events for one table |
| `table:*` | Change events for every table |
| `room:<name>` | Freeform rooms: broadcast + presence |

### Frames

| Type | Direction | Description |
|---|---|---|
| `vortex:welcome` | S→C | Sent on connect, contains `clientId` |
| `vortex:event` | S→C | Table change (INSERT/UPDATE/DELETE) |
| `vortex:replay` | S→C | Marks end of catch-up burst |
| `vortex:broadcast` | C→S→C | Room message relay |
| `vortex:presence` | C→S | Track/untrack presence |
| `vortex:presence_sync` | S→C | Full peer list |
| `vortex:presence_diff` | S→C | Join/leave delta |
| `vortex:ack` | S→C | Command acknowledgement |
| `vortex:error` | S→C | Error frame |

---

## 9. Storage & Image Transforms

### Buckets

```ts
// Create a bucket
await vortex.storage.createBucket('avatars', false);  // private
await vortex.storage.createBucket('images', true);    // public

// List buckets
const buckets = await vortex.storage.listBuckets();

// Delete a bucket
await vortex.storage.deleteBucket('avatars');
```

### Upload / Download

```ts
// Upload from Node.js
await vortex.storage.upload('uploads', fileBuffer, 'photo.jpg', 'image/jpeg');

// Upload from browser (File/Blob)
await vortex.storage.upload('uploads', file, 'avatar.png');

// Presigned URL (direct-to-storage upload)
const presigned = await vortex.storage.presignUpload('uploads/photo.jpg');
// → { url, method: 'PUT', headers: {...}, expiresAt }
// Client PUTs directly to presigned.url — no data flows through the engine

// List objects
const objects = await vortex.storage.listObjects('uploads', 'photos/');

// Delete
await vortex.storage.deleteObject('uploads', 'photo.jpg');
```

### Public Buckets

Objects in public buckets are served anonymously:

```
GET /v1/storage/public/images/photo.jpg
```

### Image Transforms (Cloudinary-compatible)

Append transform parameters to any public image URL:

```
GET /v1/storage/public/photo.jpg?w=800&h=600&fit=cover&fmt=webp&quality=85
```

SDK:

```ts
const url = vortex.storage.imageUrl('images', 'photo.jpg', {
  w: 800,
  h: 600,
  fit: 'cover',
  fmt: 'webp',
  quality: 85,
  crop: 'face',
});
// → /v1/storage/public/photo.jpg?w=800&h=600&fit=cover&fmt=webp&quality=85&crop=face
```

### Transform Parameters

| Param | Values | Description |
|---|---|---|
| `w`, `h` | pixels | Target dimensions |
| `fit` | cover, contain, fill, inside, outside, thumb | Crop/resize strategy |
| `crop` | auto, top, bottom, left, right, face, enclosed | Crop anchor |
| `gravity` | face, auto, top, bottom, left, right | Gravity for face/auto crops |
| `fmt` | webp, avif, mozjpeg, png, gif | Output format |
| `quality` | 1-100 | JPEG/WebP quality |
| `dpi` | number | Resolution scaling |
| `sharpen` | number or true | Sharpen filter |
| `blur` | radius | Blur filter |
| `grayscale` | true | Convert to grayscale |
| `sepia` | true | Sepia tint |
| `rotate` | 0, 90, 180, 270 | Rotate degrees |
| `flipH` | true | Flip horizontally |
| `flipV` | true | Flip vertically |
| `padding` | pixels | Border padding |
| `paddingColor` | hex | Border color |

Transforms are powered by `sharp` and cached on disk. Repeated requests for the same transform are free.

---

## 10. Edge Cache (Cloudflare CDN parity)

### What It Does

The edge cache sits in front of public storage objects and function responses. It:
- Generates ETags for conditional GET (`If-None-Match` → 304)
- Sets `Cache-Control` headers
- Invalidates on writes (per-key, per-prefix, per-bucket)
- Tracks hit/miss/eviction stats
- Persists to disk for warm restarts

### Configuration

```env
EDGE_CACHE_TTL=300          # Cache TTL in seconds
EDGE_CACHE_MAX_ENTRIES=10000
```

### Usage

The cache is transparent — it activates automatically for:
- Public storage object reads (`/v1/storage/public/<bucket>/<path>`)
- Public function invocations (`/functions/<name>`)

### Cache Headers

```
Cache-Control: public, max-age=86400
ETag: "abc123def456"
```

### Invalidation

```bash
# Delete a specific object → cache invalidated automatically
DELETE /v1/storage/object

# Delete a bucket → all objects + cache invalidated
DELETE /v1/storage/buckets/:name
```

---

## 11. Vortex Functions

### Deploy a Function

```ts
await vortex.functions.deploy('hello', `
  export default async function(ctx) {
    const { name } = ctx.data;
    return { message: 'Hello ' + (name || 'world') };
  }
`, 'Hello Function');
```

### Invoke

```ts
const result = await vortex.functions.invoke('hello', { name: 'Alice' });
// → { message: 'Hello Alice' }
```

### HTTP Invocation

```bash
curl -X POST http://localhost:8080/functions/hello \
  -H "content-type: application/json" \
  -d '{"name":"Alice"}'
```

### Function Context

```typescript
export default async function(ctx) {
  // ctx.data — parsed JSON body from the request
  // ctx.headers — request headers
  // ctx.query — query string parameters
  // ctx.user — authenticated user (if JWT was provided)
  // ctx.db — query the database (returns { rows, count })
  // ctx.env — environment variables
  // ctx.log — structured logger

  const notes = await ctx.db.query('notes', { limit: 5 });
  return { notes };
}
```

### Wall-Clock Budget

Functions have a 5-second wall-clock budget. If exceeded, the function is killed and the client receives HTTP 508 (Gateway Timeout).

### Pause / Resume

```ts
await vortex.functions.update('hello', { status: 'paused' });
await vortex.functions.update('hello', { status: 'active' });
```

---

## 12. Apps Hosting

### Create an App

```ts
const app = await vortex.apps.create('my-app', 'My Application');
// → { name: 'my-app', title: 'My Application', ... }
```

### Upload Files

```ts
await vortex.apps.uploadFile('my-app', 'index.html', '<!DOCTYPE html>...');
await vortex.apps.uploadFile('my-app', 'style.css', 'body { ... }');
await vortex.apps.uploadFile('my-app', 'app.js', 'console.log("hi");');
```

### Live URL

```
http://localhost:8080/apps/my-app/
```

### SPA Fallback

Extension-less routes fall back to `index.html`, so client-side routing works out of the box.

### Delete

```ts
await vortex.apps.remove('my-app');
```

---

## 13. Push Notifications

### Register a Device

```ts
await vortex.auth.registerDevice({
  token: 'fcm-device-token-xxx',
  platform: 'android',
  pushService: 'fcm',
  metadata: { model: 'Pixel 8', osVersion: '14' },
});
```

### Send a Notification

```ts
await vortex.auth.sendNotification({
  title: 'New message',
  body: 'You have a new message from Alice',
  data: { channel: 'chat', messageId: 'msg-123' },
});
```

### List Notifications

```ts
const notifications = await vortex.auth.listNotifications(20);
// → [{ id, title, body, status, createdAt, deliveredAt }]
```

### Stats

```ts
const stats = await vortex.auth.notificationStats();
// → { total: 42, sent: 38, pending: 3, failed: 1 }
```

### Admin: Broadcast

```bash
POST /v1/notifications/broadcast
{
  "title": "System update",
  "body": "Vortex v1.0 is now available",
  "target": "all"
}
```

### FCM Setup

Set `FCM_SERVER_KEY` in `.env` to enable real push delivery. Without it, notifications are recorded but marked as "pending."

```env
FCM_SERVER_KEY=your-fcm-server-key
```

---

## 14. OAuth Providers

### Admin: Configure a Provider

```ts
await vortex.auth.upsertOAuthProvider({
  name: 'github',
  clientId: 'your-github-client-id',
  clientSecret: 'your-github-client-secret',
});
```

Or via the console: **OAuth** page → Add Provider.

### User: Sign In

```ts
// 1. Get the authorize URL
const providers = await vortex.auth.listOAuthProviders();
// → [{ name: 'github', displayName: 'GitHub', scopes: 'read:user user:email' }]

// 2. Redirect the user to:
//    GET /v1/auth/oauth/github/start?redirect=/dashboard

// 3. Provider redirects to callback:
//    GET /v1/auth/oauth/github/callback?code=xxx

// 4. SDK handles the callback:
const result = await vortex.auth.handleOAuthCallback('github', code);
// → { session, isNewUser: true, linkedProvider: 'github' }
```

### Supported Providers

| Provider | Name | Scopes (default) |
|---|---|---|
| Google | `google` | `openid profile email` |
| GitHub | `github` | `read:user user:email` |
| GitLab | `gitlab` | `read_user` |
| Discord | `discord` | `identify email` |
| Apple | `apple` | `name email` |
| Microsoft | `microsoft` | `openid profile email User.Read` |

### Linked Accounts

```ts
// List your linked OAuth accounts
const accounts = await vortex.auth.listOAuthAccounts();

// Unlink
await vortex.auth.unlinkOAuthAccount('github');
```

### Getting Client IDs

Each provider has a developer console where you create an OAuth app:

- **Google**: https://console.cloud.google.com/apis/credentials
- **GitHub**: https://github.com/settings/developers
- **GitLab**: https://gitlab.com/-/profile/applications
- **Discord**: https://discord.com/developers/applications
- **Apple**: https://developer.apple.com/account/resources/identifiers/list
- **Microsoft**: https://portal.azure.com → App Registrations

The redirect URI for all providers is:

```
https://your-vortex-domain.com/v1/auth/oauth/<provider>/callback
```

---

## 15. TypeScript/JavaScript SDK

### Install

```bash
npm install @vortex/client
```

### Quick Example

```ts
import { VortexClient } from '@vortex/client';

const vortex = new VortexClient({ url: 'https://your-vortex.example.com' });

// Sign up
const session = await vortex.auth.signup({
  email: 'user@example.com',
  password: 'secure-password',
});

// Create a note
await vortex.database.insert('notes', [
  { title: 'Hello', body: 'First note' },
]);

// Query notes
const notes = await vortex.database
  .from('notes')
  .filter('title', 'eq', 'Hello')
  .execute();

// Realtime
const rt = vortex.connectRealtime(session.token, {
  onTableChange: (event) => console.log(event),
});
rt.subscribe('table:notes');

// Upload an image with transforms
await vortex.storage.upload('uploads', file, 'photo.jpg');
const avatar = vortex.storage.imageUrl('uploads', 'photo.jpg', {
  w: 200, h: 200, fit: 'cover', fmt: 'webp',
});

// Send a push notification
await vortex.auth.registerDevice({ token: 'fcm-token' });
await vortex.auth.sendNotification({ title: 'Hi!', body: 'Hello from Vortex' });
```

### SDK Structure

```
VortexClient
├── auth          — signup, login, magic links, OAuth, devices, notifications
├── database      — fluent query builder + raw CRUD
├── realtime      — WebSocket client with durable replay
├── storage       — buckets, uploads, image transforms
├── functions     — deploy, invoke, manage
├── apps          — host static sites
└── admin         — SQL console, policies, insights
```

### Error Handling

```ts
import { VortexApiError } from '@vortex/client';

try {
  await vortex.auth.login({ email, password: 'wrong' });
} catch (err) {
  if (err instanceof VortexApiError) {
    console.error(err.status, err.code, err.message);
    // → 401, 'unauthorized', 'Invalid email or password'
  }
}
```

### Works in Browser and Node.js

The SDK uses `fetch` and `WebSocket` — both built into modern browsers and Node.js 18+. No polyfills needed.

---

## 16. Console

The Vortex Console is a glassmorphic admin UI served by the engine at `/`.

### Pages

| Page | Description |
|---|---|
| **Command Center** | Engine vitals: realtime status, WS connections, storage driver |
| **Database** | Browse tables, run queries, view rows |
| **SQL Console** | Admin SQL editor (single statement, parameterized) |
| **Live Stream** | Realtime event feed + room presence |
| **Storage** | Manage buckets, upload/download objects, view images |
| **Apps** | Deploy and manage hosted static sites |
| **Functions** | Deploy, invoke, pause/resume server functions |
| **Auth & Token** | User management, custom claims, session info |
| **Policies** | Create/edit row policies, preview compiled SQL |
| **OAuth** | Configure providers, view linked accounts |

### Design Language

Vortex uses "Controlled Glassmorphism" — frosted glass panels, solid sharp data surfaces, a pure dark canvas (#000000/#090C10/#161B22), Vortex Glow accents, and the Unified Command Center sidebar.

---

## 17. Deployment

See [docs/DEPLOY.md](DEPLOY.md) for the full playbook. Quick version:

### Single Server

```bash
git clone https://github.com/NO-Group/Vortex.git
cd Vortex
cp .env.example .env
# Set JWT_SECRET (long random string)
docker compose up -d --build
```

### Behind a Domain (Caddy)

```
your-domain.com {
    reverse_proxy 127.0.0.1:8080
}
```

Caddy handles automatic HTTPS.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | 8080 | HTTP port |
| `HOST` | 0.0.0.0 | Bind address |
| `DATABASE_URL` | postgres://vortex:vortex@localhost:5432/vortex | PostgreSQL connection |
| `JWT_SECRET` | — (required in prod) | JWT signing secret |
| `JWT_EXPIRES_IN` | 1h | Token lifetime |
| `AUTO_MIGRATE` | true | Run migrations on boot |
| `SERVE_CONSOLE` | true | Serve the console from the engine |
| `PUBLIC_APP_URL` | http://localhost:8080 | Absolute URL for email links |
| `SMTP_URL` | — | SMTP connection (magic links / resets) |
| `MAIL_FROM` | Vortex <no-reply@vortex.local> | From-address for emails |
| `VORTEX_DEV_LINKS` | false (prod) | Expose magic-link tokens in API responses |
| `STORAGE_DRIVER` | local | `local` or `s3` |
| `STORAGE_LOCAL_DIR` | ./.vortex-data | Local storage directory |
| `PUBLIC_API_BASE` | auto | Base URL for presigned URLs |
| `S3_BUCKET` | vortex | S3 bucket name |
| `S3_REGION` | auto | S3 region |
| `S3_ENDPOINT` | http://localhost:9000 | S3 endpoint |
| `S3_ACCESS_KEY_ID` | vortex | S3 access key |
| `S3_SECRET_ACCESS_KEY` | vortex-secret | S3 secret key |
| `REDIS_URL` | — | Redis URL for multi-node realtime |
| `REALTIME_HEARTBEAT_MS` | 30000 | Heartbeat interval |
| `REALTIME_BACKLOG` | 500 | Per-channel event buffer depth |
| `MAX_QUERY_COST` | — | Cost ceiling for governed queries |
| `SLOW_QUERY_MS` | 250 | Slow query threshold |
| `FCM_SERVER_KEY` | — | FCM server key for push notifications |
| `EDGE_CACHE_TTL` | 300 | Edge cache TTL (seconds) |
| `EDGE_CACHE_MAX_ENTRIES` | 10000 | Edge cache max entries |

### Admin CLI

```bash
# List users
npm run admin -- list

# Promote a user to admin
npm run admin -- promote you@example.com

# Demote an admin
npm run admin -- demote you@example.com
```

---

## 18. Multi-Node Setup

For high-availability deployments, run multiple Vortex engines behind a load balancer, sharing a Redis instance for realtime fan-out.

```env
# On each node
REDIS_URL=redis://your-redis:6379
```

The Redis bridge shares table-change events across all nodes, so a client subscribed to one node receives events from mutations on any node.

### Recommended Architecture

```
                    ┌──────────┐
                    │ Load     │
                    │ Balancer│
                    └────┬─────┘
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Vortex   │  │ Vortex   │  │ Vortex   │
    │ Engine 1 │  │ Engine 2 │  │ Engine 3 │
    └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │             │
         └──────┬──────┴──────┬──────┘
                ▼             ▼
         ┌──────────┐  ┌──────────┐
         │ Postgres │  │ Redis    │
         └──────────┘  └──────────┘
```

---

## 19. API Reference

### Auth (`/v1/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | — | Register + session |
| POST | `/login` | — | Login + session |
| GET | `/me` | Bearer | Current user |
| POST | `/magic-link` | — | Request magic link |
| POST | `/magic-link/verify` | — | Verify magic link + session |
| POST | `/password-reset` | — | Request reset |
| POST | `/password-reset/confirm` | — | Confirm reset + session |
| GET | `/users` | Admin | List users |
| PATCH | `/users/:id` | Admin | Update role/metadata |
| DELETE | `/users/:id` | Admin | Delete user |

### OAuth (`/v1/auth/oauth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/providers` | — | List enabled providers |
| GET | `/:provider/start` | — | Redirect to provider |
| GET | `/:provider/callback` | — | Handle callback + session |
| GET | `/accounts` | Bearer | List linked accounts |
| DELETE | `/accounts/:provider` | Bearer | Unlink provider |
| GET | `/admin/providers` | Admin | List configured providers |
| POST | `/admin/providers` | Admin | Create/update provider |
| DELETE | `/admin/providers/:name` | Admin | Remove provider |

### Database (`/v1/db`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/:table/query` | Bearer | Dynamic SELECT |
| POST | `/:table` | Bearer | Insert rows |
| PATCH | `/:table` | Bearer | Update rows |
| DELETE | `/:table` | Bearer | Delete rows |
| GET | `/tables` | Bearer | List table names |

### SQL (`/v1/sql`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Admin | Execute SQL statement |

### Storage (`/v1/storage`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/public/:bucket/*` | — | Public object read |
| POST | `/presign-upload` | Bearer | Presigned upload URL |
| POST | `/presign-download` | Bearer | Presigned download URL |
| POST | `/object` | Bearer | Upload object |
| GET | `/object` | Bearer | Download object |
| GET | `/list` | Bearer | List objects |
| DELETE | `/object` | Bearer | Delete object |
| POST | `/buckets` | Bearer | Create bucket |
| GET | `/buckets` | Bearer | List buckets |
| DELETE | `/buckets/:name` | Bearer | Delete bucket |

### Realtime (`/v1/realtime`)

WebSocket at `/v1/realtime?token=<jwt>`

| Frame | Direction | Description |
|---|---|---|
| `vortex:auth` | C→S | Authenticate socket |
| `vortex:subscribe` | C→S | Subscribe to channel (`since` for resume) |
| `vortex:unsubscribe` | C→S | Unsubscribe |
| `vortex:broadcast` | C→S | Room message |
| `vortex:presence` | C→S | Track/untrack presence |
| `vortex:ping` | C→S | Heartbeat |
| `vortex:welcome` | S→C | On connect (clientId) |
| `vortex:event` | S→C | Table change |
| `vortex:replay` | S→C | End of catch-up burst |
| `vortex:broadcast` | S→C | Room message relay |
| `vortex:presence_sync` | S→C | Full peer list |
| `vortex:presence_diff` | S→C | Join/leave delta |
| `vortex:ack` | S→C | Command ack |
| `vortex:error` | S→C | Error |

### Functions (`/v1/functions`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Bearer | Deploy function |
| GET | `/` | Bearer | List functions |
| GET | `/:name` | Bearer | Get function metadata |
| PATCH | `/:name` | Bearer | Update/pause function |
| DELETE | `/:name` | Bearer | Delete function |
| ALL | `/functions/:name` | — | Invoke (public) |

### Apps (`/v1/apps`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/` | Bearer | Create app |
| GET | `/` | Bearer | List apps |
| GET | `/:name` | Bearer | Get app + files |
| DELETE | `/:name` | Bearer | Delete app |
| POST | `/:name/files` | Bearer | Upload file |
| GET | `/:name/files` | Bearer | List files |
| DELETE | `/:name/files` | Bearer | Delete file |

### Policies (`/v1/policies`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Admin | List policies |
| POST | `/preview` | Admin | Preview compiled SQL |
| POST | `/` | Admin | Create policy |
| PATCH | `/:id` | Admin | Update policy |
| DELETE | `/:id` | Admin | Delete policy |

### Insights (`/v1/insights`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/queries` | Admin | Recent slow/refused queries |
| GET | `/overview` | Admin | Aggregate stats (1 hour) |

### Notifications (`/v1/notifications`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/devices` | Bearer | Register device |
| GET | `/devices` | Bearer | List devices |
| DELETE | `/devices/:id` | Bearer | Deactivate device |
| POST | `/` | Bearer | Send notification |
| GET | `/` | Bearer | List notifications |
| GET | `/stats` | Bearer | Notification stats |
| POST | `/broadcast` | Admin | Broadcast to all |

### Health (`/healthz`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | — | Engine health (connections, storage, realtime) |

---

## 20. Vortex vs. the Competition

### Vortex vs. Supabase

| | Supabase | Vortex |
|---|---|---|
| **Row policies** | `auth.uid()` per row — slow at scale | Compiled once, bound as parameter — fast |
| **Query cost** | No ceiling — runs to the bill | EXPLAIN before execute, refuses over `MAX_QUERY_COST` |
| **Realtime** | Fire-and-forget — events lost on disconnect | Durable replay with `since: <seq>` |
| **Policies as data** | Postgres DDL (needs migrations to change) | Rows in a table (API-readable, diffable) |
| **Self-hosting** | Complex (requires Docker + Postgres setup) | `docker compose up -d` |
| **Image transforms** | Not built in | Cloudinary-compatible, URL-based |
| **OAuth** | Built in | Built in (6 providers) |
| **SDK** | `supabase-js` (heavy, many deps) | `@vortex/client` (zero-dep, fully typed) |
| **Push notifications** | Not built in | Built in (FCM) |
| **Apps hosting** | Not built in | Built in |
| **Pricing** | Scales with usage | Self-hosted, flat cost |

### Vortex vs. Firebase

| | Firebase | Vortex |
|---|---|---|
| **Hosting** | Firebase Hosting | Vortex Apps (static hosting from engine) |
| **Functions** | Cloud Functions (vendor lock-in) | Vortex Functions (VM sandbox, portable) |
| **Realtime** | Firestore realtime (loses events on disconnect) | Durable replay |
| **Auth** | Firebase Auth (proprietary) | Vortex Auth (email, magic, OAuth, bcrypt) |
| **Notifications** | FCM (built in) | FCM-compatible push |
| **Database** | Firestore (proprietary query syntax) | PostgreSQL (standard SQL) |
| **Self-hosted** | No | Yes |
| **Pricing** | Per-request pricing | Self-hosted, flat cost |

### Vortex vs. Cloudflare

| | Cloudflare | Vortex |
|---|---|---|
| **Workers** | Cloudflare Workers | Vortex Functions |
| **KV/R2** | Cloudflare KV/R2 | Vortex Storage (local or S3/R2) |
| **CDN** | Cloudflare CDN (global edge) | Vortex Edge Cache (in-process) |
| **Auth** | Not built in | Built in (JWT, OAuth, magic links) |
| **Database** | Not built in | Built in (PostgreSQL) |
| **Realtime** | Not built in | Built in (WebSocket + durable replay) |
| **Self-hosted** | No | Yes |

### Vortex vs. Cloudinary

| | Cloudinary | Vortex |
|---|---|---|
| **Image transforms** | URL-based | URL-based (same API) |
| **Format conversion** | webp, avif, mozjpeg | webp, avif, mozjpeg, png, gif |
| **On-the-fly resize** | Yes | Yes (powered by sharp) |
| **Self-hosted** | No | Yes |
| **Bundled with BaaS** | No (separate service) | Yes (part of storage) |
| **Cost** | Per-transform pricing | Self-hosted, flat cost |

---

## License

Apache-2.0 — see [LICENSE](../LICENSE).

---

**Vortex — the non-negotiable BaaS.**
