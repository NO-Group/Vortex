# Launching Vortex — from repo to a live product

This is the whole playbook: what to rent, what to type, and what "live" means.
You do **not** need a domain to start. You need a domain when you want a clean
public address (`vortex.yourbrand.com`) instead of `http://123.45.67.89:8080`.

---

## 0. What you are deploying

One container serves **everything**:

| Surface | Where |
| --- | --- |
| Vortex Console (the dashboard) | `https://your-domain/` |
| Engine API | `https://your-domain/v1/…` |
| Hosted apps (Vortex Apps) | `https://your-domain/apps/<name>/` |
| Vortex Functions | `https://your-domain/functions/<name>` |
| Realtime | `wss://your-domain/v1/realtime` |

Minimum bill to be usable by anyone on the internet:

| Item | Where | Cost |
| --- | --- | --- |
| A small VPS (2 vCPU / 2 GB) | Hetzner, DigitalOcean, Vultr, Contabo, Oracle free tier | ~$5–6/mo |
| A domain name (optional at first) | Cloudflare Registrar, Namecheap, Porkbun | ~$10/year |
| Email sending (optional; magic links) | Brevo / Resend / Mailgun free tiers | $0 to start |
| Object storage (optional; local disk works) | Cloudflare R2 free tier, Backblaze B2 | $0 to start |

---

## 1. The fastest honest path (no domain yet)

**Rent a VPS** (Hetzner CX22 or a $5 DigitalOcean droplet, Ubuntu 24.04).

**On the VPS:**

```bash
# 1. Docker
curl -fsSL https://get.docker.com | sh

# 2. Get Vortex
git clone https://github.com/NO-Group/Vortex.git
cd Vortex

# 3. Configure
cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # → paste as JWT_SECRET
nano .env      # set JWT_SECRET, and PUBLIC_APP_URL=http://YOUR_SERVER_IP:8080

# 4. Launch
docker compose up -d --build

# 5. Make yourself admin
docker compose exec vortex-server node -e "
  const {Client}=require('pg');
  (async()=>{const db=new Client({connectionString:process.env.DATABASE_URL});
  await db.connect();
  await db.query('UPDATE users SET role=\'admin\' WHERE email=\$1',[process.argv[1]]);
  await db.end();console.log('promoted');})()" you@your-email.com
```

Open **http://YOUR_SERVER_IP:8080**, sign up with that email, and you are in —
console, SQL, functions, apps, everything. That URL already works for anyone;
it just isn't pretty. Share it with testers today.

> Tip: the same promote can be run from your machine if `DATABASE_URL` points
> at the server's Postgres: `npm run admin -- promote you@your-email.com`.

---

## 2. The domain (when you want one)

1. **Buy it** — Cloudflare Registrar / Porkbun / Namecheap (~$10/yr for a `.com`).
2. **Point DNS** — in your registrar's DNS panel, add:
   ```
   A     @      YOUR_SERVER_IP
   A     www    YOUR_SERVER_IP
   ```
3. **Put Caddy in front** (free automatic HTTPS — this is the easy part):

   ```bash
   # on the VPS
   sudo apt install -y caddy
   ```

   `/etc/caddy/Caddyfile`:
   ```
   your-domain.com {
       reverse_proxy 127.0.0.1:8080
   }
   ```

   ```bash
   sudo systemctl reload caddy
   ```

   Caddy fetches and renews TLS certificates automatically. That's it —
   `https://your-domain.com` is live.

4. **Update `.env`** on the server and restart:
   ```bash
   PUBLIC_APP_URL=https://your-domain.com
   PUBLIC_API_BASE=auto
   CORS_ORIGINS=https://your-domain.com
   docker compose up -d
   ```

---

## 3. Storage — how "the storage thing" works in production

Objects (uploads, hosted-app files) live under **bucket** namespaces.
Two drivers, one variable:

**A. Local disk (fine to start).** `STORAGE_DRIVER=local` — files persist in
the `appdata` Docker volume (survives restarts and `docker compose down`).
Back it up with a volume snapshot or `tar` of the volume.

**B. S3-compatible (recommended once real users arrive).** Cloudflare R2
(free 10 GB, no egress fees — best deal), Backblaze B2, or AWS S3:

```bash
STORAGE_DRIVER=s3
S3_BUCKET=your-vortex-bucket
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com   # R2 example
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
```

Create the bucket once in the provider's dashboard (private is fine; Vortex
handles public/private semantics per bucket itself). Nothing else changes —
presigned URLs, apps, and the console all use the same gateway.

**Database backups:** add a nightly `pg_dump` cron (or use your provider's
managed Postgres and set `DATABASE_URL` to it):

```bash
0 3 * * * docker compose exec -T postgres pg_dump -U vortex vortex | gzip > /backups/vortex-$(date +\%F).sql.gz
```

---

## 4. Email — magic links that land in real inboxes

Without SMTP, sign-in links only work in dev mode (`VORTEX_DEV_LINKS=true`
returns them inline — never leave that on in production).

With SMTP (Brevo, Resend, Mailgun, Postmark, SES all offer free tiers and
SMTP credentials):

```bash
SMTP_URL=smtps://user:pass@smtp.host:465
MAIL_FROM=Vortex <no-reply@your-domain.com>
# VORTEX_DEV_LINKS must be off/false
```

The engine sends branded sign-in and password-reset mails; the links point
back at `PUBLIC_APP_URL` and the console signs the user in on click.

---

## 5. Go-live checklist

- [ ] `JWT_SECRET` is a long random string (the engine **refuses to boot** in
      production with the default — you'll notice immediately)
- [ ] `NODE_ENV=production` (the Docker image sets this)
- [ ] `VORTEX_DEV_LINKS` is **off** (or unset) once SMTP works
- [ ] `PUBLIC_APP_URL` is your real `https://` origin
- [ ] `CORS_ORIGINS` lists your real origin(s) instead of `*`
- [ ] `SMTP_URL` configured; send yourself a magic link as a test
- [ ] Admin accounts exist (`npm run admin -- list`); only trusted emails are `admin`
- [ ] Database backup cron (or managed Postgres) is running
- [ ] Storage: S3 configured **or** the `appdata` volume is being snapshotted
- [ ] `https://your-domain.com` loads the console and `https://your-domain.com/healthz` returns `{"status":"ok"}`

## 6. Keeping it alive

```bash
docker compose logs -f vortex-server     # engine logs (401/403s are logged with path)
docker compose pull && docker compose up -d --build   # upgrade after git pull
```

Health is monitored at `/healthz`. Scale later by adding more engines behind
the same proxy with `REDIS_URL` set — they form one realtime fabric (v0.4).

---

## 7. Answers to the usual questions

**"Do I buy a domain now?"** Not required. Start on `http://IP:8080` today;
buy the domain the day you share it publicly. Both paths are above.

**"Is it usable by anyone right now?"** Yes — signup is open the moment the
port is reachable. A domain just makes the address trustworthy and enables HTTPS.

**"What about apps I host on it?"** Every deployed app lives at
`https://your-domain/apps/<name>/` with its own SPA routing — no extra config.

**"How much does all this cost?"** ~$5/month for the VPS to start. Domain
~$10/year when you want one. Email + object storage have free tiers.

**"Can I use managed Postgres instead of the bundled one?"** Yes — point
`DATABASE_URL` at Neon/Supabase-Postgres/RDS and drop the `postgres` service.
