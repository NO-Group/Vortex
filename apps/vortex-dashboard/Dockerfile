# Vortex Dashboard — Dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/vortex-dashboard/package.json ./apps/vortex-dashboard/
COPY packages/vortex-core/package.json ./packages/vortex-core/

RUN npm ci

COPY packages/vortex-core ./packages/vortex-core
COPY apps/vortex-dashboard ./apps/vortex-dashboard

RUN npm run build -w @vortex/dashboard

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/vortex-dashboard ./apps/vortex-dashboard
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/vortex-dashboard/package.json ./apps/vortex-dashboard/

WORKDIR /app/apps/vortex-dashboard

EXPOSE 3000

CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
