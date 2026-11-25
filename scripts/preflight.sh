#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Vortex Pre-Flight Check — validates deployment before going public
#
# Run this AFTER deploy.sh and BEFORE announcing launch.
# Checks: services, TLS, DNS, email, storage (R2), realtime, security, backups.
#
#   bash scripts/preflight.sh
#
# Exits 0 if all critical checks pass, 1 if any fail.
# ──────────────────────────────────────────────────────────────────────────────
set -uo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Vortex Pre-Flight Check — Launch Validation              ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

check() {
  local label="$1"
  local result="$2"
  if [[ "$result" == "PASS" ]]; then
    echo -e "  ${GREEN}✓ PASS${NC}  $label"
    PASS=$((PASS + 1))
  elif [[ "$result" == "FAIL" ]]; then
    echo -e "  ${RED}✗ FAIL${NC}  $label"
    FAIL=$((FAIL + 1))
  elif [[ "$result" == "WARN" ]]; then
    echo -e "  ${YELLOW}⚠ WARN${NC}  $label"
    WARN=$((WARN + 1))
  fi
}

# ── 1. Docker services ──────────────────────────────────────────────────────
echo -e "${BOLD}1. Docker Services${NC}"
for svc in postgres redis vortex-server; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "not-found")
  if [[ "$STATUS" == "healthy" ]]; then
    check "$svc container" "PASS"
  else
    check "$svc container (status: $STATUS)" "FAIL"
  fi
done
echo ""

# ── 2. Engine health ─────────────────────────────────────────────────────────
echo -e "${BOLD}2. Engine Health${NC}"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz 2>/dev/null || echo "000")
if [[ "$HEALTH" == "200" ]]; then
  check "/healthz endpoint" "PASS"
else
  check "/healthz endpoint (HTTP $HEALTH)" "FAIL"
fi
echo ""

# ── 3. TLS / HTTPS ───────────────────────────────────────────────────────────
echo -e "${BOLD}3. TLS / HTTPS${NC}"
DOMAIN=$(grep -oP '(?<=^)\w[\w.-]*\.(?:com|io|net|org|dev|app|co)' "$REPO_ROOT/Caddyfile" 2>/dev/null | head -1)
DOMAIN=${DOMAIN:-vortex.local}

if command -v caddy &>/dev/null; then
  CADDY_STATUS=$(systemctl is-active caddy 2>/dev/null || echo "unknown")
  if [[ "$CADDY_STATUS" == "active" ]]; then
    check "Caddy service running" "PASS"
  else
    check "Caddy service running (status: $CADDY_STATUS)" "FAIL"
  fi
else
  check "Caddy installed" "FAIL"
fi

if [[ "$DOMAIN" != "vortex.local" && "$DOMAIN" != "vortex.example.com" ]]; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" || "$HTTP_CODE" == "302" ]]; then
    check "HTTPS responding ($DOMAIN → $HTTP_CODE)" "PASS"
  else
    check "HTTPS responding ($DOMAIN → $HTTP_CODE)" "WARN"
  fi
else
  check "Domain configured in Caddyfile" "WARN"
fi
echo ""

# ── 4. DNS resolution ───────────────────────────────────────────────────────
echo -e "${BOLD}4. DNS${NC}"
if [[ "$DOMAIN" != "vortex.local" && "$DOMAIN" != "vortex.example.com" ]]; then
  if command -v dig &>/dev/null; then
    IP=$(dig +short "$DOMAIN" 2>/dev/null | tail -1)
    if [[ -n "$IP" ]]; then
      SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "")
      if [[ "$IP" == "$SERVER_IP" ]]; then
        check "DNS A record points to server ($IP)" "PASS"
      else
        check "DNS A record ($IP vs server $SERVER_IP)" "WARN"
      fi
    else
      check "DNS resolves ($DOMAIN)" "FAIL"
    fi
  else
    check "dig command available" "WARN"
  fi
else
  check "Domain configured" "WARN"
fi
echo ""

# ── 5. Email configuration ──────────────────────────────────────────────────
echo -e "${BOLD}5. Email${NC}"
if [[ -f "$REPO_ROOT/.env" ]]; then
  if grep -q "^SMTP_URL=" "$REPO_ROOT/.env" && grep -v "^#" "$REPO_ROOT/.env" | grep -q "^SMTP_URL=smtps"; then
    check "SMTP_URL configured in .env" "PASS"
  else
    check "SMTP_URL configured in .env" "FAIL"
  fi

  if grep -q "^MAIL_FROM=" "$REPO_ROOT/.env" && ! grep "^#" "$REPO_ROOT/.env" | grep -q "^MAIL_FROM=Vortex <no-reply@vortex.local>"; then
    check "MAIL_FROM set to custom domain" "PASS"
  else
    check "MAIL_FROM set to custom domain" "WARN"
  fi
else
  check ".env file exists" "FAIL"
fi
echo ""

# ── 6. Cloudflare R2 Storage ─────────────────────────────────────────────────
echo -e "${BOLD}6. Storage (Cloudflare R2)${NC}"
if [[ -f "$REPO_ROOT/.env" ]]; then
  STORAGE_DRIVER=$(grep "^STORAGE_DRIVER=" "$REPO_ROOT/.env" 2>/dev/null | cut -d= -f2 || echo "")
  R2_ENDPOINT=$(grep "^S3_ENDPOINT=" "$REPO_ROOT/.env" 2>/dev/null | cut -d= -f2 || echo "")
  R2_BUCKET=$(grep "^S3_BUCKET=" "$REPO_ROOT/.env" 2>/dev/null | cut -d= -f2 || echo "")
  R2_ACCESS=$(grep "^S3_ACCESS_KEY_ID=" "$REPO_ROOT/.env" 2>/dev/null | cut -d= -f2 || echo "")
  R2_SECRET=$(grep "^S3_SECRET_ACCESS_KEY=" "$REPO_ROOT/.env" 2>/dev/null | cut -d= -f2 || echo "")

  if [[ "$STORAGE_DRIVER" == "s3" ]]; then
    check "Storage driver set to s3 (R2)" "PASS"
  else
    check "Storage driver set to s3 (R2) — current: $STORAGE_DRIVER" "FAIL"
  fi

  if [[ "$R2_ENDPOINT" == *"r2.cloudflarestorage.com" ]]; then
    check "R2 endpoint is Cloudflare" "PASS"
  else
    check "R2 endpoint is Cloudflare — current: $R2_ENDPOINT" "FAIL"
  fi

  if [[ -n "$R2_BUCKET" && "$R2_BUCKET" != "vortex" ]]; then
    check "R2 bucket name set ($R2_BUCKET)" "PASS"
  elif [[ -n "$R2_BUCKET" && "$R2_BUCKET" == "vortex" ]]; then
    check "R2 bucket name ($R2_BUCKET) — verify this matches your R2 bucket" "WARN"
  else
    check "R2 bucket configured" "FAIL"
  fi

  if [[ -n "$R2_ACCESS" && -n "$R2_SECRET" && "$R2_ACCESS" != "YOUR_R2_ACCESS_KEY" ]]; then
    check "R2 credentials set" "PASS"
  else
    check "R2 credentials set" "FAIL"
  fi

  # Test R2 connectivity
  if [[ -n "$R2_ENDPOINT" && "$R2_ENDPOINT" == *"r2.cloudflarestorage.com" && -n "$R2_ACCESS" && "$R2_ACCESS" != "YOUR_R2_ACCESS_KEY" ]]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $R2_ACCESS:$R2_SECRET" \
      "$R2_ENDPOINT/$R2_BUCKET?location=" 2>/dev/null || echo "000")
    if [[ "$HTTP_CODE" == "200" ]]; then
      check "R2 bucket accessible" "PASS"
    else
      check "R2 bucket accessible (HTTP $HTTP_CODE)" "WARN"
    fi
  fi
else
  check ".env file exists" "FAIL"
fi
echo ""

# ── 7. Security ─────────────────────────────────────────────────────────────
echo -e "${BOLD}7. Security${NC}"
if [[ -f "$REPO_ROOT/.env" ]]; then
  JWT_SECRET=$(grep "^JWT_SECRET=" "$REPO_ROOT/.env" | cut -d= -f2)
  if [[ "$JWT_SECRET" == "change-me-in-production-use-long-random-string" ]]; then
    check "JWT_SECRET is default value" "FAIL"
  elif [[ -n "$JWT_SECRET" && ${#JWT_SECRET} -ge 32 ]]; then
    check "JWT_SECRET is strong (${#JWT_SECRET} chars)" "PASS"
  else
    check "JWT_SECRET is short (${#JWT_SECRET} chars)" "FAIL"
  fi

  ENC_KEY=$(grep "^ENCRYPTION_KEY=" "$REPO_ROOT/.env" | cut -d= -f2)
  if [[ -n "$ENC_KEY" && ${#ENC_KEY} -ge 32 ]]; then
    check "ENCRYPTION_KEY set (${#ENC_KEY} chars)" "PASS"
  elif [[ -z "$ENC_KEY" ]]; then
    check "ENCRYPTION_KEY empty (will derive from JWT_SECRET)" "WARN"
  else
    check "ENCRYPTION_KEY is short (${#ENC_KEY} chars)" "WARN"
  fi

  SHIELD_KEY=$(grep "^SHIELD_SECRET_KEY=" "$REPO_ROOT/.env" | cut -d= -f2)
  if [[ "$SHIELD_KEY" == "dev-shield-key-change-me" || -z "$SHIELD_KEY" ]]; then
    check "SHIELD_SECRET_KEY is default value" "WARN"
  else
    check "SHIELD_SECRET_KEY set" "PASS"
  fi

  CORS=$(grep "^CORS_ORIGINS=" "$REPO_ROOT/.env" | cut -d= -f2)
  if [[ "$CORS" == "*" ]]; then
    check "CORS_ORIGINS set to *" "WARN"
  else
    check "CORS_ORIGINS restricted ($CORS)" "PASS"
  fi

  if grep -q "^AUTO_MIGRATE=true" "$REPO_ROOT/.env"; then
    check "AUTO_MIGRATE enabled" "PASS"
  else
    check "AUTO_MIGRATE configured" "WARN"
  fi
else
  check ".env file exists" "FAIL"
fi
echo ""

# ── 8. Admin account ────────────────────────────────────────────────────────
echo -e "${BOLD}8. Admin Account${NC}"
ADMIN_COUNT=$(docker exec postgres psql -U vortex -d vortex -t -c "SELECT count(*) FROM users WHERE role = 'admin';" 2>/dev/null | xargs || echo "0")
if [[ "$ADMIN_COUNT" -gt 0 ]]; then
  check "Admin account exists ($ADMIN_COUNT admin(s))" "PASS"
else
  check "Admin account exists" "FAIL"
  echo -e "       → Run: docker compose exec vortex-server npm run admin -- promote you@example.com"
fi
echo ""

# ── 9. Backups ───────────────────────────────────────────────────────────────
echo -e "${BOLD}9. Backups${NC}"
if [[ -d "$REPO_ROOT/backups" ]] && find "$REPO_ROOT/backups" -type f -name "*.sql.gz" 2>/dev/null | head -1 | grep -q "."; then
  check "Backup directory has Postgres backups" "PASS"
else
  check "Backup directory has Postgres backups" "WARN"
  echo -e "       → Run: bash scripts/backup.sh to create your first backup"
fi
echo ""

# ── 10. Swap file ───────────────────────────────────────────────────────────
echo -e "${BOLD}10. Swap File${NC}"
if [[ -f /swapfile ]]; then
  SWAP_SIZE=$(du -h /swapfile | cut -f1)
  check "Swap file exists ($SWAP_SIZE at /swapfile)" "PASS"
else
  check "Swap file exists at /swapfile" "WARN"
  echo -e "       → Run deploy.sh to create swap, or: fallocate -l 4G /swapfile && mkswap /swapfile && swapon /swapfile"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Passed: $PASS${NC}"
echo -e "${YELLOW}  Warned: $WARN${NC}"
echo -e "${RED}  Failed: $FAIL${NC}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${NC}"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo -e "${RED}✗ Pre-flight check FAILED — fix the failed items before launch.${NC}"
  echo ""
  echo "Common fixes:"
  echo "  • JWT_SECRET: generate a strong secret and update .env"
  echo "  • SMTP_URL: set your email provider in .env"
  echo "  • R2 credentials: set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env"
  echo "  • R2 endpoint: verify S3_ENDPOINT matches your R2 account ID"
  echo "  • Admin account: run the admin promote command"
  echo "  • Caddyfile: set your domain and run 'caddy start'"
  exit 1
elif [[ $WARN -gt 0 ]]; then
  echo -e "${YELLOW}⚠ Pre-flight check PASSED with warnings. Review the warnings above.${NC}"
  echo ""
  echo "Warnings are non-critical but should be addressed for production."
  exit 0
else
  echo -e "${GREEN}✓ All checks passed — ready for launch! 🚀${NC}"
  exit 0
fi
