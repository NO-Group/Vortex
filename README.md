# Vortex
##File Structure Blueprint:
vortex/
├── apps/
│   ├── vortex-server/      # Core API Gateway & Real-Time Sync Engine
│   └── vortex-dashboard/   # Glassmorphic Admin Web Console
├── packages/
│   ├── vortex-core/        # Shared Auth, Database Drivers & Logic
│   └── sdk-dart/           # Official Vortex Flutter / Dart Client SDK
├── docker-compose.yml      # Local Postgres, Redis, and MinIO/Local Storage
└── README.md

##Tech Stack Blueprint:
​Core Backend Engine: Node.js + TypeScript (or Go for high-throughput WebSockets).
​Database Layer: PostgreSQL with Knex.js / Prisma ORM for structured queries and JSON support.
​Real-time Layer: WebSocket server (using ws or Socket.io) handling channel pub/sub.
​Storage Gateway: AWS S3 SDK pointed at Cloudflare R2 or local disk storage.
​Dashboard Console: Next.js / React with Tailwind CSS (styled using N.O Group's

##Initial Prompt Blueprint for Arena
Arena Prompt — Task 1: Building Vortex Core Engine v0.1
​"We are building Vortex, an open-source, high-performance Backend-as-a-Service (BaaS) under N.O Group.
​Please scaffold the vortex-server core engine in TypeScript with the following modules:
​Auth Engine: JWT token generation, bcrypt password hashing, and user registration/login endpoints (/v1/auth/signup, /v1/auth/login).
​Database Gateway: A dynamic CRUD handler over PostgreSQL that allows querying, inserting, and updating tables with role-based permission checks.
​Real-time WebSocket Hub: A WebSocket server that allows clients to subscribe to table changes (vortex:subscribe -> table_name) and broadcasts live events on database inserts/updates.
​Storage Controller: An abstraction interface for file uploads supporting local disk saving and S3/Cloudflare R2 endpoints.
​Ensure all code is modular, well-typed, and formatted cleanly across separate service files."
