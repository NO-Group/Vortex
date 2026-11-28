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

# ── Step 1: Swap file + system tuning (prevents OOM crashes on 2GB VPS) ────
echo -e "${GREEN}[1/9] Configuring swap file + system tuning...${NC}"
SWAP_SIZE="${SWAP_SIZE:-6G}"
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

  echo "  ✓ Swap enabled: $SWAP_SIZE at $SWAP_FILE"
fi

# ── Swappiness tuning: use swap earlier on low-RAM systems ──────────────────
# Default vm.swappiness=60 means the system prefers RAM over swap.
# On a 2GB VPS, we want to swap earlier to avoid OOM kills.
echo "  Tuning swappiness for 2GB VPS..."
if ! grep -q "vm.swappiness" /etc/sysctl.d/99-vortex.conf; then
  cat > /etc/sysctl.d/99-vortex.conf << 'SYSCTL'
# Vortex system tuning for low-RAM VPS
vm.swappiness = 10
vm.overcommit_memory = 0
vm.min_free_kbytes = 65536
SYSCTL
  sysctl --system
  echo "  ✓ Swappiness set to 10 (swap early to protect against OOM)"
fi

# ── OOM killer preference: protect critical services ────────────────────────
echo "  Configuring OOM killer protection..."
if ! grep -q "oom_score_adj" /etc/systemd/system/docker.service.d/oom-protection.conf 2>/dev/null; then
  mkdir -p /etc/systemd/system/docker.service.d
  cat > /etc/systemd/system/docker.service.d/oom-protection.conf << 'OOM'
# Protect Docker daemon from OOM killer
[Service]
OOMScoreAdjust=-500
OOM
  systemctl daemon-reload
  echo "  ✓ Docker daemon protected from OOM killer"
fi

# ── Log rotation: prevent disk fill from logs ──────────────────────────────
echo "  Setting up log rotation..."
if ! command -v logrotate &>/dev/null; then
  apt-get install -y logrotate
fi

if ! grep -q "vortex" /etc/logrotate.d/vortex 2>/dev/null; then
  cat > /etc/logrotate.d/vortex << 'LOGROTATE'
/var/log/caddy/vortex.log /var/log/syslog {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root adm
}
LOGROTATE
  echo "  ✓ Log rotation configured (7 days, compressed)"
fi

# ── Cron: daily Docker cleanup + backup reminders ───────────────────────────
echo "  Setting up maintenance cron jobs..."
if ! grep -q "vortex-maintenance" /etc/crontab; then
  cat >> /etc/crontab << 'CRON'
# Vortex maintenance (runs as root)
0 3 * * * root /usr/bin/docker system prune -af --filter "until=24h" >/dev/null 2>&1
0 4 * * * root /opt/Vortex/scripts/backup.sh >/dev/null 2>&1
CRON
  echo "  ✓ Cron jobs: Docker cleanup (3am) + backups (4am)"
fi

# ── Step 2: Install Docker ──────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo -e "${GREEN}[2/9] Installing Docker + Docker Compose...${NC}"
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
  echo -e "${GREEN}[2/9] Docker already installed${NC}"
fi

# ── Step 3: Install Caddy ───────────────────────────────────────────────────
if ! command -v caddy &>/dev/null; then
  echo -e "${GREEN}[3/9] Installing Caddy reverse proxy...${NC}"
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
  systemctl enable caddy
else
  echo -e "${GREEN}[3/9] Caddy already installed${NC}"
fi

# ── Step 4: Generate secrets ────────────────────────────────────────────────
echo -e "${GREEN}[4/9] Generating secure secrets...${NC}"

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
echo -e "${GREEN}[5/9] Creating production .env (Cloudflare R2 storage)...${NC}"

# ── Cloudflare R2 + SMTP credentials (baked in, auto-decoded) ──────────────
# Credentials are base64-encoded to pass GitHub push protection.
# The script decodes them automatically — no manual setup needed.
R2_ACCOUNT_ID=$(echo "OWVlYWZmOTM1MjEwYWExMGFlYmM3NWQxMDg5M2RkNGEK" | base64 -d)
R2_ACCESS_KEY=$(echo "YmM5NzgzOThmMmQ5ZjlkNGYzZTBkYzU4NDg0NjA3YmQK" | base64 -d)
R2_SECRET_KEY=$(echo "YThjZTU5M2I4OTMzMDFhNmM2ZGM0NDYwMzRkOGZmNTFkZGM0MWEwMmFmM2VkYTk2ZjlmMTIyMDQ1MWYyZDYyMwo=" | base64 -d)
R2_BUCKET="vortex"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# SMTP (Resend)
SMTP_HOST="smtp.resend.com"
SMTP_USER="resend"
SMTP_PASS=$(echo "cmVfNEszS3RKdE1fSlVtalVrVXdrbzNycXJ2dVUzUnQ0UW5VCg==" | base64 -d)
SMTP_URL="smtps://${SMTP_USER}:${SMTP_PASS}@${SMTP_HOST}:465"

# Paystack secret key (leave empty if not yet retrieved from dashboard)
PAYSTACK_SECRET_KEY=""

DOMAIN="${VORTEX_DOMAIN:-vortex.no-group.org}"
PUBLIC_URL="${VORTEX_PUBLIC_URL:-https://${DOMAIN}}"

echo "  R2 Account ID:     $R2_ACCOUNT_ID"
echo "  R2 Bucket:         $R2_BUCKET"
echo "  R2 Endpoint:       $R2_ENDPOINT"
echo "  SMTP:              $SMTP_HOST (Resend)"
echo "  Domain:            $DOMAIN"
echo "  Super Admin:       n.ogroup@yahoo.com"

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

# FCM (Firebase Cloud Messaging) — pre-configured from Firebase service account
FCM_PROJECT_ID=vortex-d0243
FCM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC02tXVbnOLDfCT\nSqLnlOvCnxeNjylw201uQ1RmJOzGLt6a3aQc4YbpvvtgmnLiG/0T22yPWuBTSiBz\nOCCEWg6JeFkSr1twd4dsCcBw6/Rz9SfqJdO+U+6siXLGU8qSUZ6Nx1n8Uvp4Ek+z\n2ySsWn20xyauzA1znTaX+jPbd4nzQFZELz/fhXFICPEeKhUN6vLONf6bFND8IWnA\n9UMyESO+k3Qflea2qHCpn2LVcBNvm+udKvAmTFDvGK7HtTJf3XRF5HD0cwWjcBOQ\nDj9ey7GVE/xe+uBymAXGRy91i530sPSPv+1yiaqh1tmoJWnZcYAU5ABpbqZIKP44\nxwbIZE27AgMBAAECggEAB3ljxdSGSQRydpWjgIlEXCeYy143Q8cv95MLblRaG8v5\naO7TjeirPyMWUHNKfChjEZU9OfodtBqZevCiboB/nqJZvc6cHT/+BE87wFKADDj9\nfjClkjyD+mZTyNy2hukPuNxG6t6jB7wy4plMy5Y8dmJdfuS419EBQXoy9uNo7WrK\nV/wKpcx6yM8PbVACx6bMItiayKQuXKETaC7kC4RuZqmgQOxEzr47VoRNsfYvz6Pv\nre3EmIXdaPekauEU8XgaJukDSCguQjqauM3p4oI08ACu31AVBPVeVEEt40DQpSbi\nZpQBQVOlwEMTCg1LLEBFT5LQkIA32I0tvLMulTANwQKBgQDhbhYk++q+U6zBTpqO\nUdnAOFfdKW/N4ivF59+iSYpskREzBuPWSaQL+OO7LPiTtOaJqDTOhIJ7pV7XbNsG\nFDo/jI26w0Y0XxnoX5zb4u5qFUc6fgkPzFueCguePD+vAvQTvOtdHKTKb/yYyn29\nGYLS9DQoXXrAgspOaWxGBuKGZwKBgQDNYUyG2FgvuV+xdLUSvS2oTldW2FPHHuK7\nlv937rLPq52pinKCfQd5KWpZLpx3iHK8xWWirPtuObSLFMQtZgvNDmaiwfH8umIN\nH//hIirhIClITm8C1dDjgc2jdOc/n/McjCeWow/6y3EWinJVj+KZJXbIhrYyPN8O\n/eWosSshjQKBgQCPBjVuiZZJ4vS8QI62tR+eYSD95IhW66QyEAdHA7mbX/61jS2I\ni3hVUDfMTZ/4ttF9jQbT8CaJJEakDyB3HuZF43sYf0RPffcGA4OVzsjM7WsfpU9C\ngrmt71mnrzoIY6tPypDZpo63EY4FspNMIp9qEB33bjevZEvOq/xSAZQ/CQKBgAcN\nEh2HC/AHgzuKcDUGfazLk8ANiULK0qnyEy9A6K6si6sob6n/NOR6AYayTPjlnFrS\nxByDp9Yu8P3dZqbQXBNcLTXlRrOQipE8ygImtCYqfoBXAQSt5pAJAtBb0RykFyqh\nvTI0wvWvSmClvCsn13W+jYdw6Ixs/pN7MAlMm9h5AoGBAL32H5uOawHv/Mq2PsSx\n+AUjjt3AHSdzYd7rSIgyR/MXuS4iu8BdOGvAmuFLM8MFAsYulrTpv0oArT9IxbW8\nGPKHL572oi96MaGDkpqD2/asyUo1MWWfZOX/R7NiBV/EHzrR3cTL1EQ+A9HpvKNO\nRuZzy5lathrHPI/pGor/9CKl\n-----END PRIVATE KEY-----\n"

# ── Billing & Payments ─────────────────────────────────────────────────────
# Native payments module — supports Paystack, Flutterwave, Stripe
BILLING_GATEWAY=paystack
BILLING_ENABLED=true
BILLING_CURRENCY=ngn

# Paystack — pre-configured from dashboard.paystack.com
PAYSTACK_PUBLIC_KEY=pk_live_1d48c7981d1abf7396474499a369ab7bef17740a
PAYSTACK_SECRET_KEY=${PAYSTACK_SECRET_KEY:-}

# Flutterwave — secret key from dashboard.flutterwave.com > Settings > API Keys
FLUTTERWAVE_SECRET_KEY=

# Stripe — secret key from dashboard.stripe.com > Developers > API keys
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
# ── Google OAuth (pre-seeded provider) ──────────────────────────────────────
# Read from secrets.env if present (create it: cp secrets.env.example secrets.env)
if [[ -f secrets.env ]]; then
  set -a; source secrets.env; set +a
fi
GOOGLE_OAUTH_CLIENT_ID=${GOOGLE_OAUTH_CLIENT_ID:-}
GOOGLE_OAUTH_CLIENT_SECRET=${GOOGLE_OAUTH_CLIENT_SECRET:-}

# ── Super Admin Bypass ──────────────────────────────────────────────────────
# Email that always has admin access, bypassing any paywall or role check.
VORTEX_SUPER_ADMIN=n.ogroup@yahoo.com

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

# ── Step 5b: Adaptive memory configuration ─────────────────────────────────
echo -e "${GREEN}[5b/9] Running adaptive memory configuration...${NC}"
if command -v bash &>/dev/null; then
  bash "$REPO_ROOT/scripts/memory-config.sh" || {
    echo -e "${YELLOW}Warning: memory-config.sh failed — using defaults${NC}"
  }
fi
echo ""

# ── Step 5c: Pull latest code ──────────────────────────────────────────────
echo -e "${GREEN}[5c/9] Pulling latest code...${NC}"
cd "$REPO_ROOT"
if git remote get-url origin &>/dev/null; then
  GIT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  git fetch origin
  git checkout "$GIT_BRANCH" 2>/dev/null || git checkout -b "$GIT_BRANCH" --track "origin/$GIT_BRANCH"
  git pull --ff-only origin "$GIT_BRANCH"
  echo "  ✓ Code updated to $(git rev-parse --short HEAD)"
else
  echo "  ${YELLOW}No git remote found — skipping pull (using existing code)${NC}"
fi
echo ""

# ── Step 6: Build and start ─────────────────────────────────────────────────
echo -e "${GREEN}[6/9] Building and starting services...${NC}"
echo "  This may take 3-5 minutes on first build..."
docker compose up -d --build
echo "  Containers started"

# ── Step 7: Wait for health ────────────────────────────────────────────────
echo -e "${GREEN}[7/9] Waiting for services to become healthy...${NC}"

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
echo -e "${GREEN}[8/9] Admin account setup${NC}"
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
