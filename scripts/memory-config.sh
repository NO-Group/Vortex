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
# This script generates /opt/Vortex/.memory-override.env which
# docker-compose.yml reads for memory limits and service tuning.
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
OVERRIDE_FILE="$REPO_ROOT/.memory-override.env"

# ── Status mode ──────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--status" ]]; then
  echo -e "${BOLD}Current VPS specs:${NC}"
  echo "  RAM:     $(free -h | awk '/Mem:/ {print $2}')"
  echo "  Swap:    $(free -h | awk '/Swap:/ {print $2}')"
  echo "  Disk:    $(df -h / | awk 'NR==2 {print $4}') free"
  echo "  Swappiness: $(sysctl vm.swappiness | awk '{print $3}')"
  echo ""
  if [[ -f "$OVERRIDE_FILE" ]]; then
    echo -e "${BOLD}Active memory override:${NC}"
    cat "$OVERRIDE_FILE"
  else
    echo -e "${YELLOW}No override file — run 'bash scripts/memory-config.sh' to generate one${NC}"
  fi
  exit 0
fi

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Vortex Adaptive Memory Configuration                     ║${NC}"
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

# Swappiness: lower on low-RAM, higher on high-RAM
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
# Vortex adaptive system tuning (auto-generated)
vm.swappiness = ${SWAPPINESS}
vm.overcommit_memory = 0
vm.min_free_kbytes = ${((RAM_MB * 1024 / 10))}
SYSCTL
sysctl --system >/dev/null 2>&1
echo "  ✓ Sysctl tuning applied (swappiness=${SWAPPINESS})"

# ── Generate memory override file for Docker Compose ─────────────────────────
cat > "$OVERRIDE_FILE" << OVERRIDE
# ── Vortex Adaptive Memory Override ──────────────────────────────────────────
# Auto-generated by scripts/memory-config.sh — re-run after VPS upgrade.
# Do not edit manually; re-run the script instead.

# Memory limits (in bytes)
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
echo ""

# ── Restart services to apply new limits ─────────────────────────────────────
if docker compose -f "$REPO_ROOT/docker-compose.yml" ps &>/dev/null; then
  echo "  Restarting services with new memory limits..."
  docker compose -f "$REPO_ROOT/docker-compose.yml" up -d
  echo "  ✓ Services restarted"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Adaptive memory configuration complete!${NC}"
echo ""
echo "To re-configure after a VPS upgrade, just run:"
echo "  ${CYAN}bash scripts/memory-config.sh${NC}"
echo ""
echo "No code changes needed — the script auto-detects new specs."
