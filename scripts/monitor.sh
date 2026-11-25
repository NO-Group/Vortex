#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Vortex Monitor — production health check
#
# Checks all services and reports status. Run manually or via cron:
#   * * * * * /path/to/Vortex/scripts/monitor.sh >> /var/log/vortex-monitor.log 2>&1
#
# Alerts (prints warnings) if any service is unhealthy.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${CYAN}[$(date)] Vortex health check${NC}"
echo ""

ISSUES=0

# ── Docker Compose services ───────────────────────────────────────────────────
echo -e "  ${BOLD}Container status:${NC}"
for service in postgres redis vortex-server; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$service" 2>/dev/null || echo "not-found")
  if [[ "$STATUS" == "healthy" ]]; then
    echo -e "    ${GREEN}✓${NC} $service — healthy"
  elif [[ "$STATUS" == "starting" ]]; then
    echo -e "    ${YELLOW}⟳${NC} $service — starting"
  else
    echo -e "    ${RED}✗${NC} $service — $STATUS"
    ISSUES=$((ISSUES + 1))
  fi
done
echo ""

# ── Engine health endpoint ───────────────────────────────────────────────────
echo -e "  ${BOLD}Engine health:${NC}"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/healthz 2>/dev/null || echo "000")
if [[ "$HEALTH" == "200" ]]; then
  echo -e "    ${GREEN}✓${NC} /healthz — 200 OK"
else
  echo -e "    ${RED}✗${NC} /healthz — HTTP $HEALTH"
  ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Database connectivity ─────────────────────────────────────────────────────
echo -e "  ${BOLD}Database:${NC}"
PG_CHECK=$(docker exec postgres pg_isready -U vortex 2>/dev/null || echo "fail")
if [[ "$PG_CHECK" == *"accepting connections"* ]]; then
  echo -e "    ${GREEN}✓${NC} PostgreSQL — accepting connections"
else
  echo -e "    ${RED}✗${NC} PostgreSQL — $PG_CHECK"
  ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Redis connectivity ───────────────────────────────────────────────────────
echo -e "  ${BOLD}Redis:${NC}"
REDIS_CHECK=$(docker exec redis redis-cli ping 2>/dev/null || echo "fail")
if [[ "$REDIS_CHECK" == "PONG" ]]; then
  echo -e "    ${GREEN}✓${NC} Redis — PONG"
else
  echo -e "    ${RED}✗${NC} Redis — $REDIS_CHECK"
  ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Cloudflare R2 connectivity ────────────────────────────────────────────────
echo -e "  ${BOLD}Storage (Cloudflare R2):${NC}"
if [[ -f "$REPO_ROOT/.env" ]]; then
  R2_ENDPOINT=$(grep "^S3_ENDPOINT=" "$REPO_ROOT/.env" | cut -d= -f2)
  R2_BUCKET=$(grep "^S3_BUCKET=" "$REPO_ROOT/.env" | cut -d= -f2)
  R2_ACCESS=$(grep "^S3_ACCESS_KEY_ID=" "$REPO_ROOT/.env" | cut -d= -f2)
  R2_SECRET=$(grep "^S3_SECRET_ACCESS_KEY=" "$REPO_ROOT/.env" | cut -d= -f2)

  if [[ -n "$R2_ENDPOINT" && "$R2_ENDPOINT" != "http://localhost:9000" ]]; then
    # Test R2 endpoint reachability
    ACCOUNT_ID=$(echo "$R2_ENDPOINT" | grep -oP '(?<=\.r2\.cloudflarestorage\.com)\S*' || echo "")
    ACCOUNT_ID=$(echo "$R2_ENDPOINT" | sed 's|https://||' | cut -d'.' -f1)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $R2_ACCESS:$R2_SECRET" \
      "$R2_ENDPOINT/$R2_BUCKET?location=" 2>/dev/null || echo "000")

    if [[ "$HTTP_CODE" == "200" ]]; then
      echo -e "    ${GREEN}✓${NC} R2 endpoint reachable (bucket: $R2_BUCKET)"
    else
      echo -e "    ${YELLOW}⚠${NC} R2 endpoint returned HTTP $HTTP_CODE (check credentials)"
    fi
  else
    echo -e "    ${YELLOW}⚠${NC} R2 not configured in .env"
  fi
else
  echo -e "    ${YELLOW}⚠${NC} .env not found"
fi
echo ""

# ── Disk space ──────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Disk usage:${NC}"
DISK=$(df -h / | awk 'NR==2 {print $5}')
DISK_PCT=${DISK//%/}
if [[ $DISK_PCT -lt 80 ]]; then
  echo -e "    ${GREEN}✓${NC} / — ${DISK} used"
elif [[ $DISK_PCT -lt 90 ]]; then
  echo -e "    ${YELLOW}⚠${NC} / — ${DISK} used (consider cleanup)"
else
  echo -e "    ${RED}✗${NC} / — ${DISK} used (CRITICAL: clean up immediately)"
  ISSUES=$((ISSUES + 1))
fi
echo ""

# ── Memory usage ─────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Memory:${NC}"
MEM_PCT=$(free | awk '/Mem:/ {printf "%.0f", $3/$2*100}')
if [[ $MEM_PCT -lt 80 ]]; then
  echo -e "    ${GREEN}✓${NC} ${MEM_PCT}% memory used"
else
  echo -e "    ${YELLOW}⚠${NC} ${MEM_PCT}% memory used (high)"
fi
echo ""

# ── Swap usage ──────────────────────────────────────────────────────────────
echo -e "  ${BOLD}Swap:${NC}"
SWAP_TOTAL=$(free | awk '/Swap:/ {printf "%.0f", $2/1024}')
SWAP_USED=$(free | awk '/Swap:/ {printf "%.0f", $3/$2*100}')
if [[ $SWAP_USED -lt 80 ]]; then
  echo -e "    ${GREEN}✓${NC} ${SWAP_USED}% swap used (${SWAP_TOTAL}MB total)"
else
  echo -e "    ${YELLOW}⚠${NC} ${SWAP_USED}% swap used (high — may indicate memory pressure)"
fi
echo ""

# ── Container memory usage ───────────────────────────────────────────────────
echo -e "  ${BOLD}Container memory:${NC}"
for svc in postgres redis vortex-server; do
  MEM=$(docker stats --no-stream --format "{{.MemUsage}}" "$svc" 2>/dev/null | awk '{print $1}' || echo "N/A")
  MEM_LIMIT=$(docker inspect --format='{{.HostConfig.Memory}}' "$svc" 2>/dev/null | awk '{printf "%.0fMB", $1/1048576}' || echo "unlimited")
  echo -e "    $svc: ${MEM} (limit: ${MEM_LIMIT})"
done
echo ""

# ── Disk usage on backups ───────────────────────────────────────────────────
echo -e "  ${BOLD}Backup directory:${NC}"
if [[ -d "$REPO_ROOT/backups" ]]; then
  BK_SIZE=$(du -sh "$REPO_ROOT/backups" 2>/dev/null | cut -f1)
  echo -e "    ${GREEN}✓${NC} backups exist ($BK_SIZE)"
else
  echo -e "    ${YELLOW}⚠${NC} no backups directory found"
fi
echo ""

# ── Summary ──────────────────────────────────────────────────────────────────
if [[ $ISSUES -eq 0 ]]; then
  echo -e "${GREEN}✓ All systems healthy — no issues detected${NC}"
else
  echo -e "${RED}✗ ${ISSUES} issue(s) detected — investigate immediately${NC}"
  echo -e "  Check logs: docker compose logs -f"
fi
echo ""
