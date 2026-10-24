# ── Vortex platform image ─────────────────────────────────────────────────────
# One container = engine + console + apps + functions on :8080.
# Build:  docker build -t vortex .
# Run:    docker run -p 8080:8080 --env-file .env -v vortex-data:/workspace/.vortex-data vortex

# Stage 1: build core + engine + console
FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json* ./
COPY packages/vortex-core/package.json packages/vortex-core/
COPY apps/vortex-server/package.json apps/vortex-server/
COPY apps/vortex-dashboard/package.json apps/vortex-dashboard/
RUN npm install --workspaces --include-workspace-root
COPY tsconfig.base.json ./
COPY packages/vortex-core packages/vortex-core
COPY apps/vortex-server apps/vortex-server
COPY apps/vortex-dashboard apps/vortex-dashboard
RUN npm run build -w @vortex/core \
  && npm run build -w @vortex/server \
  && npm run build -w @vortex/dashboard

# Stage 2: runtime
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/packages/vortex-core ./packages/vortex-core
COPY --from=build /workspace/apps/vortex-server/package.json ./apps/vortex-server/package.json
COPY --from=build /workspace/apps/vortex-server/dist ./apps/vortex-server/dist
COPY --from=build /workspace/apps/vortex-dashboard/dist ./apps/vortex-dashboard/dist
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://localhost:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/vortex-server/dist/index.js"]
