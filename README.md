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
| Auth Engine | `/v1/auth` | ✅ signup / login / me · JWT + custom claims · bcrypt (12 rounds) · magic links · password reset · admin user management |
| Database Gateway | `/v1/db` | ✅ dynamic CRUD · filters · OR-groups · JSONB contains · embeds · RBAC + owner-scoping |
| SQL Console | `/v1/sql` | ✅ admin SQL over the engine database — parameterized, single statement, timed |
| Realtime Engine | `/v1/realtime` | ✅ channel pub/sub · table-change fan-out (measured ~4ms) · room broadcast · presence · Redis multi-node bridge |
| Storage Gateway | `/v1/storage` | ✅ buckets (public/private) · local disk + S3/R2/MinIO · presigned up/download |
| Apps Hosting | `/v1/apps` + `/apps/:name/*` | ✅ deploy static web apps — file manifest, SPA fallback, public serving |
| Vortex Functions | `/functions/:name` | ✅ server functions run by the engine — deploy source, invoke over HTTP, wall-clock budget |
| Dashboard Console | `apps/vortex-dashboard` | ✅ glassmorphic admin UI — vitals, DB explorer, SQL console, event stream + rooms, storage, apps, functions, auth admin |
| Dart/Flutter SDK | `packages/sdk-dart` | ✅ auth/db/realtime/storage client + N.O Group design system + UI controllers* |

\* Dart code is authored in-repo; verify with a local Flutter SDK (`flutter pub get && flutter test`).

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
- **v0.7** — TypeScript/JS client SDK, row-policy editor UI, OAuth providers, image transforms

## License

Apache-2.0 — see [LICENSE](LICENSE).

Founding design spec: [docs/blueprint.md](docs/blueprint.md).
