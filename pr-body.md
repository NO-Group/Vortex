## Summary

Scaffolds the complete Vortex BaaS platform from scratch — a high-performance Backend-as-a-Service engine with a glassmorphic web console, built on the N.O Group design system.

## What's Included

### @vortex/core — Shared Package
- Shared TypeScript types (User, JWT, Query, Storage, Realtime)
- JWT token generation/verification with access + refresh tokens
- bcrypt password hashing utilities

### @vortex/server — Backend Engine
- **Auth Gateway**: signup, login, and `/me` endpoints with bcrypt + JWT
- **Database API**: dynamic CRUD over PostgreSQL via Knex with RBAC (select/insert/update/delete), query filters, pagination, and ordering
- **Storage Controller**: local disk driver with HMAC-signed presigned upload/download URLs, owner-scoped object management, and path traversal protection
- **Realtime WebSocket Hub**: pub/sub architecture for table change events (insert/update/delete) with sub-50ms broadcast
- Modular Express app with Helmet, CORS, compression, Zod validation, and centralized error handling

### @vortex/dashboard — Glassmorphic Console
- Vite + React + Tailwind CSS
- **Login/Signup page** implementing the N.O Group design system:
  - AMOLED pure black canvas with layered radial mesh gradients
  - Frosted glass panels with translucent borders
  - 6-stop chromatic gradient palette (anchor blue → iridescent lavender → coral pink → cyber cyan → neon mint → tech green)
  - Animated spinning Vortex logo with glow
  - Floating ambient glow orbs and subtle grid overlay
  - Gradient CTA buttons with hover glow, slide-up/fade-in animations
  - Glass pill toggle for Sign In / Sign Up switching

## Build
- All three packages build clean with `npm run build`
- Dashboard serves HTTP 200 and runs in dev mode on port 3000

## Tech Stack
- Node.js + TypeScript (server)
- React + Vite + Tailwind CSS (dashboard)
- PostgreSQL via Knex.js
- WebSocket (ws) for realtime
- Cloudflare R2 compatible storage abstraction
