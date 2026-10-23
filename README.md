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
| Auth Engine | `/v1/auth` | ✅ signup / login / me · JWT · bcrypt (12 rounds) |
| Database Gateway | `/v1/db` | ✅ dynamic CRUD · filters · JSONB · RBAC + owner-scoping |
| Realtime Engine | `/v1/realtime` | ✅ channel pub/sub · table-change fan-out (measured ~4ms) · Redis multi-node bridge |
| Storage Gateway | `/v1/storage` | ✅ local disk + S3/R2/MinIO · presigned up/download |
| Dashboard Console | `apps/vortex-dashboard` | ✅ glassmorphic admin UI — live engine vitals, DB explorer, event stream, storage browser |
| Dart/Flutter SDK | `packages/sdk-dart` | ✅ auth/db/realtime/storage client + N.O Group design system + UI controllers* |

\* Dart code is authored in-repo; verify with a local Flutter SDK (`flutter pub get && flutter test`).

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
| `npm run dev:dashboard` | Vite console on `:5173` with `/v1` proxy |
| `npm run build` | compile `@vortex/core`, server, and dashboard |
| `npm run test` | unit suite (40 tests) |
| `npm run typecheck` | strict TypeScript across the workspace |
| `npm run migrate` | run knex migrations |
| `npm run smoke` | full 22-step E2E suite vs embedded Postgres |
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

### Database — `/v1/db/:table`

CRUD with dynamic filters (`eq neq gt gte lt lte like in is`), ordering, and
pagination. Every mutation is broadcast to realtime subscribers. RBAC grants
come from the `table_permissions` table; rows with an `owner_column` are
automatically scoped to the caller.

```bash
# Insert (owner_id is auto-filled from the JWT)
curl -X POST localhost:8080/v1/db/notes \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"rows":[{"title":"hello","body":{"tags":["v0.1"]}}]}'

# Query
curl -X POST localhost:8080/v1/db/notes/query \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"filters":[{"column":"title","op":"like","value":"%hel%"}],"limit":10}'

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
`vortex:ping` → answered with `vortex:ack`, `vortex:pong`, `vortex:event`,
`vortex:error`. Channels follow `table:<name>` or `table:*` (wildcard).

### Storage — `/v1/storage`

```bash
# 1. Presign a direct upload (local driver → HMAC token URL, S3 → bucket URL)
curl -X POST localhost:8080/v1/storage/presign-upload \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"key":"uploads/report.pdf","contentType":"application/pdf"}'

# 2. PUT the bytes straight to the returned URL
curl -X PUT --data-binary @report.pdf "$PRESIGNED_URL"

# 3. Presign a download / delete
curl -X POST localhost:8080/v1/storage/presign-download \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"key":"uploads/report.pdf"}'
```

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
- **v0.5** — Edge functions, custom claims, row policies UI

## License

Apache-2.0 — see [LICENSE](LICENSE).

Founding design spec: [docs/blueprint.md](docs/blueprint.md).
