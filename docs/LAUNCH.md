# 🚀 Vortex Launch Checklist

Everything you need to go from **VPS purchased** → **Vortex live** → **social app testing** → **public launch**.

---

## Phase 1: VPS & Infrastructure Setup

### 1.1 Buy the VPS

| Item | Recommendation |
|------|---------------|
| **Provider** | Hetzner, DigitalOcean, or Vultr |
| **VPS Plan** | 4GB RAM, 2 vCPU, 80GB SSD (minimum) |
| **OS** | Ubuntu 24.04 LTS or Debian 12 |
| **Location** | Pick the region closest to your target users |
| **Budget** | ~$6–12/month for a solid starting VPS |

### 1.2 Server Initialization

- [ ] SSH into the VPS: `ssh root@YOUR_VPS_IP`
- [ ] Update packages: `apt update && apt upgrade -y`
- [ ] Set up a non-root user with sudo (best practice)
- [ ] Configure SSH key authentication (disable password login)
- [ ] Install firewall (UFW): `ufw allow 22,80,443`
- [ ] Get your server IP: `curl ifconfig.me`

### 1.3 DNS Setup

- [ ] Buy a domain (Namecheap, Cloudflare, Porkbun — ~$10/year)
- [ ] Add an **A record**: `@` and `www` → your VPS IP
- [ ] Wait for DNS propagation (5–60 minutes, check at `whatsmydns.net`)

---

## Phase 2: Deploy Vortex

### 2.1 Run the Deployment Script

```bash
# On your VPS
git clone https://github.com/NO-Group/Vortex.git
cd Vortex
sudo bash scripts/deploy.sh
```

This automatically:
- ✅ Installs Docker + Docker Compose
- ✅ Installs Caddy (TLS/SSL reverse proxy)
- ✅ Generates secure JWT secret, Postgres password, MinIO password
- ✅ Creates `.env` with production settings
- ✅ Builds all services (Postgres, Redis, MinIO, Vortex engine)
- ✅ Starts all containers
- ✅ Verifies health checks

### 2.2 Configure Your Domain

- [ ] Edit `Caddyfile` — change `vortex.example.com` to your domain
- [ ] Start Caddy: `caddy start`
- [ ] Verify HTTPS works: `curl -I https://your-domain.com`
- [ ] Check for Caddy log errors: `journalctl -u caddy -f`

### 2.3 Configure Email (Required)

- [ ] Choose an email provider (Resend, Brevo, Mailgun, Postmark, SES)
- [ ] Get SMTP credentials from your provider
- [ ] Edit `.env` and set `SMTP_URL=smtps://user:pass@smtp.host:465`
- [ ] Set `MAIL_FROM=Vortex <no-reply@your-domain.com>`
- [ ] Restart: `docker compose restart vortex-server`
- [ ] Test: create an account and check if verification email arrives

### 2.4 Create Admin Account

```bash
docker compose exec vortex-server npm run admin -- promote you@example.com
```

- [ ] Verify you can log in to the dashboard at `https://your-domain.com`
- [ ] Test dashboard features: create a database table, upload a file, test realtime

---

## Phase 3: Test with Social App

### 3.1 Build the Social App

This is your **proof of concept** — a single social app to validate Vortex end-to-end.

**Core features to build:**
- [ ] User authentication (signup, login, magic links)
- [ ] User profiles (name, avatar, bio)
- [ ] Posts (create, read, delete — CRUD over Vortex database)
- [ ] Comments on posts
- [ ] Likes on posts
- [ ] Realtime feed (new posts appear instantly via WebSocket)
- [ ] File uploads (avatars, post images via presigned URLs)
- [ ] Follow/unfollow users

**Tech stack suggestion:**
- Frontend: Next.js, React, or SvelteKit
- Vortex SDK: REST API + WebSocket for realtime
- Styling: Tailwind CSS (matches Vortex design system)

### 3.2 Test All Vortex Services

Before going public, verify every Vortex feature works:

| Service | Test | How |
|---------|------|-----|
| **Auth** | Signup, login, JWT tokens, 2FA | Create accounts, log in, check token flow |
| **Database** | CRUD, filters, pagination, RBAC | Create tables, insert/update/delete rows, test filters |
| **Storage** | Presigned URLs, uploads, downloads | Upload a file, verify it's accessible |
| **Realtime** | WebSocket, pub/sub, events | Create a post, verify it appears in realtime feed |
| **Webhooks** | Event delivery | Set up a webhook, trigger an event, verify delivery |
| **Security** | RBAC, validation, headers | Test unauthorized access is blocked |

### 3.3 Performance Test

- [ ] Create 100 test posts and verify realtime latency (<50ms)
- [ ] Upload 50 files and verify storage performance
- [ ] Test with multiple concurrent users (simulate with a script)
- [ ] Check server resource usage: `docker stats`

### 3.4 Fix Issues

- [ ] Address any bugs found during testing
- [ ] Optimize queries if slow queries appear in logs
- [ ] Adjust rate limits in Caddyfile if needed
- [ ] Set up log monitoring: `docker compose logs -f`

---

## Phase 4: Pre-Launch Preparation

### 4.1 Production Hardening

- [ ] **Change default credentials** — all passwords, admin email
- [ ] **Set CORS_ORIGINS** to your actual domain (remove `*`)
- [ ] **Set MAX_QUERY_COST** to prevent expensive queries
- [ ] **Enable audit logging** — set `SLOW_QUERY_MS` to a reasonable value
- [ ] **Set up backups** — Postgres backups, MinIO snapshots
- [ ] **Configure Caddy rate limits** — adjust for expected traffic
- [ ] **Set up monitoring** — check server health, disk space, memory

### 4.2 Backup Strategy

```bash
# Postgres backup
docker compose exec postgres pg_dump -U vortex vortex > backup-$(date +%Y%m%d).sql

# MinIO snapshot (use mc client)
mc alias set local http://localhost:9000 vortex YOUR_MINIO_PASS
mc mirror --overwrite local/vortex /backup/minio/vortex-$(date +%Y%m%d)

# Schedule daily backups with cron
# 0 2 * * * /path/to/backup-script.sh
```

- [ ] Set up automated Postgres backups (daily)
- [ ] Set up automated MinIO snapshots (daily)
- [ ] Store backups off-server or in cloud storage
- [ ] Test restore procedure

### 4.3 Landing Site Final Check

The landing site is already built with 24 pages. Final checks:

- [ ] Verify all pages load without errors
- [ ] Test navigation on mobile and desktop
- [ ] Check that pricing toggle works (monthly/annual)
- [ ] Test FAQ search filter
- [ ] Verify contact form works
- [ ] Check all internal links resolve correctly
- [ ] Verify logo displays correctly on all pages
- [ ] Test AuthModal opens from CTA buttons

### 4.4 Documentation

- [ ] Update `.env.example` if any new vars were added
- [ ] Update README.md with launch instructions
- [ ] Document the admin account creation process
- [ ] Document backup/restore procedures
- [ ] Document the social app test results

---

## Phase 5: Go Public 🚀

### 5.1 Soft Launch (Closed Beta)

- [ ] Invite 5–10 trusted users to test the social app
- [ ] Collect feedback on: performance, bugs, UX, features
- [ ] Fix issues found during beta
- [ ] Monitor server load and resource usage
- [ ] Verify all systems stable for 48+ hours

### 5.2 Public Launch

- [ ] Announce on social media / community channels
- [ ] Update landing site with launch messaging
- [ ] Monitor server in real-time for first 24 hours
- [ ] Watch for errors in logs: `docker compose logs -f vortex-server`
- [ ] Monitor resource usage: `docker stats`
- [ ] Have a rollback plan ready (snapshot your VPS)

### 5.3 Post-Launch

- [ ] Set up uptime monitoring (UptimeRobot, Status page)
- [ ] Set up log aggregation (Loki, Grafana, or simple log rotation)
- [ ] Create a status page (Vortex already has one at `#/status`)
- [ ] Plan first update: feedback-driven improvements
- [ ] Update the Changelog page with launch announcement
- [ ] Update the Roadmap page with progress

---

## Quick Reference: Essential Commands

```bash
# Service management
docker compose ps              # Check status
docker compose logs -f         # View logs
docker compose restart         # Restart all
docker compose restart vortex-server  # Restart engine only
docker compose down            # Stop all
docker compose up -d           # Start all

# Health check
curl -I https://your-domain.com/healthz
docker inspect --format='{{.State.Health.Status}}' vortex-server

# Backup
docker compose exec postgres pg_dump -U vortex vortex > backup.sql
docker compose exec vortex-server npm run admin -- promote email@domain.com

# Caddy
caddy start                    # Start Caddy
caddy stop                     # Stop Caddy
journalctl -u caddy -f         # Caddy logs
```

---

## Cost Estimate (Monthly)

| Item | Cost |
|------|------|
| VPS (4GB / 2vCPU) | $6–12 |
| Domain | ~$1/month (annual) |
| Email (Resend/Brevo free tier) | $0–$20 |
| Cloudflare (DNS + CDN) | $0 |
| **Total** | **~$7–33/month** |

This is extremely lean for a full BaaS platform — the user self-hosts everything.

---

*Last updated: 2026-10-23*
