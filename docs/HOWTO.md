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
15. [Billing & Payments](#15-billing--payments)
16. [SDKs (All Languages)](#16-sdks-all-languages)
17. [Console](#17-console)
18. [Deployment](#18-deployment)
19. [Multi-Node Setup](#19-multi-node-setup)
20. [API Reference](#20-api-reference)
21. [Vortex vs. the Competition](#21-vortex-vs-the-competition)

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
| OAuth | Built in | Built in (9 providers + generic OIDC) |
| SDK | `supabase-js` | `@nogroup/vortex` (zero-dep, fully typed) |
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
| **SDKs** | `sdks/` | 16 self-contained SDKs: TypeScript, Dart, Python, Go, Rust, Java/Kotlin, Swift, C#/.NET, PHP, Ruby, C/C++, Elixir, Godot, Unity, Unreal, CLI |

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
  Vortex SDK (@nogroup/vortex)
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

### Web Push (VAPID) — the one that actually works

Vortex supports **Web Push** using VAPID — the browser-native push standard.
This works in Chrome, Firefox, Edge, and Safari with **zero external setup**.
No Firebase project, no FCM, no API keys.

**Step 1: Get the VAPID public key**

```ts
const { publicKey } = await vortex.auth.getVapidKey();
// → "BECAb6Y9..."
```

**Step 2: Subscribe in the browser**

```javascript
// In your web app (browser only)
const publicKey = 'BECAb6Y9...'; // from getVapidKey()

// Convert to Uint8Array (browsers need this format)
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
};

const applicationServerKey = urlBase64ToUint8Array(publicKey);

const subscription = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey,
});

// Register the subscription with Vortex
await vortex.auth.registerDevice({
  token: subscription.endpoint,
  platform: 'web',
  pushService: 'web_push',
  metadata: { keys: subscription.keys },
});
```

**Step 3: Listen for push events**

```javascript
// In your service worker (sw.js)
self.addEventListener('push', (event) => {
  const data = event.data.json();
  const title = data.notification.title;
  const body = data.notification.body;
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icon.png',
    data: data.data,
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window' }).then(clientList => {
    for (const client of clientList) {
      if (client.url.includes('/') && 'focus' in client) {
        return client.focus();
      }
    }
    return clients.openWindow('/');
  }));
});
```

**Step 4: Send a push**

```ts
await vortex.auth.sendNotification({
  title: 'New message',
  body: 'You have a new message from Alice',
  data: { url: '/chat' },
});
// → The browser receives a native notification
```

### Native Apps (iOS / Android) — why FCM + APNs are required

Vortex pushes to native apps through two OS-level services:

| Platform | Push Service | Why |
|---|---|---|
| **iOS** | APNs (Apple Push Notification service) | Apple does not allow any third-party push service on iOS. APNs is the only channel that delivers notifications to native iOS apps. |
| **Android** | FCM (Firebase Cloud Messaging) | Google's FCM is the standard push channel on Android. Every Android device with Google Play Services uses FCM for push. |

**This is not a Vortex limitation.** Every backend on earth — Supabase, Firebase, your own custom server — routes native push through FCM and APNs. These are OS-level infrastructure, same as how SMS requires a carrier. No backend can push to a native app without the OS push service.

**What Vortex does differently:** Vortex provides the transport layer to both, with the same developer experience as everything else in Vortex — one SDK, one auth flow, one console.

### APNs — iOS Native Push

For native iOS apps, register device tokens with `pushService: 'apns'`:

```ts
await vortex.auth.registerDevice({
  token: 'apns-device-token-string',
  platform: 'ios',
  pushService: 'apns',
});
```

Vortex delivers via APNs HTTP/2 with ES256 JWT auth (the .p8 auth-key flow):

```env
# Apple Developer > Keys > create key with "Apple Push Notification service" enabled
# Download the .p8 file — its contents are the APNS_PRIVATE_KEY
APNS_TEAM_ID=ABC1234567
APNS_KEY_ID=ABC1234567
APNS_BUNDLE_ID=com.yourapp.bundleid
APNS_PRIVATE_KEY=base64-encoded-p8-contents
APNS_SANDBOX=false
```

APNs supports:
- **Alert notifications** (title + body + sound + badge)
- **Background notifications** (silent data sync)
- **Interrupt levels** (passive, active, time-sensitive)
- **Sandbox vs production** (toggle with `APNS_SANDBOX=true`)

### FCM HTTP v1 — Android Native Push

For Android/iOS apps using Firebase Cloud Messaging:

```env
FCM_PROJECT_ID=your-project-id
FCM_PRIVATE_KEY=your-service-account-private-key-pem
```

Register FCM device tokens:

```ts
await vortex.auth.registerDevice({
  token: 'fcm-device-token',
  platform: 'android',
  pushService: 'fcm',
});
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

### VAPID Key Persistence

VAPID keys auto-generate on first boot. **Persist them** so browser subscriptions
don't break on restart:

```bash
# Generate once
node -e "const wp=require('web-push');console.log(JSON.stringify(wp.generateVAPIDKeys()))"
# → {"publicKey":"...","privateKey":"..."}

# Set in .env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
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

### Generic OIDC Provider (connect any IdP)

Instead of waiting for Vortex to support each provider individually, you can connect **any OIDC-compatible identity provider** by pasting three things:

1. **Client ID**
2. **Client Secret**
3. **Discovery URL** (the `/.well-known/openid-configuration` endpoint)

Vortex fetches the discovery document and auto-discovers the authorization, token, and userinfo endpoints — no manual URL configuration needed.

```ts
// Connect Okta, Auth0, Keycloak, Slack, or any custom OIDC IdP
await vortex.auth.upsertOAuthProvider({
  name: 'oidc',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  discoveryUrl: 'https://your-idp.com/.well-known/openid-configuration',
  displayName: 'My Company SSO',
  scopes: 'openid profile email',
});
```

**Supported providers via discovery:** Okta, Auth0, Keycloak, Slack, FusionAuth, Authentik, any custom OIDC IdP, and Apple (with Service ID + .p8 key).

**Security:** Discovery URLs must use HTTPS and point to a public host — localhost and internal IP ranges are blocked to prevent SSRF.

### Google (Pre-configured)

Google OAuth is pre-seeded on first migration. Set these in your `.env`:

```env
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret
```

The migration reads these env vars and seeds the Google provider automatically. If left unset, Google is skipped — you can configure it manually via the admin API or console. Get your credentials from [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).

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

| Provider | Name | Scopes (default) | Setup |
|---|---|---|---|
| Google | `google` | `openid profile email` | **Pre-configured** — no setup needed |
| GitHub | `github` | `read:user user:email` | Manual |
| GitLab | `gitlab` | `read_user` | Manual |
| Discord | `discord` | `identify email` | Manual |
| Apple | `apple` | `name email` | Manual (Service ID + .p8 key) |
| Microsoft | `microsoft` | `openid profile email User.Read` | Manual |
| Twitter / X | `twitter` | `users.read tweet.read` | Manual |
| Facebook | `facebook` | `public_profile,email` | Manual |
| **Generic OIDC** | `oidc` | `openid profile email` | Discovery URL — works with **any** OIDC IdP |

### Linked Accounts

```ts
// List your linked OAuth accounts
const accounts = await vortex.auth.listOAuthAccounts();

// Unlink
await vortex.auth.unlinkOAuthAccount('github');
```

### Getting Client IDs

Each provider has a developer console where you create an OAuth app:

- **Google**: https://console.cloud.google.com/apis/credentials *(Vortex ships with a working Google service account)*
- **GitHub**: https://github.com/settings/developers
- **GitLab**: https://gitlab.com/-/profile/applications
- **Discord**: https://discord.com/developers/applications
- **Apple**: https://developer.apple.com/account/resources/identifiers/list
- **Microsoft**: https://portal.azure.com → App Registrations
- **Okta**: https://your-org.okta.com/admin → Applications → Add Application → OIDC
- **Auth0**: https://your-tenant.auth0.com/applications
- **Keycloak**: Your Keycloak admin console → Clients → Create client

The redirect URI for all providers is:

```
https://your-vortex-domain.com/v1/auth/oauth/<provider>/callback
```

---

## 15. Billing & Payments

Vortex includes a native billing module that handles checkout, webhook verification, subscription management, and automatic user plan/credit sync — so you can monetize your app in 5 minutes instead of 5 days.

### Enable Billing

Set your payment gateway in `.env`:

```env
BILLING_GATEWAY=paystack          # or flutterwave, stripe
BILLING_ENABLED=true
BILLING_CURRENCY=ngn

# Paystack
PAYSTACK_SECRET_KEY=your-secret-key

# Or Flutterwave
FLUTTERWAVE_SECRET_KEY=your-secret-key

# Or Stripe
STRIPE_SECRET_KEY=your-secret-key
STRIPE_WEBHOOK_SECRET=your-webhook-signing-secret
```

Billing auto-enables if any gateway secret key is present.

### Supported Gateways

| Gateway | Currency | Region | Notes |
|---|---|---|---|
| **Paystack** | NGN, GHS, KES, ZAR, USD | Africa | Native African payments |
| **Flutterwave** | NGN, GHS, KES, ZAR, USD | Africa | Multi-currency |
| **Stripe** | 135+ currencies | Global | Subscription billing |

### Default Plans

Three plans are seeded on first migration:

| Plan | Price | API Calls | Storage | Functions | Projects |
|---|---|---|---|---|---|
| **Free** | $0/mo | 10,000 | 1 GB | 5 | 1 |
| **Pro** | $20/mo | 500,000 | 10 GB | 50 | 10 |
| **Business** | $50/mo | 5,000,000 | 100 GB | 200 | 50 |

### Checkout (One Call)

```ts
// Create a checkout — returns a redirect URL
const checkout = await vortex.billing.checkout({
  planName: 'pro',
  email: user.email,
  successUrl: 'https://myapp.com/billing?success',
  cancelUrl: 'https://myapp.com/billing?cancel',
});
// → {
//   transactionId: 'uuid',
//   reference: 'vtx_abc123...',
//   gateway: 'paystack',
//   amountCents: 2000,
//   currency: 'ngn',
//   redirectUrl: 'https://checkout.paystack.com/...'
// }

// Redirect the user to checkout.redirectUrl
```

### Webhooks (Automatic)

When the gateway sends a webhook to `POST /v1/billing/webhooks/<gateway>`, Vortex:

1. **Verifies the signature** (HMAC-SHA256/512 per gateway)
2. **Parses the event** (success, failure, refund)
3. **Updates the transaction** status in the database
4. **Updates the user's plan and credits** — the `plan`, `credits`, `plan_expires_at`, and `active_subscription_id` columns on the `users` table
5. **Creates/updates a subscription** record with the current period

No webhook boilerplate, no signature verification code, no manual user updates.

### JWT Integration

Every issued JWT automatically includes billing info in the `meta` claims:

```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "user",
  "meta": {
    "plan": "pro",
    "credits": 500000,
    "planExpiresAt": "2026-11-23T00:00:00.000Z",
    "hasActiveSubscription": true
  }
}
```

Check a user's plan in your frontend with zero extra API calls:

```ts
const plan = session.user.metadata.plan;      // 'pro'
const credits = session.user.metadata.credits; // 500000
```

### Admin: Plan Management

```ts
// Create a custom plan
await vortex.billing.createPlan({
  name: 'enterprise',
  displayName: 'Enterprise',
  priceCents: 50000,
  currency: 'usd',
  interval: 'month',
  features: { apiCalls: 50000000, storageMb: 1024000, functions: 1000 },
});

// Update a plan
await vortex.billing.updatePlan('pro', {
  priceCents: 2500,
  features: { apiCalls: 1000000 },
});

// List all plans
const plans = await vortex.billing.listPlans();
```

### Subscription Management

```ts
// Get current subscription
const sub = await vortex.billing.getSubscription();

// Cancel (at end of current period)
await vortex.billing.cancelSubscription();

// View transaction history
const transactions = await vortex.billing.listTransactions(50);
```

### Dashboard Billing UI

Configure your gateway keys, create plans, view transactions, and manage subscriptions from the **Billing** page in the console.

---

## 16. SDKs (All Languages)

Vortex ships **16 self-contained SDKs** in the `sdks/` directory — one per language, each with its own manifest, client, and service modules. All SDKs share the same API surface: auth, database (query builder), storage, functions, apps, billing, and admin.

### SDK Overview

| Language | Package | Install |
|---|---|---|
| **TypeScript / JavaScript** | `@nogroup/vortex` | `npm install @nogroup/vortex` |
| **Dart** | `vortex_sdk` | `dart pub add vortex_sdk` |
| **Python** | `vortex-cloud` | `pip install vortex-cloud` |
| **Go** | `github.com/nogroup/vortex-go` | `go get github.com/nogroup/vortex-go` |
| **Rust** | `vortex-sdk` | `cargo add vortex-sdk` |
| **Java / Kotlin** | `org.nogroup:vortex-sdk` | Maven dependency |
| **Swift** | `VortexSwift` | Swift Package Manager |
| **C# / .NET** | `NoGroup.Vortex` | `dotnet add package NoGroup.Vortex` |
| **PHP / Laravel** | `nogroup/vortex-php` | `composer require nogroup/vortex-php` |
| **Ruby** | `vortex-sdk` | `gem install vortex-sdk` |
| **C / C++** | `vortex-cpp` | CMake `add_subdirectory` |
| **Elixir** | `vortex_sdk` | `mix deps.get vortex_sdk` |
| **Godot** | `vortex-godot` | Copy scripts into project |
| **Unity** | `com.nogroup.vortex` | Copy into Assets/ |
| **Unreal Engine** | `VortexSDK` | Plugin import |
| **CLI** | `@nogroup/vortex-cli` | `npm install -g @nogroup/vortex-cli` |

### SDK Structure (all languages)

```
VortexClient
├── auth          — signup, login, me, OAuth, devices, notifications
├── database      — fluent query builder + raw CRUD
├── realtime      — WebSocket client with durable replay
├── storage       — buckets, uploads, image transforms
├── functions     — deploy, invoke, manage
├── apps          — host static sites
├── billing       — plans, checkout, transactions, subscriptions
└── admin         — SQL console, policies, insights
```

### TypeScript / JavaScript

#### Install

```bash
npm install @nogroup/vortex
```

#### Quick Example

```ts
import { VortexClient } from '@nogroup/vortex';

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

#### Error Handling

```ts
import { VortexApiError } from '@nogroup/vortex';

try {
  await vortex.auth.login({ email, password: 'wrong' });
} catch (err) {
  if (err instanceof VortexApiError) {
    console.error(err.status, err.code, err.message);
    // → 401, 'unauthorized', 'Invalid email or password'
  }
}
```

#### Works in Browser and Node.js

The SDK uses `fetch` and `WebSocket` — both built into modern browsers and Node.js 18+. No polyfills needed.

### Dart

#### Install

```bash
dart pub add vortex_sdk
```

#### Quick Example

```dart
import 'package:vortex_sdk/vortex_sdk.dart';

final vortex = VortexClient(baseUrl: 'https://your-vortex.example.com');
final session = await vortex.auth.signup(email: 'user@example.com', password: 'password');
final notes = await vortex.database
    .from('notes')
    .filter('owner_id', 'eq', session.user.id)
    .limit(10)
    .execute();
```

### Python

#### Install

```bash
pip install vortex-cloud
```

#### Quick Example

```python
import asyncio
from vortex_cloud import VortexClient

async def main():
    async with VortexClient(url="https://your-vortex.example.com") as vortex:
        session = await vortex.auth.signup(email="user@example.com", password="password")
        notes = await vortex.database.from_table("notes") \
            .filter("owner_id", "eq", session["user"]["id"]) \
            .limit(10) \
            .execute()
        print(notes)

asyncio.run(main())
```

### Go

#### Install

```bash
go get github.com/nogroup/vortex-go
```

#### Quick Example

```go
import vortex "github.com/nogroup/vortex-go"

v := vortex.New("https://your-vortex.example.com")
session, _ := v.Auth.Signup(ctx, "user@example.com", "password")
notes, _ := v.Database.From("notes").
    Filter("owner_id", "eq", session.User.ID).
    Limit(10).
    Execute(ctx)
```

### Rust

#### Install

```toml
[dependencies]
vortex-sdk = "1.0"
```

#### Quick Example

```rust
use vortex_sdk::VortexClient;

#[tokio::main]
async fn main() {
    let vortex = VortexClient::new("https://your-vortex.example.com");
    let session = vortex.auth().signup("user@example.com", "password").await.unwrap();
    let notes = vortex.database()
        .from("notes")
        .filter("owner_id", "eq", &session.user.id)
        .limit(10)
        .execute()
        .await
        .unwrap();
}
```

### Java / Kotlin

#### Install (Maven)

```xml
<dependency>
  <groupId>org.nogroup</groupId>
  <artifactId>vortex-sdk</artifactId>
  <version>1.0.0</version>
</dependency>
```

#### Quick Example (Kotlin)

```kotlin
import org.nogroup.vortex.VortexClient

val vortex = VortexClient("https://your-vortex.example.com")
val session = vortex.auth().signup("user@example.com", "password")
val notes = vortex.database()
    .from("notes")
    .filter("owner_id", "eq", session.user.id)
    .limit(10)
    .execute()
```

### Swift

#### Install (Swift Package Manager)

```swift
.package(url: "https://github.com/no-group/vortex", from: "1.0.0")
```

#### Quick Example

```swift
import VortexSwift

let vortex = VortexClient(baseURL: "https://your-vortex.example.com")
let session = await vortex.auth.signup(email: "user@example.com", password: "password")
let notes = await vortex.database
    .from("notes")
    .filter("owner_id", "eq", session.user.id)
    .limit(10)
    .execute()
```

### C# / .NET

#### Install

```bash
dotnet add package NoGroup.Vortex
```

#### Quick Example

```csharp
using NoGroup.Vortex;

var vortex = new VortexClient("https://your-vortex.example.com");
var session = await vortex.Auth.SignupAsync("user@example.com", "password");
var notes = await vortex.Database
    .From("notes")
    .Filter("owner_id", "eq", session.User.Id)
    .Limit(10)
    .ExecuteAsync();
```

### PHP

#### Install

```bash
composer require nogroup/vortex-php
```

#### Quick Example

```php
use NoGroup\Vortex\VortexClient;

$vortex = new VortexClient('https://your-vortex.example.com');
$session = $vortex->auth()->signup('user@example.com', 'password');
$notes = $vortex->database()->from('notes')
    ->filter('owner_id', 'eq', $session['user']['id'])
    ->limit(10)
    ->execute();
```

### Ruby

#### Install

```bash
gem install vortex-sdk
```

#### Quick Example

```ruby
require 'vortex_sdk'

vortex = VortexSDK.client('https://your-vortex.example.com')
session = vortex.auth.signup('user@example.com', 'password')
notes = vortex.database
  .from('notes')
  .filter('owner_id', 'eq', session['user']['id'])
  .limit(10)
  .execute
```

### C / C++

#### Build

```bash
cmake -B build
cmake --build build
```

#### Quick Example

```cpp
#include "vortex.h"

int main() {
    vortex::Client vortex("https://your-vortex.example.com");
    auto session = vortex.auth().signup("user@example.com", "password");
    auto notes = vortex.database().from("notes")
        .filter("owner_id", "eq", session["user"]["id"])
        .limit(10)
        .execute();
    return 0;
}
```

### Elixir

#### Install

```elixir
def deps do
  [
    {:vortex_sdk, "~> 1.0"}
  ]
end
```

#### Quick Example

```elixir
{:ok, vortex} = VortexSDK.Client.new("https://your-vortex.example.com")
{:ok, session} = vortex.auth().signup("user@example.com", "password")

{:ok, notes} = vortex.database()
  |> VortexSDK.Database.from("notes")
  |> VortexSDK.QueryBuilder.filter("owner_id", "eq", session["user"]["id"])
  |> VortexSDK.QueryBuilder.limit(10)
  |> VortexSDK.QueryBuilder.execute()
```

### Godot

Copy the `.gd` scripts into your Godot project, then:

```gdscript
var vortex := VortexClient.new("https://your-vortex.example.com")
var session = await vortex.auth.signup("user@example.com", "password")
var notes = await vortex.database.from("notes") \
    .filter("owner_id", "eq", session.user.id) \
    .limit(10) \
    .execute()
```

### Unity

Copy the `.cs` files into your Unity project under `Assets/Plugins/VortexSDK/`, then:

```csharp
using Com.NoGroup.Vortex;

var vortex = new VortexClient("https://your-vortex.example.com");
StartCoroutine(vortex.Auth.Signup("user@example.com", "password",
    data => { Debug.Log("Signed up!"); },
    (status, code, msg) => { Debug.LogError(msg); }));
```

### Unreal Engine

Copy the `VortexSDK` plugin folder into your project's `Plugins/` directory and enable it in **Edit → Plugins**. Then in Blueprints or C++:

```cpp
auto* vortex = NewObject<UVortexClient>();
vortex->Initialize(FString(TEXT("https://your-vortex.example.com")));
vortex->Auth->Signup(FString(TEXT("user@example.com")), FString(TEXT("password")), OnSuccess, OnError);
```

### CLI

#### Install

```bash
npm install -g @nogroup/vortex-cli
```

#### Quick Start

```bash
# Initialize with your Vortex URL
vortex init https://your-vortex.example.com

# Sign up / log in
vortex auth signup user@example.com password
vortex auth login user@example.com password

# Query the database
vortex db tables
vortex db query notes '{"filters":[],"limit":10}'

# Storage
vortex storage buckets

# Functions
vortex functions list
vortex functions invoke myFunction '{"key":"value"}'

# Billing
vortex billing plans
vortex billing status

# Admin
vortex admin sql "SELECT * FROM users LIMIT 10"
```

### Query Builder Pattern (all SDKs)

Every SDK's database service exposes a fluent query builder:

```ts
// TypeScript
vortex.database.from('notes')
  .select(['id', 'title', 'body'])
  .filter('owner_id', 'eq', session.user.id)
  .orderBy('created_at', 'desc')
  .limit(10)
  .countTotal()
  .execute();
// → { rows: [...], count: 10, total: 42 }
```

The same pattern exists in all 16 SDKs — `from(table)` → `filter()` → `orderBy()` → `limit()` → `execute()`.

### Error Handling

All SDKs throw typed errors on non-2xx responses. The error carries the HTTP status, the API error code, and the message:

```ts
// TypeScript
try {
  await vortex.auth.login({ email, password: 'wrong' });
} catch (err) {
  console.error(err.status, err.code, err.message);
  // → 401, 'unauthorized', 'Invalid email or password'
}
```

```python
# Python
from vortex_cloud import VortexClient, VortexError
try:
    ...
except VortexError as e:
    print(e.status, e.code, e.message)
```

```go
// Go
session, err := v.Auth.Login(ctx, "user@example.com", "wrong")
if err != nil {
    // err.Error() contains the API error message
}
```

---

## 17. Console

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
| **Billing** | Configure gateway, manage plans, view transactions & subscriptions |
| **Platform** | Full capability dashboard with pie/bar/area charts, capability matrix, and status badges across all 15 categories |

### Design Language

Vortex uses "Controlled Glassmorphism" — frosted glass panels, solid sharp data surfaces, a pure dark canvas (#000000/#090C10/#161B22), Vortex Glow accents, and the Unified Command Center sidebar.

### Platform Capabilities Dashboard

The **Platform** page (`/#/platform`) provides a unified view of all Vortex
capability categories with live charts and a capability matrix:

- **Pie chart** — capability status distribution (active / pending / disabled)
- **Bar chart** — capabilities grouped by category
- **Area chart** — analytics event activity over time
- **Bar chart** — API usage broken down by HTTP method
- **Bar chart** — job queue status distribution
- **Capability matrix** — every capability with its status badge, category, and endpoint

Data is fetched live from `/v1/platform/*` endpoints (see below).

### Platform API (`/v1/platform/*`)

Vortex includes a comprehensive platform layer covering **15 capability
categories** via 21 backend services. All endpoints are mounted under
`/v1/platform/`:

| Category | Service | Endpoint |
|---|---|---|
| **AI / Chat** | `ai.service` | `/v1/platform/ai/*` |
| **Analytics** | `analytics.service` | `/v1/platform/analytics/*` |
| **Approvals** | `approval.service` | `/v1/platform/approvals/*` |
| **Abac / RBAC** | `abac.service` | `/v1/platform/abac/*` |
| **Backups** | `backups.service` | `/v1/platform/backups/*` |
| **CDN** | `cdn.service` | `/v1/platform/cdn/*` |
| **Data Export** | `dataexport.service` | `/v1/platform/export/*` |
| **Email** | `email.service` | `/v1/platform/email/*` |
| **FCM / Push** | `push.service` | `/v1/platform/push/*` |
| **Functions** | `functions.service` | `/v1/platform/functions/*` |
| **Geo** | `geo.service` | `/v1/platform/geo/*` |
| **Jobs / Queue** | `jobs.service` | `/v1/platform/jobs/*` |
| **OAuth / SSO** | `oauth.service` | `/v1/platform/oauth/*` |
| **Passkeys** | `passkey.service` | `/v1/platform/passkeys/*` |
| **Storage** | `storage.service` | `/v1/platform/storage/*` |
| **Webhooks** | `webhook.service` | `/v1/platform/webhooks/*` |
| **VCaptcha** | `vcaptcha.service` | `/v1/platform/vcaptcha/*` |
| **Capabilities** | `capabilities.service` | `/v1/platform/capabilities` |

**Key endpoints:**

```
GET  /v1/platform/capabilities          — list all capabilities with status
GET  /v1/platform/capabilities/summary  — aggregated counts by category/status
GET  /v1/platform/analytics/stats       — analytics event totals + bucket distribution
GET  /v1/platform/analytics/api-usage   — request counts by HTTP method
GET  /v1/platform/queue/stats           — job queue depth + status distribution
```

The platform layer is backed by **34 database tables** (migration
`20261126000002_platform_full`) and all services are instantiated in the
engine's context at startup.

---

## 18. Deployment

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
| `BILLING_GATEWAY` | — | Payment gateway: `paystack`, `flutterwave`, `stripe` |
| `BILLING_ENABLED` | auto | Enable billing module |
| `BILLING_CURRENCY` | ngn | Default currency for checkout |
| `PAYSTACK_SECRET_KEY` | — | Paystack secret key |
| `FLUTTERWAVE_SECRET_KEY` | — | Flutterwave secret key |
| `STRIPE_SECRET_KEY` | — | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | — | Stripe webhook signing secret |

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

## 19. Multi-Node Setup

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

## 20. API Reference

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

### Billing (`/v1/billing`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/status` | — | Check billing config + gateway |
| GET | `/plans` | Bearer | List active plans |
| GET | `/plans/:name` | Bearer | Get a single plan |
| POST | `/plans` | Admin | Create a plan |
| PATCH | `/plans/:name` | Admin | Update a plan |
| POST | `/checkout` | Bearer | Create a checkout for a plan |
| POST | `/webhooks/:gateway` | — | Receive payment gateway webhook |
| GET | `/transactions` | Bearer | List user's transactions |
| GET | `/transactions/:id` | Bearer | Get a single transaction |
| GET | `/subscription` | Bearer | Get current subscription |
| POST | `/subscription/cancel` | Bearer | Cancel subscription |
| GET | `/me` | Bearer | Current plan, credits, subscription |

### Health (`/healthz`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | — | Engine health (connections, storage, realtime) |

---

## 21. Vortex vs. the Competition

### Vortex vs. Supabase

| | Supabase | Vortex |
|---|---|---|
| **Row policies** | `auth.uid()` per row — slow at scale | Compiled once, bound as parameter — fast |
| **Query cost** | No ceiling — runs to the bill | EXPLAIN before execute, refuses over `MAX_QUERY_COST` |
| **Realtime** | Fire-and-forget — events lost on disconnect | Durable replay with `since: <seq>` |
| **Policies as data** | Postgres DDL (needs migrations to change) | Rows in a table (API-readable, diffable) |
| **Self-hosting** | Complex (requires Docker + Postgres setup) | `docker compose up -d` |
| **Image transforms** | Not built in | Cloudinary-compatible, URL-based |
| **OAuth** | Built in | Built in (9 providers + generic OIDC) |
| **SDK** | `supabase-js` (heavy, many deps) | `@nogroup/vortex` (zero-dep, fully typed) |
| **Push notifications** | Not built in | Built in (FCM) |
| **Apps hosting** | Not built in | Built in |
| **Billing & payments** | Not built in | Built in (Paystack, Flutterwave, Stripe) |
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
