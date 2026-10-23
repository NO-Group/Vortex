# ── Vortex server image ──────────────────────────────────────────────────────
# Build context: apps/vortex-server  (workspace root is copied for @vortex/core)

# Stage 1: build workspace
FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY packages/vortex-core/package.json packages/vortex-core/
COPY apps/vortex-server/package.json apps/vortex-server/
RUN npm install --workspaces --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/vortex-core packages/vortex-core
COPY apps/vortex-server apps/vortex-server
RUN npm run build -w @vortex/core && npm run build -w @vortex/server

# Stage 2: runtime
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/package.json ./
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/vortex-core ./packages/vortex-core
COPY --from=build /workspace/apps/vortex-server/package.json ./apps/vortex-server/
COPY --from=build /workspace/apps/vortex-server/dist ./apps/vortex-server/dist
EXPOSE 8080
CMD ["node", "apps/vortex-server/dist/index.js"]
