# Vortex Server — Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/vortex-server/package.json ./apps/vortex-server/
COPY packages/vortex-core/package.json ./packages/vortex-core/

RUN npm ci

COPY packages/vortex-core ./packages/vortex-core
COPY apps/vortex-server ./apps/vortex-server

RUN npm run build -w @vortex/core && npm run build -w @vortex/server

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/vortex-server ./apps/vortex-server
COPY --from=builder /app/packages/vortex-core ./packages/vortex-core
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/vortex-server/package.json ./apps/vortex-server/
COPY --from=builder /app/packages/vortex-core/package.json ./packages/vortex-core/

EXPOSE 4000

CMD ["node", "apps/vortex-server/dist/index.js"]
