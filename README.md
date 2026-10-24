<p align="center">
  <img src="assets/logo/logo.png" alt="Vortex logo" width="128" />
</p>

<h1 align="center">Vortex</h1>

<p align="center">
  <b>The high-performance Backend-as-a-Service & real-time infrastructure engine.</b><br />
  Auth · Database · Realtime · Storage — one engine, one dashboard, sub-50ms fan-out.
</p>

<p align="center">
  An <b>N.O Group</b> project · Apache-2.0 · v0.1.0 “Core Engine”
</p>

---

Vortex is an open-source BaaS in the spirit of Supabase, engineered around a
real-time sync core. Point it at PostgreSQL and you get instant REST/CRUD with
row-level security, live table-change streams over WebSockets, and a storage
gateway with presigned URLs — all behind one JWT.

**Current status: the v0.1 core engine is complete and verified with a 22-step
end-to-end suite against real PostgreSQL, and the v0.2 glassmorphic console is
live.**

## Features

| Module | Endpoint | Status |
| --- | --- | --- |
| Push Notifications | `/v1/notifications` | ✅ **v0.9** — FCM-compatible push · device registration · notification history · admin broadcast |
| Edge Cache | `/v1/storage` | ✅ **v0.9** — ETag + conditional GET · Cache-Control · auto-invalidation · stats |
| Auth Engine | `/v1/auth` | ✅ signup / login / me · JWT + custom claims · bcrypt (12 rounds) · magic links · password reset · admin user management · **OAuth (Google, GitHub, GitLab, Discord, Apple, Microsoft)** |
| Database Gateway | `/v1/db` | ✅ dynamic CRUD · filters · OR-groups · JSONB contains · embeds · RBAC + owner-scoping · **row policies (compiled once)** · **explain + cost ceiling** |
| SQL Console | `/v1/sql` | ✅ admin SQL over the engine database — parameterized, single statement, timed |
| Policy Engine | `/v1/policies` | ✅ **v0.7** — policies as data (not DDL) · compiled to bound predicates · USING + WITH CHECK · preview shows per-row equivalent · admin-only |
| Realtime Engine | `/v1/realtime` | ✅ channel pub/sub · table-change fan-out (measured ~4ms) · room broadcast · presence · **durable replay** (seq + `since`) · Redis multi-node bridge |
| Query Governance | `/v1/insights` | ✅ **v0.7** — EXPLAIN before execute · cost ceiling (429 `query_too_expensive`) · slow/refused audit log · admin-only |
| Storage Gateway | `/v1/storage` | ✅ buckets (public/private) · local disk + S3/R2/MinIO · presigned up/download |
| Apps Hosting | `/v1/apps` + `/apps/:name/*` | ✅ deploy static web apps — file manifest, SPA fallback, public serving |
| Vortex Functions | `/functions/:name` | ✅ server functions run by the engine — deploy source, invoke over HTTP, wall-clock budget |
| Dashboard Console | `apps/vortex-dashboard` | ✅ glassmorphic admin UI — vitals, DB explorer, SQL console, event stream + rooms, storage, apps, functions, auth admin, **policy editor with live SQL preview** |
| Dart/Flutter SDK | `packages/sdk-dart` | ✅ auth/db/realtime/storage client + N.O Group design system + UI controllers* |
| TypeScript/JS SDK | `packages/sdk-typescript` | ✅ **v0.7** — zero-dep client for auth, database, realtime, storage, functions, apps, admin · image transforms · auto-retry · durable realtime replay |

\* Dart code is authored in-repo; verify with a local Flutter SDK (`flutter pub get && flutter test`).

## Why Vortex, not Supabase?

Three things Vortex does that Supabase structurally cannot:

### 1. Policies compile once — never per row

Supabase row policies call `auth.uid()` for every candidate row. Their own
performance guide tells you to hand-wrap it as `owner_id = (select auth.uid())`
by hand — a footgun every new user hits once.

Vortex resolves identity to a literal **once**, at compile time, and binds it
as a query parameter:

```
Supabase:  owner_id = auth.uid()                    ← evaluated per row
Vortex:    "owner_id" = $3   bindings: ["7f3e…"]    ← constant, indexable
```

The console's **Policy** page shows both forms side by side, so you can see
the difference without reading source.

### 2. Queries are measured before they run

Supabase will run an accidental full-table scan to completion and bill you
for it. Vortex EXPLAINs every query first. When `MAX_QUERY_COST` is set,
queries above the ceiling are refused with `429 query_too_expensive` and
the measured cost — so you fix the problem (usually: add the index the plan
summary names) instead of discovering it on the invoice.

### 3. Realtime that survives a disconnect

Fire-and-forget realtime drops everything that happens while a client is
disconnected. Vortex stamps every event with a per-channel sequence number
and keeps a bounded backlog. A client that reconnects with `since: <seq>`
is replayed what it missed — and told when the gap was too long to cover.

## TypeScript / JavaScript SDK

```bash
npm install @vortex/client
```

One import, the whole platform — zero-dependency (uses `fetch` + `WebSocket`):

```ts
import { VortexClient } from '@vortex/client';

const vortex = new VortexClient({ url: 'https://your-vortex.example.com' });

// ── Auth ──────────────────────────────────────────────────────────────
const session = await vortex.auth.signup({ email, password });
// or: await vortex.auth.login({ email, password });
// or: const result = await vortex.auth.requestMagicLink(email);

// ── Database (fluent query builder) ───────────────────────────────────
const notes = await vortex.database
  .from('notes')
  .select(['id', 'title', 'body'])
  .filter('owner_id', 'eq', session.user.id)
  .orderBy('created_at', 'desc')
  .limit(10)
  .countTotal()       // returns total matching (not just page)
  .execute();

// OR-groups, embeds, explain:
const result = await vortex.database.from('projects')
  .or([
    [{ column: 'status', value: 'active' }],
    [{ column: 'owner_id', valueRef: 'user.id' }, { column: 'public', value: true }],
  ])
  .include({ table: 'tasks', localKey: 'id', foreignKey: 'project_id', as: 'tasks' })
  .explain()          // returns planner cost + plan summary
  .execute();

// ── Realtime (durable replay built in) ─────────────────────────────────
const rt = vortex.connectRealtime(session.token, {
  onTableChange: (event) => console.log(event.action, event.rows),
  onReplay: (info) => console.log(`Replayed ${info.count} events`),
});
rt.subscribe('table:notes');
rt.subscribe('room:lobby');
rt.track('room:lobby', { name: 'Alice' });

// ── Storage (with Cloudinary-style image transforms) ──────────────────
await vortex.storage.upload('uploads', file, 'avatar.png');

// Image transforms — resize, crop, convert format, all on the fly:
const avatarUrl = vortex.storage.imageUrl('public', 'avatar.png', {
  w: 200, h: 200, fit: 'cover', fmt: 'webp', quality: 85, crop: 'face',
});
// → /v1/storage/public/avatar.png?w=200&h=200&fit=cover&fmt=webp&quality=85&crop=face
// The gateway applies transforms with sharp and caches results.

// ── Functions ─────────────────────────────────────────────────────────
await vortex.functions.deploy('hello', `
  export default async function(ctx) {
    return { message: 'Hello ' + ctx.data.name };
  }
`);
const result = await vortex.functions.invoke('hello', { name: 'world' });

// ── Apps (host static sites) ───────────────────────────────────────────
await vortex.apps.create('my-app', 'My App');
await vortex.apps.uploadFile('my-app', 'index.html', htmlContent);
// → Live at /apps/my-app/

// ── Admin (SQL, policies, insights) ────────────────────────────────────
await vortex.admin.sql('select * from users limit 5');
await vortex.admin.createPolicy({
  name: 'notes are private',
  tableName: 'notes',
  action: 'select',
  roles: ['user'],
  using: { column: 'owner_id', valueRef: 'user.id' },
});
const preview = await vortex.admin.previewPolicy({
  tableName: 'notes', action: 'select', role: 'user',
});
// → Shows compiled SQL vs per-row equivalent
```

**SDK features:**
- `VortexApiError` — typed errors with `status`, `code`, `details`
- Auto-retry on 5xx with exponential backoff
- Token auto-attached to all requests after signup/login
- Realtime auto-reconnect with resume cursors (replays missed events)
- Query builder with filters, OR-groups, embeds, countTotal, explain
- Storage with image transforms (`w`, `h`, `fit`, `fmt`, `quality`, `crop`, `grayscale`, `rotate`, `padding`, etc.)
- Works in browser and Node.js 18+

## Complete Guide

**[docs/HOWTO.md](docs/HOWTO.md)** — the full "how to use" guide. 20 sections covering everything from quick start to multi-node deployment, with API references, code examples, and a comparison against Supabase, Firebase, Cloudflare, and Cloudinary.

## Deploy to Production

**[docs/DEPLOY.md](docs/DEPLOY.md)** — full production deployment guide. Server setup, domain + SSL, Caddy reverse proxy, database, backups, security checklist, and troubleshooting.

## Launch (go live)

One container serves the whole platform — console, API, hosted apps, and
functions — on a single port. The complete playbook (**what to rent, what to
type, domains, TLS, storage, email, backups, costs**) lives in
**[docs/DEPLOY.md](docs/DEPLOY.md)**. The 30-second version:

```bash
git clone https://github.com/NO-Group/Vortex.git && cd Vortex
cp .env.example .env          # set JWT_SECRET (the engine enforces it in prod)
docker compose up -d --build  # console + API on http://localhost:8080
npm run admin -- promote you@example.com   # make yourself admin
```

Production notes: serve TLS with Caddy in front (auto-HTTPS), switch storage
to any S3-compatible service (Cloudflare R2 is the best deal), and set
`SMTP_URL` so magic sign-in links land in real inboxes. Details and a go-live
checklist: [docs/DEPLOY.md](docs/DEPLOY.md).

## Repository layout

```
vortex/
├── apps/
│   ├── vortex-server/       # Core API gateway & real-time sync engine (TypeScript)
│   └── vortex-dashboard/    # Glassmorphic admin web console (React + Tailwind)
├── packages/
│   ├── vortex-core/         # Shared types, wire protocol, N.O Group brand tokens
│   └── sdk-dart/            # Official Vortex Flutter/Dart SDK + design system
├── scripts/
│   ├── e2e-smoke.mjs        # Full end-to-end smoke suite (embedded Postgres)
│   └── preview-stack.mjs    # Self-contained live demo stack (PG + engine + seed)
├── docker-compose.yml       # Local Postgres + Redis + MinIO + engine
└── docs/blueprint.md        # Original founding design spec
```

## Tech stack

- **Runtime** — Node.js 20+ / TypeScript (strict), ESM
- **HTTP** — Express 4 + helmet + CORS + zod validation
- **Database** — PostgreSQL via Knex.js (migrations, JSONB, `RETURNING *`)
- **Realtime** — `ws` WebSocket hub with channel pub/sub and heartbeat sweep;
  optional Redis pub/sub bridge (`REDIS_URL`) makes a cluster of engines behave
  as one realtime fabric (echo-suppressed, local fan-out stays on the fast path)
- **Storage** — local-disk driver (HMAC presigned URLs) · AWS S3 SDK for S3/R2/MinIO
- **Auth** — jsonwebtoken + bcryptjs · role-based access control with owner-scoped rows
- **Apps** — deploy static web apps (SPA fallback) — live at `/apps/<name>/`
- **SDK** — Dart/Flutter client (`vortex_client`) with the N.O Group design system

## Quickstart

### With Docker (recommended)

```bash
git clone https://github.com/NO-Group/Vortex.git && cd Vortex
cp .env.example .env
docker compose up -d          # Postgres + Redis + MinIO + vortex-server
curl localhost:8080/healthz   # → {"status":"ok","engine":"vortex",...}
```

### Local development

```bash
npm install                   # workspace install (builds @vortex/core)
docker compose up -d postgres # just the database (or point DATABASE_URL elsewhere)
cp .env.example .env
npm run dev                   # engine → http://localhost:8080
npm run dev:dashboard         # console → http://localhost:5173 (proxies /v1 → :8080)
```

No Docker? The self-contained demo stack runs the engine on an embedded
Postgres with seeded data:

```bash
npm install && npm run build
npm run preview:stack         # engine + demo account (sensei@no.group / vortex-secret-1)
npm run dev:dashboard         # console on :5173
```

### The Vortex Console

The dashboard is the glassmorphic admin console from the design spec —
controlled glassmorphism over the AMOLED canvas:

- **Command Center** — live vitals for every engine module (auth, database,
  realtime, storage) with skeletons & status pulses
- **Database explorer** — dynamic query builder, crisp data grid, quick
  insert/delete with live RBAC feedback
- **Live Stream** — pitch-black engine console showing table-change events
  as they fan out (with measured latency)
- **Storage browser** — drag-drop uploads, presigned GET links, object management
- **Auth & Token** — session + decoded JWT claims inspector

Demo account for the preview stack: `sensei@no.group` / `vortex-secret-1`
(or create your own via the login screen).

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | watch-mode engine on `:8080` |
| `npm run dev:dashboard` | Vite console on `:5173` with `/v1` + `/apps` proxy |
| `npm run build` | compile `@vortex/core`, server, and dashboard |
| `npm run test` | unit suite (71 tests) |
| `npm run typecheck` | strict TypeScript across the workspace |
| `npm run migrate` | run knex migrations |
| `npm run admin` | admin CLI — `list` / `promote` / `demote` accounts |
| `npm run smoke` | full 68-step E2E suite vs embedded Postgres |
| `npm run preview:stack` | self-contained live demo (PG + engine + seed data) |

## API reference

All routes are JSON under `/v1`. Authenticate with `Authorization: Bearer <JWT>`.

### Auth — `/v1/auth`

```bash
# Register (201 → session + JWT)
curl -X POST localhost:8080/v1/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"you@no.group","password":"long-enough-pass","metadata":{"team":"core"}}'

# Login (200 → session + JWT)
curl -X POST localhost:8080/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"you@no.group","password":"long-enough-pass"}'

# Profile
curl localhost:8080/v1/auth/me -H "authorization: Bearer $TOKEN"
```

Passwordless sign-in, recovery, and account administration:

```bash
# Magic link (in dev-links mode the token is returned inline)
curl -X POST localhost:8080/v1/auth/magic-link \
  -H 'content-type: application/json' -d '{"email":"you@no.group"}'
curl -X POST localhost:8080/v1/auth/magic-link/verify \
  -H 'content-type: application/json' -d '{"token":"<devToken>"}'   # → session

# Password reset
curl -X POST localhost:8080/v1/auth/password-reset \
  -H 'content-type: application/json' -d '{"email":"you@no.group"}'
curl -X POST localhost:8080/v1/auth/password-reset/confirm \
  -H 'content-type: application/json' \
  -d '{"token":"<devToken>","password":"new-secret-1"}'               # → session

# Admin: list accounts, set roles / custom claims (land in new JWTs as "meta")
curl localhost:8080/v1/auth/users -H "authorization: Bearer $ADMIN_TOKEN"
curl -X PATCH localhost:8080/v1/auth/users/<id> -H "authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' -d '{"role":"admin","metadata":{"plan":"pro"}}'
```

### Database — `/v1/db/:table`

CRUD with dynamic filters (`eq neq gt gte lt lte like ilike in is contains`),
OR-groups, multi-column ordering, total counts, and explicit embeds. Every
mutation is broadcast to realtime subscribers. RBAC grants come from the
`table_permissions` table; rows with an `owner_column` are automatically
scoped to the caller.

```bash
# Insert (owner_id is auto-filled from the JWT)
curl -X POST localhost:8080/v1/db/notes \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"rows":[{"title":"hello","body":{"tags":["v0.1"]}}]}'

# Query — filters, OR-groups, embeds, total count
curl -X POST localhost:8080/v1/db/notes/query \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"filters":[{"column":"title","op":"ilike","value":"%hel%"}],
       "or":[[{"column":"pinned","value":true}],[{"column":"archived","value":false}]],
       "include":[{"table":"users","localKey":"owner_id","foreignKey":"id","as":"author",
                   "select":["id","email"]}],
       "countTotal":true,"limit":10}'

# Update / delete (filters are mandatory on delete)
curl -X PATCH localhost:8080/v1/db/notes \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"patch":{"title":"renamed"},"filters":[{"column":"id","value":"<uuid>"}]}'
```

### Realtime — `ws://host/v1/realtime`

```js
const ws = new WebSocket('ws://localhost:8080/v1/realtime?token=' + JWT);

ws.onopen = () => ws.send(JSON.stringify({ type: 'vortex:subscribe', channel: 'table:notes' }));

ws.onmessage = (frame) => {
  const msg = JSON.parse(frame.data);
  // { type: 'vortex:event', action: 'INSERT', table: 'notes', rows: [...], ... }
};
```

Protocol frames: `vortex:auth`, `vortex:subscribe`, `vortex:unsubscribe`,
`vortex:ping`, `vortex:broadcast`, `vortex:presence` → answered with
`vortex:welcome`, `vortex:ack`, `vortex:pong`, `vortex:event`, `vortex:broadcast`,
`vortex:presence_sync`, `vortex:presence_diff`, `vortex:error`. Channels follow
`table:<name>`, `table:*`, or `room:<name>` — rooms carry ephemeral
**broadcasts** (pub/sub) and **presence** (who is here, with small state).

### Storage — `/v1/storage`

Object keys live in **buckets**: `uploads/…` (private) and `public/…` (public)
exist by default; create your own. Public buckets are readable anonymously at
`/v1/storage/public/<bucket>/<path>`.

```bash
# 0. Create a bucket (public is optional)
curl -X POST localhost:8080/v1/storage/buckets \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"assets","public":true}'

# 1. Presign a direct upload (local driver → HMAC token URL, S3 → bucket URL)
curl -X POST localhost:8080/v1/storage/presign-upload \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"key":"assets/report.pdf","contentType":"application/pdf"}'

# 2. PUT the bytes straight to the returned URL
curl -X PUT --data-binary @report.pdf "$PRESIGNED_URL"

# 3. Presign a download / delete
curl -X POST localhost:8080/v1/storage/presign-download \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"key":"uploads/report.pdf"}'
```

### Apps — `/v1/apps` (deploy) + `/apps/:name/*` (serve)

Vortex can carry apps: deploy any static web build (Vite, Next export,
Flutter web, plain HTML) and it is served live with SPA routing.

```bash
# 1. Create an app (name is a URL slug: lowercase, digits, dashes)
curl -X POST localhost:8080/v1/apps \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"my-next-app","title":"My Next App"}'

# 2. Deploy files (repeat per file; paths are app-relative)
curl -X POST "localhost:8080/v1/apps/my-next-app/files?path=index.html" \
  -H "authorization: Bearer $TOKEN" -H 'content-type: text/html' \
  --data-binary @dist/index.html

# 3. Visit it — live at /apps/my-next-app/ (extension-less routes fall
#    back to index.html, so client-side routing works out of the box)
```

The console **Apps** page does all of this with drag-and-drop: create an app,
drop a build folder, hit *Open*. The live demo ships with `/apps/welcome/`.

### SQL Console — `POST /v1/sql` (admins)

Raw SQL against the engine database for migrations, analytics, and ops —
parameterized (`$1..$n` or `?`), single statement, 10s timeout.

```bash
curl -X POST localhost:8080/v1/sql \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -d '{"sql":"select id, email, role from users where role = $1","params":["admin"]}'
# → { "columns": [...], "rows": [...], "rowCount": 1, "durationMs": 2 }
```

### Vortex Functions — `/v1/functions` (deploy) + `/functions/:name` (invoke)

Server functions executed by the engine — a function source is an
`async (req, ctx)` expression returning an HTTP response (or any JSON value):

```js
// deployed source
async (req, ctx) => {
  // req: { method, path, query, headers, body, user }
  // ctx: { data: { query, insert, update, delete }, storage, env }
  const rows = await ctx.data.query('notes', { limit: 5, countTotal: true });
  return { status: 200, body: { hello: req.query.name ?? 'world', total: rows.total } };
}
```

```bash
# Deploy
curl -X POST localhost:8080/v1/functions \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"hello","title":"Hello","source":"async (req) => ({ body: { hi: 1 } })"}'

# Invoke — public, with optional JWT for identity
curl "localhost:8080/functions/hello?name=vortex" -H "authorization: Bearer $TOKEN"
```

Functions run with a 5s wall-clock budget (`508 function_timeout` beyond it),
can be paused (`status: "paused"` → 404), and are **operator code**: the `ctx`
helpers execute with service-level access. The live demo ships with
`/functions/pulse`. Manage and run them from the console **Functions** page.

## Client SDK (Dart / Flutter)

`packages/sdk-dart` is the official client — one facade for every gateway,
plus the N.O Group design system for app UIs:

```dart
final vortex = VortexClient(baseUrl: 'http://localhost:8080');
await vortex.auth.signIn(email: 'a@b.co', password: '…');

final notes = await vortex.db.from('notes').like('title', '%engine%').limit(10).execute();

vortex.realtime.connect();
vortex.realtime.channel('table:notes').subscribe();
vortex.realtime.onEvent.listen((e) => print('${e.action} ${e.table}'));

MaterialApp(theme: VortexTheme.dark(), …);   // pure dark canvas + spectrum
```

See [`packages/sdk-dart/README.md`](packages/sdk-dart/README.md) for the full
API, glass widgets, and kinetic CTA components.

## Design system — N.O Group “Pure Dark Canvas”

The dashboard theme is locked to the brand tokens in
[`packages/vortex-core/src/brand.ts`](packages/vortex-core/src/brand.ts)
(TypeScript mirror of the Dart `NOGroupDesignSystem`):

| Token | Hex | Role |
| --- | --- | --- |
| `pureBlackCanvas` | `#000000` | deepest AMOLED canvas |
| `surfaceElevatedDark` | `#090C10` | cards / panels |
| `structuralBorderDark` | `#161B22` | crisp layout borders |
| `anchorBlue` | `#004BFF` | gradient stop 0.0 |
| `iridescentLavender` | `#A38CFF` | gradient stop 0.2 |
| `coralPink` | `#FFA1C5` | gradient stop 0.4 |
| `cyberCyan` | `#00D2FF` | gradient stop 0.6 |
| `neonMint` | `#00E6A6` | gradient stop 0.8 |
| `flagshipTechGreen` | `#1BFF6B` | gradient stop 1.0 |
| `interactiveFocusBlue` | `#3379FF` | focus rings |
| `interactiveSuccessGreen` | `#00FF66` | live WebSocket status |

Controlled glassmorphism: frosted structural chrome (sidebar, wrappers) over the
pure-black canvas; data-heavy surfaces (logs, SQL, tables) stay solid and sharp.

## Multi-node realtime

Set `REDIS_URL=redis://…` on any number of engines and they form a single
realtime fabric: database mutations fan out to subscribers on every node
with echo suppression (each change is delivered exactly once per node).
Without `REDIS_URL`, fan-out is purely in-process — zero extra infrastructure.

## Roadmap

- ~~**v0.2** — `vortex-dashboard`: glassmorphic admin console~~ ✅ shipped
- ~~**v0.3** — `sdk-dart` Flutter/Dart client + SDK UI controllers~~ ✅ shipped
- ~~**v0.4** — Redis pub/sub bridge for multi-node realtime fan-out~~ ✅ shipped
- ~~**v0.5** — Vortex Apps: deploy & host static web apps from the console~~ ✅ shipped
- ~~**v0.6** — Platform parity: SQL console, Vortex Functions, magic links + password
  reset + account admin, custom claims, storage buckets, room broadcast + presence,
  relational query upgrades (embeds, OR, counts)~~ ✅ shipped
- ~~**v0.7** — Policy Engine, Query Governance, Durable Realtime, TS/JS SDK~~ ✅ shipped (4 of 5)
  - **Policy Engine** — row policies as data (not DDL), compiled to a single bound
    predicate. `valueRef: 'user.id'` resolves to a literal ONCE and binds as a
    parameter — no `auth.uid()` per row. The console preview shows both forms side by side.
  - **Query Governance** — every query is EXPLAINed before execution; costs above
    `MAX_QUERY_COST` are refused (429 `query_too_expensive`) with the measured cost.
    Slow/refused queries are audited for the insights view.
  - **Durable Realtime** — every event carries a per-channel `seq`. A reconnecting
    client resumes with `since: <seq>` and is replayed what it missed.
  - **TypeScript/JS SDK** (`@vortex/client`) — zero-dependency, fully typed. Auth,
    database (fluent query builder), realtime (durable replay), storage (with image
    transforms), functions, apps, admin. Works in browser and Node.js 18+.
  - **Image Transforms** — Cloudinary-compatible URL-based transforms (resize, crop,
    format conversion, quality, grayscale, rotate, padding) powered by sharp, with
    on-disk caching. Append `?w=800&h=600&fit=cover&fmt=webp` to any public image URL.
  - Remaining: multi-provider auth extensions.
- ~~**v0.8** — OAuth providers~~ ✅ shipped
  - **OAuth Login** — sign in with Google, GitHub, GitLab, Discord, Apple, Microsoft.
    Admins configure providers via the console (`/v1/auth/oauth/admin/providers`).
    Users see "Sign in with…" buttons. OAuth accounts auto-link to Vortex users
    (by email or provider ID); new users are auto-created from OAuth profiles.
    SDK: `vortex.auth.listOAuthProviders()`, `vortex.auth.handleOAuthCallback()`.
  - Next: multi-provider auth extensions.
- ~~**v0.9** — Push Notifications + Edge Cache + Complete Guide~~ ✅ shipped
  - **Push Notifications** — FCM-compatible push delivery. Device registration,
    notification history, stats, admin broadcast. Set `FCM_SERVER_KEY` for real
    delivery; without it, notifications are recorded as "pending".
  - **Edge Cache** — Cloudflare CDN parity. ETag generation, conditional GET
    (If-None-Match → 304), Cache-Control headers, auto-invalidation on writes,
    cache statistics, disk persistence for warm restarts.
  - **Complete Guide** (`docs/HOWTO.md`) — 20-section "how to use" guide covering
    everything from quick start to multi-node deployment, with API references,
    code examples, and comparisons against Supabase, Firebase, Cloudflare, and
    Cloudinary.
  - Next: multi-provider auth extensions, edge workers, Web Push.

## License

Apache-2.0 — see [LICENSE](LICENSE).

Founding design spec: [docs/blueprint.md](docs/blueprint.md).
