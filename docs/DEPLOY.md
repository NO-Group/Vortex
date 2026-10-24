# Deploy Vortex to Production

This guide walks you through deploying Vortex to a production server. It covers:
server setup, domain + SSL, Caddy reverse proxy, database, and first-run config.

## 1. Server Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 cores | 4+ cores |
| RAM | 2 GB | 4+ GB |
| Disk | 20 GB | 50+ GB (storage grows with uploads) |
| OS | Ubuntu 22.04+ / Debian 12+ | Ubuntu 24.04 LTS |
| Node.js | 20+ | 22 LTS |
| PostgreSQL | 16+ | 16+ |

## 2. Buy a Domain

**Yes, buy from Cloudflare.** Here's why:

- **Free DNS** — Cloudflare's DNS is fast and reliable worldwide
- **Free SSL** — Caddy (which we'll use) auto-provisions Let's Encrypt certs, but Cloudflare's edge also provides free SSL
- **Free CDN** — Cloudflare's CDN caches static assets at their edge
- **No upsells** — domain price is the domain price
- **WHOIS privacy** — included for free on most domains
- **.ng domains** — Cloudflare supports Nigerian domains if you're targeting Jos/Plateau/Nigeria

**How to buy:**
1. Go to [cloudflare.com/domains](https://cloudflare.com/domains)
2. Search for your domain
3. Buy it (typically $10-15/year for .com, ~₦40,000/year for .ng)
4. Set nameservers to Cloudflare's (they'll show you the two NS records)
5. Wait for DNS propagation (usually 5-30 minutes)

**Alternative:** Namecheap, Porkbun — also fine, just set nameservers to Cloudflare after.

## 3. Install Caddy

Caddy is the reverse proxy that handles TLS automatically. It's the simplest
production proxy — no cert management, no config hell.

```bash
# Install Caddy on Ubuntu/Debian
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

## 4. Clone and Build Vortex

```bash
# On your server
sudo -i  # or use a sudo user
cd /opt
git clone https://github.com/NO-Group/Vortex.git
cd Vortex
cp .env.example .env
```

## 5. Configure Environment

Edit `.env` with your production values:

```env
# ── Core ────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=8080

# ── Database ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://vortex:your-secure-password@localhost:5432/vortex
VORTEX_AUTO_MIGRATE=true

# ── JWT ──────────────────────────────────────────────────────────────────
# Generate a strong secret: openssl rand -base64 48
JWT_SECRET=your-base64-generated-secret

# ── Public URL (your domain) ─────────────────────────────────────────────
PUBLIC_APP_URL=https://vortex.example.com
CORS_ORIGINS=https://vortex.example.com,https://app.vortex.example.com

# ── Storage ─────────────────────────────────────────────────────────────
STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=/opt/Vortex/.vortex-data

# ── Console ──────────────────────────────────────────────────────────────
SERVE_CONSOLE=true

# ── Realtime ─────────────────────────────────────────────────────────────
VORTEX_REALTIME_BACKLOG=1000
# For multi-node: set REDIS_URL
# REDIS_URL=redis://localhost:6379

# ── Push Notifications (optional) ───────────────────────────────────────
# Web Push works with zero config. VAPID keys auto-generate.
# Persist them after first boot:
# VAPID_PUBLIC_KEY=
# VAPID_PRIVATE_KEY=
# VAPID_SUBJECT=noreply@vortex.example.com

# ── Edge Cache ───────────────────────────────────────────────────────────
EDGE_CACHE_TTL=300
EDGE_CACHE_MAX_ENTRIES=10000
```

## 6. Install Dependencies and Build

```bash
cd /opt/Vortex
npm ci
npm run build
```

## 7. Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql <<'SQL'
CREATE USER vortex WITH PASSWORD 'your-secure-password';
CREATE DATABASE vortex OWNER vortex;
SQL
```

## 8. Start Vortex

```bash
# Using Docker (recommended for production)
docker compose up -d

# Or without Docker (bare metal)
npm run start:server
```

## 9. Configure Caddy

Edit `/etc/caddy/Caddyfile`:

```
vortex.example.com {
    reverse_proxy localhost:8080
}
```

Restart Caddy:

```bash
sudo systemctl restart caddy
```

Caddy automatically:
- Detects your domain's DNS points to this server
- Obtains a Let's Encrypt SSL certificate
- Redirects HTTP → HTTPS
- Proxies to Vortex on port 8080

## 10. Create Your First Admin User

```bash
cd /opt/Vortex
npm run admin -- --email you@yourdomain.com
```

## 11. Verify

Open `https://vortex.example.com` in your browser. You should see the Vortex
console. Sign in with your admin credentials.

Check the health endpoint:
```bash
curl https://vortex.example.com/healthz
# → {"status":"ok","engine":"vortex","version":"0.1.0",...}
```

## 12. Enable Push Notifications (Optional)

Web Push works out of the box. To persist VAPID keys:

```bash
# Generate VAPID keys
node -e "const wp=require('web-push');console.log(JSON.stringify(wp.generateVAPIDKeys()))"
# → {"publicKey":"...","privateKey":"..."}

# Add to .env
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key
VAPID_SUBJECT=mailto:noreply@yourdomain.com
```

Restart Vortex. Go to the Push page in the console. Click "Enable Web Push".
Send yourself a test notification.

## 13. Backups

### PostgreSQL backups
```bash
# Daily backup
pg_dump -U vortex vortex > backup-$(date +%Y%m%d).sql

# Automate with cron:
# 0 2 * * * pg_dump -U vortex vortex > /backups/vortex-$(date +\%Y\%m\%d).sql
```

### Storage backups
```bash
# Backup all uploaded files
tar czf vortex-storage-$(date +%Y%m%d).tar.gz /opt/Vortex/.vortex-data/
```

## 14. Updates

To update Vortex:

```bash
cd /opt/Vortex
git pull
npm ci
npm run build
docker compose up -d
# Or if bare metal: restart the server process
```

## 15. Security Checklist

- [ ] Strong JWT_SECRET (48+ chars, base64)
- [ ] Strong PostgreSQL password
- [ ] CORS_ORIGINS set to your actual domains
- [ ] HTTPS enforced (Caddy does this automatically)
- [ ] Rate limiting enabled (server + Caddy)
- [ ] Firewall: only port 80, 443, and 22 open
- [ ] Regular PostgreSQL backups
- [ ] Storage volume backups
- [ ] VAPID keys persisted

## 16. Domain DNS Setup (Cloudflare)

After buying from Cloudflare:

1. Add your domain to Cloudflare
2. Set nameservers to Cloudflare's (they'll show two NS records)
3. In Cloudflare DNS settings:
   - Add an **A record**: `@` → your server's IP
   - Add an **A record**: `www` → your server's IP (optional)
4. Set SSL/TLS mode to **Full** (not Flexible)
5. Wait for DNS propagation

Caddy will detect the domain and auto-provision SSL.

## Troubleshooting

### Caddy can't get SSL certificate
- Make sure port 80 and 443 are open on your server
- Make sure DNS points to your server IP
- Check: `sudo journalctl -u caddy -n 50`

### Vortex won't start
- Check: `docker compose logs vortex-server`
- Make sure PostgreSQL is running and accessible
- Make sure `.env` has valid DATABASE_URL

### Console not loading
- Make sure `SERVE_CONSOLE=true` in `.env`
- Make sure the dashboard was built: `npm run build`
- Check: `curl https://yourdomain.com/healthz`

### Web Push not working
- Make sure you're on HTTPS (push requires secure context)
- Check browser console for service worker errors
- Verify VAPID key is set in `.env`
