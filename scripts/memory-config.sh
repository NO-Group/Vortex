#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Vortex Adaptive Memory Configuration
#
# Auto-detects VPS specs (RAM, disk) and configures swap, Docker memory
# limits, and service tuning proportionally. Re-runnable after VPS upgrade
# — no code changes needed. Converts excess SSD storage into usable RAM
# via swap.
#
# Usage:
#   bash scripts/memory-config.sh          # configure based on current specs
#   bash scripts/memory-config.sh --status # show current config
#
# This script:
#   1. Creates/resizes a swap file (2x RAM, capped by disk)
#   2. Tunes swappiness and kernel parameters
#   3. Generates adaptive Docker memory limits
#   4. MERGES memory vars into .env (marked section) so docker-compose picks them up
#   5. Also writes .memory-override.env for inspection / --status
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env"
OVERRIDE_FILE="$REPO_ROOT/.memory-override.env"

# ── Status mode ──────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--status" ]]; then
  echo -e "${BOLD}Current VPS specs:${NC}"
  echo "  RAM:     $(free -h | awk '/Mem:/ {print $2}')"
  echo "  Swap:    $(free -h | awk '/Swap:/ {print $2}')"
  echo "  Disk:    $(df -h / | awk 'NR==2 {print $4}') free"
  echo "  Swappiness: $(sysctl vm.swappiness 2>/dev/null | awk '{print $3}')"
  echo ""
  if [[ -f "$OVERRIDE_FILE" ]]; then
    echo -e "${BOLD}Active memory override:${NC}"
    cat "$OVERRIDE_FILE"
  else
    echo -e "${YELLOW}No override file — run 'bash scripts/memory-config.sh' to generate one${NC}"
  fi
  if [[ -f "$ENV_FILE" ]]; then
    echo ""
    echo -e "${BOLD}Memory vars in .env:${NC}"
    grep -A 20 "MEMORY_BEGIN" "$ENV_FILE" 2>/dev/null || echo "  (none)"
  fi
  exit 0
fi

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Vortex Adaptive Memory Configuration                     ║${NC}"
echo -e "${BOLD}${CYAN}║  Converting excess storage → RAM via swap                 ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Detect system specs ──────────────────────────────────────────────────────
RAM_KB=$(awk '/MemTotal:/ {print $2}' /proc/meminfo)
RAM_MB=$((RAM_KB / 1024))
RAM_GB=$((RAM_MB / 1024))
DISK_FREE_GB=$(df -BG / | awk 'NR==2 {gsub("G","",$4); print $4}')
DISK_TOTAL_GB=$(df -BG / | awk 'NR==2 {gsub("G","",$2); print $2}')

echo -e "  Detected: ${RAM_GB}GB RAM, ${DISK_TOTAL_GB}GB disk (${DISK_FREE_GB}GB free)"
echo ""

# ── Calculate adaptive values ────────────────────────────────────────────────
# Swap: 2x RAM, capped at available disk (leave 5GB headroom for OS + data)
SWAP_GB=$((RAM_GB * 2))
MAX_SWAP_GB=$((DISK_FREE_GB - 5))
if [[ $SWAP_GB -gt $MAX_SWAP_GB ]]; then
  SWAP_GB=$MAX_SWAP_GB
fi
if [[ $SWAP_GB -lt 2 ]]; then
  SWAP_GB=2
fi

# Docker memory limits: proportional split of RAM
# Postgres: 25% of RAM, Redis: 5% of RAM, Vortex engine: 35% of RAM
PG_MEM_MB=$((RAM_MB * 25 / 100))
REDIS_MEM_MB=$((RAM_MB * 5 / 100))
VORTEX_MEM_MB=$((RAM_MB * 35 / 100))

# Postgres tuning
PG_SHARED_BUFFERS=$((PG_MEM_MB / 4))
if [[ $PG_SHARED_BUFFERS -gt 256 ]]; then
  PG_SHARED_BUFFERS=256
fi
if [[ $PG_SHARED_BUFFERS -lt 32 ]]; then
  PG_SHARED_BUFFERS=32
fi
PG_MAX_CONNECTIONS=$((RAM_MB / 20))
if [[ $PG_MAX_CONNECTIONS -gt 100 ]]; then
  PG_MAX_CONNECTIONS=100
fi
if [[ $PG_MAX_CONNECTIONS -lt 20 ]]; then
  PG_MAX_CONNECTIONS=20
fi

# Node.js heap: 60% of vortex-server memory limit
NODE_HEAP_MB=$((VORTEX_MEM_MB * 60 / 100))

# Swappiness: lower on low-RAM (swap early), higher on high-RAM (prefer RAM)
if [[ $RAM_GB -le 2 ]]; then
  SWAPPINESS=10
elif [[ $RAM_GB -le 4 ]]; then
  SWAPPINESS=30
elif [[ $RAM_GB -le 8 ]]; then
  SWAPPINESS=60
else
  SWAPPINESS=10
fi

echo -e "${BOLD}Configured values:${NC}"
echo "  Swap file:        ${SWAP_GB}GB (2x RAM, capped by disk)"
echo "  Swappiness:       ${SWAPPINESS}"
echo "  Postgres limit:   ${PG_MEM_MB}MB (shared_buffers=${PG_SHARED_BUFFERS}MB, max_conn=${PG_MAX_CONNECTIONS})"
echo "  Redis limit:      ${REDIS_MEM_MB}MB"
echo "  Vortex limit:     ${VORTEX_MEM_MB}MB (Node heap=${NODE_HEAP_MB}MB)"
echo ""

# ── Create/update swap file ─────────────────────────────────────────────────
SWAP_FILE="/swapfile"
if [[ -f "$SWAP_FILE" ]]; then
  CURRENT_SWAP_SIZE=$(du -BG "$SWAP_FILE" | awk '{print $1}')
  if [[ "$CURRENT_SWAP_SIZE" != "$SWAP_GB" ]]; then
    echo "  Resizing swap from ${CURRENT_SWAP_SIZE}GB to ${SWAP_GB}GB..."
    swapoff "$SWAP_FILE"
    rm -f "$SWAP_FILE"
    fallocate -l "${SWAP_GB}G" "$SWAP_FILE"
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE"
    swapon "$SWAP_FILE"
    echo "  ✓ Swap resized to ${SWAP_GB}GB"
  else
    echo "  ✓ Swap file already correct (${SWAP_GB}GB)"
  fi
else
  echo "  Creating ${SWAP_GB}GB swap file..."
  fallocate -l "${SWAP_GB}G" "$SWAP_FILE"
  chmod 600 "$SWAP_FILE"
  mkswap "$SWAP_FILE"
  swapon "$SWAP_FILE"
  echo "  ✓ Swap created (${SWAP_GB}GB)"
fi

# Persist in fstab
if ! grep -q "$SWAP_FILE" /etc/fstab; then
  echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
  echo "  ✓ Swap persisted in /etc/fstab"
fi

# ── Update sysctl tuning ────────────────────────────────────────────────────
cat > /etc/sysctl.d/99-vortex.conf << SYSCTL
# Vortex adaptive system tuning (auto-generated by memory-config.sh)
vm.swappiness = ${SWAPPINESS}
vm.overcommit_memory = 0
vm.min_free_kbytes = ${((RAM_MB * 1024 / 10))}
SYSCTL
sysctl --system >/dev/null 2>&1
echo "  ✓ Sysctl tuning applied (swappiness=${SWAPPINESS})"

# ── Generate memory override file for inspection ─────────────────────────────
cat > "$OVERRIDE_FILE" << OVERRIDE
# ── Vortex Adaptive Memory Override ──────────────────────────────────────────
# Auto-generated by scripts/memory-config.sh — re-run after VPS upgrade.
# Do not edit manually; re-run the script instead.

# Memory limits (in megabytes)
POSTGRES_MEM_LIMIT=${PG_MEM_MB}m
POSTGRES_MEM_RESERVATION=$((PG_MEM_MB / 2))m
REDIS_MEM_LIMIT=${REDIS_MEM_MB}m
REDIS_MEM_RESERVATION=$((REDIS_MEM_MB / 2))m
VORTEX_MEM_LIMIT=${VORTEX_MEM_MB}m
VORTEX_MEM_RESERVATION=$((VORTEX_MEM_MB / 2))m

# PostgreSQL tuning
POSTGRES_SHARED_BUFFERS=${PG_SHARED_BUFFERS}MB
POSTGRES_MAX_CONNECTIONS=${PG_MAX_CONNECTIONS}

# Redis tuning
REDIS_MAXMEMORY=$((REDIS_MEM_MB / 2))mb

# Node.js heap
NODE_MAX_OLD_SPACE_SIZE=${NODE_HEAP_MB}

# System
VM_SWAPPINESS=${SWAPPINESS}
RAM_DETECTED=${RAM_GB}GB
DISK_FREE=${DISK_FREE_GB}GB
OVERRIDE

echo "  ✓ Memory override written to $OVERRIDE_FILE"

# ── MERGE memory vars into .env (what docker-compose actually reads) ────────
# Docker Compose interpolates ${VAR:-default} from .env and the shell env.
# It does NOT read arbitrary .memory-override.env files. So we must inject
# these vars into .env using a marked section that we can safely replace.

MEMORY_VARS=$(cat << OVERRIDE

# ── Memory (auto-generated by memory-config.sh — do not edit manually) ──────
POSTGRES_MEM_LIMIT=${PG_MEM_MB}m
POSTGRES_MEM_RESERVATION=$((PG_MEM_MB / 2))m
REDIS_MEM_LIMIT=${REDIS_MEM_MB}m
REDIS_MEM_RESERVATION=$((REDIS_MEM_MB / 2))m
VORTEX_MEM_LIMIT=${VORTEX_MEM_MB}m
VORTEX_MEM_RESERVATION=$((VORTEX_MEM_MB / 2))m
POSTGRES_SHARED_BUFFERS=${PG_SHARED_BUFFERS}MB
POSTGRES_MAX_CONNECTIONS=${PG_MAX_CONNECTIONS}
REDIS_MAXMEMORY=$((REDIS_MEM_MB / 2))mb
NODE_MAX_OLD_SPACE_SIZE=${NODE_HEAP_MB}
# ── End Memory (auto-generated) ─────────────────────────────────────────────
OVERRIDE
)

if [[ -f "$ENV_FILE" ]]; then
  # Remove old marked section if present, then append fresh one
  if grep -q "MEMORY_BEGIN" "$ENV_FILE"; then
    # Use awk to delete from the BEGIN marker to the END marker
    awk '/# ── Memory \(auto-generated/{skip=1} /# ── End Memory \(auto-generated/{skip=0; next} !skip' "$ENV_FILE" > "$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  fi
  # Also remove the alternative marker style if present
  if grep -q "Memory (auto-generated by memory-config" "$ENV_FILE"; then
    awk '/Memory \(auto-generated by memory-config/{skip=1} /End Memory \(auto-generated\)/{skip=0; next} !skip' "$ENV_FILE" > "$ENV_FILE.tmp"
    mv "$ENV_FILE.tmp" "$ENV_FILE"
  fi
  printf '%s\n' "$MEMORY_VARS" >> "$ENV_FILE"
  echo "  ✓ Memory vars merged into .env"
else
  echo "  ⚠ .env not found — writing memory vars to standalone file"
  printf 'MEMORY_BEGIN\n%s\n' "$MEMORY_VARS" > "$ENV_FILE.memory"
  echo "    Created $ENV_FILE.memory — copy into .env before docker compose up"
fi

echo ""

# ── Restart services to apply new limits ─────────────────────────────────────
if docker compose -f "$REPO_ROOT/docker-compose.yml" ps &>/dev/null; then
  echo "  Restarting services with new memory limits..."
  docker compose -f "$REPO_ROOT/docker-compose.yml" up -d
  echo "  ✓ Services restarted"
else
  echo "  Docker not running yet — run 'docker compose up -d' after this completes"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Adaptive memory configuration complete!${NC}"
echo ""
echo "  Swap: ${SWAP_GB}GB | Swappiness: ${SWAPPINESS}"
echo "  Postgres: ${PG_MEM_MB}MB | Redis: ${REDIS_MEM_MB}MB | Vortex: ${VORTEX_MEM_MB}MB"
echo ""
echo "To re-configure after a VPS upgrade, just run:"
echo "  ${CYAN}bash scripts/memory-config.sh${NC}"
echo ""
echo "No code changes needed — the script auto-detects new specs."
