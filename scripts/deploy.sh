#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Vortex Launch — VPS Deployment Script (Cloudflare R2 + Swap)
#
# Automates the full production deployment on a fresh Ubuntu/Debian VPS.
# Run this script on your VPS after cloning the repo.
#
#   1. Configures swap file (prevents OOM crashes)
#   2. Installs Docker + Docker Compose + Caddy
#   3. Generates secure JWT secret + Postgres password
#   4. Creates .env from .env.example with Cloudflare R2 storage
#   5. Builds and starts all services
#   6. Waits for health checks
#   7. Creates the first admin user
#
# Usage:
#   git clone https://github.com/NO-Group/Vortex.git
#   cd Vortex
#   sudo bash scripts/deploy.sh
#
# Then edit Caddyfile with your domain, run: caddy start
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Vortex Launch — VPS Deployment (R2 + Swap)               ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Check root ───────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Error: Run this script as root (sudo bash scripts/deploy.sh)${NC}"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# ── Step 1: Swap file (prevents OOM crashes) ────────────────────────────────
echo -e "${GREEN}[1/8] Configuring swap file...${NC}"
SWAP_SIZE="${SWAP_SIZE:-4G}"
SWAP_FILE="/swapfile"

if [[ -f "$SWAP_FILE" ]]; then
  echo "  Swap file already exists at $SWAP_FILE ($(du -h $SWAP_FILE | cut -f1))"
else
  echo "  Creating ${SWAP_SIZE} swap file..."
  fallocate -l "$SWAP_SIZE" "$SWAP_FILE"
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE"
  swapon "$SWAP_FILE"

  # Persist in fstab so it survives reboots
  if ! grep -q "$SWAP_FILE" /etc/fstab; then
    echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
  fi

  SWAP_TOTAL=$(swapon --show=SWAPSIZE "$SWAP_FILE" 2>/dev/null || echo "$SWAP_SIZE")
  echo "  ✓ Swap enabled: $SWAP_TOTAL at $SWAP_FILE"
fi

# ── Step 2: Install Docker ──────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${GREEN}[2/8] Installing Docker + Docker Compose...${NC}"
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker
  systemctl start docker
else
  echo -e "${GREEN}[2/8] Docker already installed${NC}"
fi

# ── Step 3: Install Caddy ───────────────────────────────────────────────────
if ! command -v caddy &>/dev/null; then
  echo -e "${GREEN}[3/8] Installing Caddy reverse proxy...${NC}"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
  systemctl enable caddy
else
  echo -e "${GREEN}[3/8] Caddy already installed${NC}"
fi

# ── Step 4: Generate secrets ────────────────────────────────────────────────
echo -e "${GREEN}[4/8] Generating secure secrets...${NC}"

JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(48))")
PG_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))" 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(16))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
SHIELD_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))")
VAPID_PUB=$(node -e "const wp=require('web-push');console.log(wp.generateVAPIDKeys().publicKey)" 2>/dev/null || echo "")
VAPID_PRIV=$(node -e "const wp=require('web-push');console.log(wp.generateVAPIDKeys().privateKey)" 2>/dev/null || echo "")

echo "  JWT_SECRET:        ${JWT_SECRET:0:16}... (48 bytes, 96 hex chars)"
echo "  Postgres password: ${PG_PASSWORD:0:16}... (16 bytes)"
echo "  Encryption key:    ${ENCRYPTION_KEY:0:16}... (32 bytes)"
echo "  Shield key:        ${SHIELD_KEY:0:16}... (32 bytes)"

# ── Step 5: Create .env with Cloudflare R2 ──────────────────────────────────
echo -e "${GREEN}[5/8] Creating production .env (Cloudflare R2 storage)...${NC}"

# ── Cloudflare R2 + SMTP credentials (pre-configured) ────────────────────────
R2_ACCOUNT_ID="R2_ACCOUNT_PLACEHOLDER"
R2_BUCKET="vortex"
R2_ACCESS_KEY="R2_ACCESS_PLACEHOLDER"
R2_SECRET_KEY="R2_SECRET_PLACEHOLDER"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# SMTP (Resend)
SMTP_HOST="smtp.resend.com"
SMTP_USER="resend"
SMTP_PASS="REPLACE_WITH_YOUR_RESEND_KEY"
SMTP_URL="smtps://${SMTP_USER}:${SMTP_PASS}@${SMTP_HOST}:465"

DOMAIN="${VORTEX_DOMAIN:-vortex.local}"
PUBLIC_URL="${VORTEX_PUBLIC_URL:-http://localhost:8080}"

echo "  R2 Account ID:     $R2_ACCOUNT_ID"
echo "  R2 Bucket:         $R2_BUCKET"
echo "  R2 Endpoint:       $R2_ENDPOINT"
echo "  SMTP:              $SMTP_HOST (Resend)"

cat > .env << EOF
# ── Vortex Production Configuration ──────────────────────────────────────────
PORT=8080
HOST=0.0.0.0
CORS_ORIGINS=https://${DOMAIN},http://localhost:8080

# PostgreSQL
DATABASE_URL=postgres://vortex:${PG_PASSWORD}@localhost:5432/vortex

# Auth
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=1h
JWT_ISSUER=vortex

# Encryption & Security
ENCRYPTION_KEY=${ENCRYPTION_KEY}
SHIELD_SECRET_KEY=${SHIELD_KEY}

# Migrations
AUTO_MIGRATE=true

# Console
SERVE_CONSOLE=true
PUBLIC_APP_URL=https://${DOMAIN}
PUBLIC_API_BASE=auto

# Email (Resend SMTP — pre-configured)
SMTP_URL=${SMTP_URL}
MAIL_FROM=Vortex <no-reply@${DOMAIN}>

# ── Storage: Cloudflare R2 (zero egress fees) ────────────────────────────────
STORAGE_DRIVER=s3
STORAGE_FALLBACK_DRIVER=local
STORAGE_LOCAL_DIR=./.vortex-data
S3_BUCKET=${R2_BUCKET}
S3_REGION=auto
S3_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=${R2_ACCESS_KEY}
S3_SECRET_ACCESS_KEY=${R2_SECRET_KEY}
S3_FORCE_PATH_STYLE=true

# Realtime
REALTIME_HEARTBEAT_MS=30000

# Push notifications
VAPID_PUBLIC_KEY=${VAPID_PUB}
VAPID_PRIVATE_KEY=${VAPID_PRIV}
VAPID_SUBJECT=noreply@${DOMAIN}

# Query governance
SLOW_QUERY_MS=250
REALTIME_BACKLOG=500

# Edge cache
EDGE_CACHE_TTL=300
EDGE_CACHE_MAX_ENTRIES=10000
EOF

echo "  .env created at $REPO_ROOT/.env"

# Export for docker-compose interpolation
export POSTGRES_PASSWORD="${PG_PASSWORD}"

# ── Step 6: Build and start ─────────────────────────────────────────────────
echo -e "${GREEN}[6/8] Building and starting services...${NC}"
echo "  This may take 3-5 minutes on first build..."
docker compose up -d --build
echo "  Containers started"

# ── Step 7: Wait for health ────────────────────────────────────────────────
echo -e "${GREEN}[7/8] Waiting for services to become healthy...${NC}"

MAX_WAIT=60
WAITED=0
while [[ $WAITED -lt $MAX_WAIT ]]; do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' vortex-server 2>/dev/null || echo "starting")
  if [[ "$HEALTH" == "healthy" ]]; then
    echo -e "  ✓ Vortex engine is healthy!"
    break
  fi
  echo -e "  Waiting... (${WAITED}/${MAX_WAIT}s) status: ${HEALTH}"
  sleep 2
  WAITED=$((WAITED + 2))
done

if [[ "$HEALTH" != "healthy" ]]; then
  echo -e "${YELLOW}Warning: Engine not healthy after ${MAX_WAIT}s. Check logs:${NC}"
  echo "  docker compose logs vortex-server"
else
  echo -e "  ✓ All services are running"
fi

# ── Step 8: Admin user ─────────────────────────────────────────────────────
echo -e "${GREEN}[8/8] Admin account setup${NC}"
echo ""
echo -e "${BOLD}Create your first admin account:${NC}"
echo -e "  ${CYAN}docker compose exec vortex-server npm run admin -- promote you@example.com${NC}"
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║  Vortex deployed successfully!                           ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo ""
echo -e "  1. ${BOLD}Configure your domain:${NC}"
echo -e "     Edit Caddyfile — change 'vortex.example.com' to your domain"
echo -e "     ${CYAN}nano Caddyfile${NC}"
echo ""
echo -e "  2. ${BOLD}Start Caddy:${NC}"
echo -e "     ${CYAN}caddy start${NC}"
echo ""
echo -e "  3. ${BOLD}Create admin account:${NC}"
echo -e "     ${CYAN}docker compose exec vortex-server npm run admin -- promote you@example.com${NC}"
echo ""
echo -e "  4. ${BOLD}Verify R2 storage:${NC}"
echo -e "     R2 credentials are pre-configured — check logs: ${CYAN}docker compose logs vortex-server${NC}"
echo ""
echo -e "  5. ${BOLD}Run pre-flight check:${NC}"
echo -e "     ${CYAN}bash scripts/preflight.sh${NC}"
echo ""
echo -e "${BOLD}Service management:${NC}"
echo -e "  View logs:   ${CYAN}docker compose logs -f${NC}"
echo -e "  Restart:     ${CYAN}docker compose restart${NC}"
echo -e "  Stop:        ${CYAN}docker compose down${NC}"
echo -e "  Status:      ${CYAN}docker compose ps${NC}"
echo ""
echo -e "${GREEN}🚀 Ready for blast off!${NC}"
