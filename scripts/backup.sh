#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Vortex Backup Script — automated daily backups for PostgreSQL
#
# Storage is Cloudflare R2 — backups are SQL dumps only (R2 handles its own
# redundancy and persistence, so no object backup needed).
#
# Run via cron daily:
#   0 2 * * * /path/to/Vortex/scripts/backup.sh
#
# Stores backups in ./backups/ with 7-day retention.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$REPO_ROOT/backups"
DATE=$(date +%Y%m%d)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

echo -e "${GREEN}[$(date)] Starting Vortex backup...${NC}"

# ── PostgreSQL backup ────────────────────────────────────────────────────────
echo -e "  Backing up PostgreSQL..."
if docker compose -f "$REPO_ROOT/docker-compose.yml" ps postgres &>/dev/null; then
  docker compose -f "$REPO_ROOT/docker-compose.yml" exec -T postgres \
    pg_dump -U vortex -F c vortex | \
    gzip > "$BACKUP_DIR/postgres-$DATE.sql.gz"

  if [[ -s "$BACKUP_DIR/postgres-$DATE.sql.gz" ]]; then
    echo -e "  ✓ Postgres backup: $(du -h "$BACKUP_DIR/postgres-$DATE.sql.gz" | cut -f1)"
  else
    echo -e "  ${RED}✗ Postgres backup failed${NC}"
  fi
else
  echo -e "  ${YELLOW}⚠ Postgres container not running — skipping${NC}"
fi

# ── Config backup ───────────────────────────────────────────────────────────
echo -e "  Backing up configuration..."
if [[ -f "$REPO_ROOT/.env" ]]; then
  # Backup .env but strip secrets (just the structure)
  sed 's/=.*/=REDACTED/' "$REPO_ROOT/.env" > "$BACKUP_DIR/env-config-$DATE.txt"
  echo -e "  ✓ Config backup saved"
fi

# ── Cleanup old backups ──────────────────────────────────────────────────────
echo -e "  Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "*-*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "*-*.txt" -mtime +$RETENTION_DAYS -delete

# ── Summary ──────────────────────────────────────────────────────────────────
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
BACKUP_COUNT=$(find "$BACKUP_DIR" -type f | wc -l)
echo -e "${GREEN}[$(date)] Backup complete — ${BACKUP_COUNT} files, ${BACKUP_SIZE} total${NC}"
echo -e "  Backup directory: $BACKUP_DIR"
echo ""
