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

**Current status: `vortex-server` core engine v0.1.0 is complete and verified
with a 22-step end-to-end suite against real PostgreSQL.**

## Features

| Module | Endpoint | Status |
| --- | --- | --- |
| Auth Engine | `/v1/auth` | ✅ signup / login / me · JWT · bcrypt (12 rounds) |
| Database Gateway | `/v1/db` | ✅ dynamic CRUD · filters · JSONB · RBAC + owner-scoping |
| Realtime Engine | `/v1/realtime` | ✅ channel pub/sub · table-change fan-out (measured ~4ms) |
| Storage Gateway | `/v1/storage` | ✅ local disk + S3/R2/MinIO · presigned up/download |
| Dashboard Console | `apps/vortex-dashboard` | 🔜 glassmorphic admin UI (design tokens ready) |
| Dart/Flutter SDK | `packages/sdk-dart` | 🔜 planned |

## Repository layout

```
vortex/
├── apps/
│   ├── vortex-server/       # Core API gateway & real-time sync engine (TypeScript)
│   └── vortex-dashboard/    # Glassmorphic admin web console (planned)
├── packages/
│   ├── vortex-core/         # Shared types, wire protocol, N.O Group brand tokens
│   └── sdk-dart/            # Official Vortex Flutter/Dart client SDK (planned)
├── scripts/
│   └── e2e-smoke.mjs        # Full end-to-end smoke suite (embedded Postgres)
├── docker-compose.yml       # Local Postgres + Redis + MinIO + engine
└── docs/blueprint.md        # Original founding design spec
```

## Tech stack

- **Runtime** — Node.js 20+ / TypeScript (strict), ESM
- **HTTP** — Express 4 + helmet + CORS + zod validation
- **Database** — PostgreSQL via Knex.js (migrations, JSONB, `RETURNING *`)
- **Realtime** — `ws` WebSocket hub with channel pub/sub and heartbeat sweep
- **Storage** — local-disk driver (HMAC presigned URLs) · AWS S3 SDK for S3/R2/MinIO
- **Auth** — jsonwebtoken + bcryptjs · role-based access control with owner-scoped rows

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
npm run dev                   # tsx watch → http://localhost:8080
```

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | watch-mode engine on `:8080` |
| `npm run build` | compile `@vortex/core` + `@vortex/server` |
| `npm run test` | unit suite (34 tests) |
| `npm run typecheck` | strict TypeScript across the workspace |
| `npm run migrate` | run knex migrations |
| `npm run smoke` | full E2E suite vs embedded Postgres (needs `npm i --no-save embedded-postgres`) |

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

## Roadmap

- **v0.2** — `vortex-dashboard`: glassmorphic admin console (auth, table
  explorer, live event stream, storage browser)
- **v0.3** — `sdk-dart` Flutter/Dart client + SDK UI controllers on the brand tokens
- **v0.4** — Redis pub/sub bridge for multi-node realtime fan-out
- **v0.5** — Edge functions, custom claims, row policies UI

## License

Apache-2.0 — see [LICENSE](LICENSE).

Founding design spec: [docs/blueprint.md](docs/blueprint.md).
