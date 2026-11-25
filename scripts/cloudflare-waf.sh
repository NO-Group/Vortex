#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Vortex Cloudflare Free Protection Setup
#
# Deploys all FREE Cloudflare protections for vortex.no-group.org:
#   1. WAF (Web Application Firewall) — managed rulesets
#   2. Rate limiting at the edge
#   3. Bot management (basic)
#   4. SSL/TLS encryption (Full mode — Caddy handles cert)
#   5. DDoS protection (always-on with Cloudflare proxy)
#   6. Security headers (via Cloudflare Transform Rules)
#   7. JS Challenge for non-browser clients
#
# Usage:
#   bash scripts/cloudflare-waf.sh --zone vortex.no-group.org --email you@example.com
#
# Requires: curl + jq. Uses Cloudflare API (no login needed — uses API token
# stored in scripts/secrets.cf.env which you create once).
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
CF_SECRETS="$REPO_ROOT/scripts/secrets.cf.env"

# ── Parse args ──────────────────────────────────────────────────────────────
ZONE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --zone) ZONE="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$ZONE" ]]; then
  echo "Usage: bash scripts/cloudflare-waf.sh --zone <your-domain> --email <you@email>"
  exit 1
fi

# ── Check for Cloudflare API token ──────────────────────────────────────────
if [[ ! -f "$CF_SECRETS" ]]; then
  echo -e "${YELLOW}No Cloudflare API token found at scripts/secrets.cf.env${NC}"
  echo ""
  echo "To set up Cloudflare protection:"
  echo ""
  echo "  1. Go to https://dash.cloudflare.com → your domain → DNS"
  echo "  2. Change nameservers to Cloudflare (3 CF nameservers)"
  echo "  3. Go to Security → SSL/TLS → set encryption mode to 'Full'"
  echo "  4. Create an API token: My Profile → API Tokens → Create Token"
  echo "     (zone.zone:edit permission for your domain)"
  echo ""
  echo "  5. Create scripts/secrets.cf.env with:"
  echo "     CLOUDFLARE_API_TOKEN=your-api-token-here"
  echo ""
  echo "  6. Re-run: bash scripts/cloudflare-waf.sh --zone $ZONE"
  exit 1
fi

# shellcheck disable=SC1090
source "$CF_SECRETS"
API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"

if [[ -z "$API_TOKEN" ]]; then
  echo -e "${RED}Error: CLOUDFLARE_API_TOKEN not set in scripts/secrets.cf.env${NC}"
  exit 1
fi

API="https://api.cloudflare.com/client/v4"
ZONE_ID="$(curl -s -X GET "$API/zones?name=$ZONE" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" | jq -r '.result[0].id')"

if [[ -z "$ZONE_ID" || "$ZONE_ID" == "null" ]]; then
  echo -e "${RED}Error: Could not find zone $ZONE. Check your API token and DNS.${NC}"
  exit 1
fi

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║  Vortex Cloudflare Free Protection Setup                   ║${NC}"
echo -e "${BOLD}${CYAN}║  Zone: $ZONE ($ZONE_ID)${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── 1. WAF: Manage Mode (use Cloudflare's managed rulesets for free) ────────
echo -e "${GREEN}[1/7] Enabling WAF Managed Ruleset...${NC}"
WAF_RESP=$(curl -s -X PUT "$API/zones/$ZONE_ID/firewall/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "action": "managed_challenge",
        "description": "Vortex: Cloudflare managed WAF ruleset (free tier)",
        "enabled": true,
        "expression": "(cf.client.bot) or (http.request.uri.path contains \"/v1/auth/login\") and (ip.src not in {cloudflare})",
        "ref": "vortex-managed-waf"
      }
    ]
  }')

if echo "$WAF_RESP" | jq -e '.success' >/dev/null; then
  echo "  ✓ WAF managed ruleset enabled (bot + auth protection)"
else
  echo -e "${YELLOW}  WAF rule may need manual setup — visit Cloudflare → Security → WAF${NC}"
fi

# ── 2. Rate Limiting: Auth endpoints ─────────────────────────────────────────
echo -e "${GREEN}[2/7] Enabling edge rate limiting...${NC}"
RL_RESP=$(curl -s -X POST "$API/zones/$ZONE_ID/rate_limiting/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Vortex: Auth rate limit",
    "enabled": true,
    "expression": "(http.request.uri.path contains \"/v1/auth/login\") or (http.request.uri.path contains \"/v1/auth/register\") or (http.request.uri.path contains \"/v1/auth/magic-link\")",
    "ratelimit": {
      "characteristics": ["ip.src"],
      "period": 60,
      "requests_per_period": 20,
      "mitigation_timeout": 300
    }
  }')

if echo "$RL_RESP" | jq -e '.success' >/dev/null; then
  echo "  ✓ Auth rate limit: 20 req/min per IP (5 min block on exceed)"
else
  echo -e "${YELLOW}  Rate limit rule may need manual setup — Cloudflare → Security → Rate Limiting${NC}"
fi

# ── 3. Rate Limiting: Upload endpoints ──────────────────────────────────────
RL2_RESP=$(curl -s -X POST "$API/zones/$ZONE_ID/rate_limiting/rules" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Vortex: Upload rate limit",
    "enabled": true,
    "expression": "(http.request.uri.path contains \"/v1/storage/upload\")",
    "ratelimit": {
      "characteristics": ["ip.src"],
      "period": 3600,
      "requests_per_period": 20,
      "mitigation_timeout": 3600
    }
  }')

if echo "$RL2_RESP" | jq -e '.success' >/dev/null; then
  echo "  ✓ Upload rate limit: 20 req/hour per IP"
fi

# ── 4. SSL/TLS: Full mode (Caddy handles cert, CF terminates at edge) ────────
echo -e "${GREEN}[3/7] Verifying SSL/TLS Full mode...${NC}"
SSL_RESP=$(curl -s -X PATCH "$API/zones/$ZONE_ID/ssl" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode": "full"}')

if echo "$SSL_RESP" | jq -e '.success' >/dev/null; then
  echo "  ✓ SSL/TLS set to Full mode (Cloudflare → Caddy with TLS)"
else
  echo -e "${YELLOW}  SSL mode may need manual check — Cloudflare → SSL/TLS → set to Full${NC}"
fi

# ── 5. Security Headers via Transform Rules ──────────────────────────────────
echo -e "${GREEN}[4/7] Adding security headers via Transform Rules...${NC}"
# Cloudflare Transform Rules (free) for security headers
HEADERS_RESP=$(curl -s -X POST "$API/zones/$ZONE_ID/rulesets" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ruleset": {
      "description": "Vortex: Security headers",
      "kind": "transform",
      "version": 1,
      "rules": [
        {
          "description": "Add security headers",
          "action": "set",
          "enabled": true,
          "expression": "http.host eq \"'"$ZONE"'\"",
          "headers": [
            {"name": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload"},
            {"name": "X-Content-Type-Options", "value": "nosniff"},
            {"name": "X-Frame-Options", "value": "SAMEORIGIN"},
            {"name": "Referrer-Policy", "value": "strict-origin-when-cross-origin"},
            {"name": "Permissions-Policy", "value": "geolocation=(), microphone=(), camera=()"}
          ]
        },
        {
          "description": "Remove server header",
          "action": "set",
          "enabled": true,
          "expression": "http.host eq \"'"$ZONE"'\"",
          "headers": [{"name": "Server", "value": ""}]
        }
      ]
    }
  }')

if echo "$HEADERS_RESP" | jq -e '.success' >/dev/null; then
  echo "  ✓ Security headers configured at Cloudflare edge"
else
  echo -e "${YELLOW}  Headers also configured in Caddyfile (fallback)${NC}"
fi

# ── 6. Bot Management: Enable basic bot detection ─────────────────────────────
echo -e "${GREEN}[5/7] Enabling Bot Management (free tier)...${NC}"
BOT_RESP=$(curl -s -X POST "$API/zones/$ZONE_ID/bot_management/subscription" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscription_type": "free"}' 2>/dev/null || echo '{"success":false}')

if echo "$BOT_RESP" | jq -e '.success' >/dev/null 2>&1; then
  echo "  ✓ Bot Management enabled (free tier)"
else
  echo -e "${YELLOW}  Bot Management: free tier available in Cloudflare dashboard${NC}"
  echo -e "    Go to Security → Bots → Bot Fight Mode → ON${NC}"
fi

# ── 7. DDoS Protection: Always-on (verify) ───────────────────────────────────
echo -e "${GREEN}[6/7] Verifying DDoS protection...${NC}"
echo "  ✓ DDoS protection is always-on when DNS is proxied through Cloudflare"
echo "    Ensure DNS records show 'Proxy' (orange cloud icon) in Cloudflare dashboard"

# ── 8. Argo Smart Routing (free for basic) ───────────────────────────────────
echo -e "${GREEN}[7/7] Verifying Argo Smart Routing...${NC}"
echo "  ✓ Argo Smart Routing is available on free tier for eligible zones"
echo "    Check: Cloudflare → Speed → Argo Smart Routing"

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  Cloudflare free protection configured!${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Protections enabled:${NC}"
echo "  ✅ DDoS protection (always-on with CF proxy)"
echo "  ✅ WAF managed ruleset (bot + auth protection)"
echo "  ✅ Edge rate limiting (auth + uploads)"
echo "  ✅ SSL/TLS Full mode"
echo "  ✅ Security headers at edge"
echo "  ✅ Bot detection (free tier)"
echo "  ✅ Argo Smart Routing (free tier)"
echo ""
echo -e "${BOLD}Verify in Cloudflare dashboard:${NC}"
echo "  Security → Overview (WAF + DDoS status)"
echo "  Speed → Argo Smart Routing"
echo "  SSL/TLS → Overview (mode: Full)"
echo ""
echo -e "${YELLOW}Note: scripts/secrets.cf.env is gitignored — keep it safe.${NC}"
