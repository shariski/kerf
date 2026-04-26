# Deployment

End-to-end checklist for deploying kerf to a single VPS via Docker
Compose. Per CLAUDE.md §B9, this document is **developer scope** —
Claude Code generates artifacts (Dockerfile, compose, scripts) but
does not execute deployment. You run every command here.

---

## Scope

What you'll have at the end:

- kerf running at `https://<your-domain>` on a VPS you control.
- Postgres in a sibling container, persisted to a named Docker volume,
  with daily gzipped backups dumped to `./backups/`.
- Reverse proxy (nginx + certbot) handling TLS termination via Let's Encrypt.
- Magic-link emails delivered through Resend with a verified domain.
- (Optional) Google + GitHub social login.

What this guide assumes:

- You can SSH into a VPS and have `sudo`. Tested against Debian 12 /
  Ubuntu 22.04+, but should work on any modern Linux.
- You own a domain with DNS you can edit.
- You're shipping the local checkout — no CI/CD. (Per Task 4.6 in
  `docs/03-task-breakdown.md`, CI/CD is explicitly out of scope.)

---

## Pre-flight checklist

Before starting, gather these:

- [ ] VPS hostname + SSH access (ideally key-based, not password).
- [ ] Domain name (e.g. `typekerf.com`) with control over its DNS.
- [ ] Resend account at <https://resend.com> (free tier: 3,000/month).
- [ ] (Optional) Google OAuth app — Cloud Console > APIs & Services > Credentials.
- [ ] (Optional) GitHub OAuth app — github.com/settings/developers.
- [ ] A way to receive forwarded mail at `hello@<your-domain>`
  (Cloudflare Email Routing or ImprovMX both work for free).

---

## Step 1 — Provision the VPS

- [ ] Provision a VPS (1 vCPU + 2 GB RAM is enough for early kerf;
      4 GB if you expect any meaningful concurrent load).
- [ ] Add your SSH key, disable root password login, create a
      non-root sudoer for day-to-day work.
- [ ] Update + install basics:

      sudo apt update && sudo apt -y upgrade
      sudo apt -y install ca-certificates curl gnupg ufw

- [ ] Install Docker Engine + Compose plugin (official script):

      curl -fsSL https://get.docker.com | sudo sh
      sudo usermod -aG docker "$USER"
      newgrp docker  # or log out + back in

- [ ] Verify:

      docker version
      docker compose version

---

## Step 2 — DNS

Point the domain at the VPS so TLS issuance works.

- [ ] At your DNS provider, add an `A` record:

      typekerf.com.        A  <VPS-IPv4>
      www.typekerf.com.    A  <VPS-IPv4>

  (Add `AAAA` records if your VPS has IPv6.)

- [ ] Wait for propagation, then sanity-check from your laptop:

      dig +short typekerf.com

  Should return your VPS IP. (If it doesn't, give it 5–30 minutes —
  most DNS hosts are fast, but Namecheap-style budget hosts are slow.)

---

## Step 3 — Firewall

- [ ] Allow only SSH + HTTP + HTTPS:

      sudo ufw default deny incoming
      sudo ufw default allow outgoing
      sudo ufw allow ssh
      sudo ufw allow 80/tcp
      sudo ufw allow 443/tcp
      sudo ufw --force enable
      sudo ufw status

- The compose file binds the app to `127.0.0.1:3000` only, so
  port 3000 is *not* exposed publicly even without a firewall rule.
  Belt + suspenders.

---

## Step 4 — Reverse proxy + TLS (nginx)

nginx + certbot is the standard pattern on Debian/Ubuntu. Fastest
path: install nginx, drop in a basic HTTP-only server block that
proxies to the app on `127.0.0.1:3000`, then run certbot to add TLS
and the HTTP→HTTPS redirect automatically.

- [ ] Install nginx + certbot:

      sudo apt -y install nginx certbot python3-certbot-nginx

- [ ] Create `/etc/nginx/sites-available/kerf` with:

      server {
          listen 80;
          listen [::]:80;
          server_name typekerf.com www.typekerf.com;

          gzip on;
          gzip_types text/html application/json text/css application/javascript image/svg+xml;

          location / {
              proxy_pass http://127.0.0.1:3000;
              proxy_http_version 1.1;
              proxy_set_header Host $host;
              proxy_set_header X-Real-IP $remote_addr;
              # X-Forwarded-For is required — the better-auth rate
              # limiter buckets per real client IP via this header
              # (see src/server/auth.ts advanced.ipAddress). Without
              # this line every request looks like it's from the
              # nginx host and the per-IP cap collapses into an
              # app-wide cap.
              proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
              proxy_set_header X-Forwarded-Proto $scheme;
              # WebSocket upgrade headers — not used by kerf today,
              # cheap to include for future-proofing.
              proxy_set_header Upgrade $http_upgrade;
              proxy_set_header Connection "upgrade";
          }
      }

- [ ] Activate the site + drop the default:

      sudo ln -s /etc/nginx/sites-available/kerf /etc/nginx/sites-enabled/kerf
      sudo rm /etc/nginx/sites-enabled/default
      sudo nginx -t              # syntax check
      sudo systemctl reload nginx

- [ ] Issue the Let's Encrypt cert + auto-add the HTTPS redirect
      (certbot edits the nginx config in place):

      sudo certbot --nginx -d typekerf.com -d www.typekerf.com

  When prompted, choose option **2** to redirect all HTTP traffic to
  HTTPS. Auto-renewal is set up via a systemd timer — verify with:

      systemctl list-timers | grep certbot

- [ ] From your laptop:

      curl -I https://typekerf.com/
      # → 502 Bad Gateway is expected — nginx is up but kerf isn't
      #   running yet. Cert chain should validate (no warning).

### Caddy alternative

Caddy is a one-block config and auto-issues + auto-renews Let's
Encrypt certs without certbot. If you'd rather use it, install per
<https://caddyserver.com/docs/install> and replace `/etc/caddy/Caddyfile`:

    typekerf.com, www.typekerf.com {
        encode gzip zstd
        reverse_proxy 127.0.0.1:3000
    }

Caddy forwards `X-Forwarded-For` by default, so no extra config is
needed for the rate limiter to work.

---

## Step 5 — Email (Resend)

- [ ] Sign up at <https://resend.com> (free tier: 3,000/month).
- [ ] Paste the API key — you'll add it to `.env` in Step 8.
- [ ] **Verify your sending domain** at <https://resend.com/domains>:
      add the SPF + DKIM TXT records to your DNS provider, then click
      "Verify" in the Resend dashboard. Until verified, real sends are
      restricted to `onboarding@resend.dev`.
- [ ] Once verified, your `EMAIL_FROM` can use the branded address —
      e.g. `kerf <hello@typekerf.com>`. No code change is needed;
      `src/server/email/send.ts` reads this env var with the sandbox
      sender as the default fallback.

## Step 6 — Inbound mail forwarding

The `/contact` page surfaces `hello@<your-domain>`. You need that
address to actually receive mail.

- [ ] Configure email forwarding for `hello@typekerf.com` →
      your personal inbox. Cloudflare Email Routing (free, requires
      Cloudflare-managed DNS) and ImprovMX (free tier) are both
      reasonable choices.
- [ ] Consider also setting up `support@typekerf.com` as an alias to
      the same inbox so users who guess that pattern don't dead-end.

---

## Step 7 — OAuth providers (optional)

Skip this section if you only want magic-link auth at launch — magic-link
works without any of these creds. Add providers later if you want them.

### Google

- [ ] Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID.
- [ ] Application type: Web application.
- [ ] Authorized redirect URI: `https://typekerf.com/api/auth/callback/google`
      (and `http://localhost:3000/api/auth/callback/google` for dev).
- [ ] Copy Client ID + Client Secret — they go in `.env` next step.

### GitHub

- [ ] github.com/settings/developers > New OAuth App.
- [ ] Authorization callback URL: `https://typekerf.com/api/auth/callback/github`
- [ ] Copy Client ID + Client Secret.

---

## Step 8 — Application secrets

- [ ] Pick a directory on the VPS:

      sudo mkdir -p /opt/kerf
      sudo chown "$USER:$USER" /opt/kerf
      cd /opt/kerf

- [ ] Clone the repo (or `rsync` from your laptop — either works):

      git clone https://github.com/shariski/kerf.git .

- [ ] Generate fresh secrets:

      openssl rand -base64 32   # → AUTH_SECRET
      openssl rand -base64 32   # → POSTGRES_PASSWORD

- [ ] Copy the template and edit:

      cp .env.production.example .env
      $EDITOR .env

  Fill in:
  - `POSTGRES_PASSWORD` (the one you just generated)
  - `DATABASE_URL` (matches POSTGRES_USER/PASSWORD/DB; hostname stays `postgres`)
  - `AUTH_SECRET` (the other one you generated)
  - `AUTH_URL=https://typekerf.com`
  - `RESEND_API_KEY`
  - `EMAIL_FROM=kerf <hello@typekerf.com>` (after Resend domain verified)
  - `GOOGLE_*` / `GITHUB_*` if Step 7 was done

- [ ] Lock the file down:

      chmod 600 .env

---

## Step 9 — First deploy

The compose file separates `postgres`, `app`, and a profile-gated
`migrate` one-shot. Order matters on first run:

- [ ] Bring up postgres alone first so it can initialize:

      docker compose -f docker-compose.prod.yml up -d postgres
      docker compose -f docker-compose.prod.yml ps  # wait for "healthy"

- [ ] Run migrations (one-shot, exits when done):

      docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate

  This builds the `build` Dockerfile target (which has drizzle-kit)
  and applies every migration in `src/server/db/migrations/`.

- [ ] Build + start the app:

      docker compose -f docker-compose.prod.yml up -d --build app

- [ ] Watch logs until you see the listen line:

      docker compose -f docker-compose.prod.yml logs -f app
      # → "Listening on: http://localhost:3000/ (all interfaces)"

---

## Step 10 — Smoke test

- [ ] From your laptop:

      curl -fsS https://typekerf.com/api/health
      # → {"ok":true}

- [ ] Open `https://typekerf.com` in a browser. Should render the
      landing page.

- [ ] Visit `/login`, request a magic-link, confirm:
      1. Email arrives within ~30 seconds in Gmail web + Apple Mail.
      2. The link resolves to `https://typekerf.com/...` (NOT localhost).
      3. Clicking it logs you in.

- [ ] Complete onboarding, run one practice session, check that
      stats appear on the dashboard. This exercises:
      - Account creation
      - Session persistence (server `persistSession` write path)
      - Per-profile stat aggregation (read path)

  If any step fails, see "Troubleshooting" below before continuing.

---

## Step 11 — Backups

- [ ] Make the backup script executable (one-time):

      chmod +x scripts/backup-db.sh

- [ ] Smoke-test it manually:

      ./scripts/backup-db.sh
      ls -lh backups/

- [ ] Schedule it via cron — `crontab -e`:

      0 3 * * * cd /opt/kerf && ./scripts/backup-db.sh >> /var/log/kerf-backup.log 2>&1

  (3 AM UTC daily. Default retention: 14 days, override with
  `RETENTION_DAYS=N` env var.)

- [ ] Off-site copy (recommended, not enforced): rsync `./backups/`
      to S3 / Backblaze B2 / a second VPS once a week. Without it
      a single-VPS failure still loses everything.

---

## Operations

### Viewing logs

    docker compose -f docker-compose.prod.yml logs -f app
    docker compose -f docker-compose.prod.yml logs -f postgres
    docker compose -f docker-compose.prod.yml logs --tail=200 app

Logs go to Docker's default `json-file` driver with 10 MB rotation.
For longer retention, see `/etc/docker/daemon.json` and the
`log-opts` configuration.

### Restarting

    # restart just the app (postgres untouched)
    docker compose -f docker-compose.prod.yml restart app

    # full stop + start (preserves postgres data via the named volume)
    docker compose -f docker-compose.prod.yml down
    docker compose -f docker-compose.prod.yml up -d

### Updating to a new version

    cd /opt/kerf
    git pull
    docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
    docker compose -f docker-compose.prod.yml up -d --build app

The migrate step is a no-op if no new migrations exist; safe to run
every deploy.

### Restoring from a backup

    gunzip -c backups/kerf-20260420T030000Z.sql.gz \
      | docker compose -f docker-compose.prod.yml exec -T postgres \
          psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

The backup uses `pg_dump --clean --if-exists`, so the restore is
idempotent — it drops existing tables before recreating.

### Rolling back a release

    cd /opt/kerf
    git checkout <previous-good-tag>
    docker compose -f docker-compose.prod.yml up -d --build app

If the rollback crosses a migration that's already been applied, you
have to manually craft a down-migration — drizzle-kit doesn't auto-revert.
This is rare in practice but worth knowing.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `502 Bad Gateway` from nginx | App isn't running, or it's bound to the wrong interface. `docker compose ps` to check status; `ss -tlnp \| grep 3000` on the host to confirm something is listening on `127.0.0.1:3000`. |
| `[env] DATABASE_URL is required in production` on startup | `.env` not loaded or var unset. Confirm `chmod 600 .env` is in repo root, not under `/opt/kerf/foo/`. |
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | App tried to reach postgres on `localhost`. Check `DATABASE_URL` hostname is `postgres` (compose service name), not `localhost`. |
| Magic-link emails go to spam | Resend domain not fully verified. Re-check SPF + DKIM in Resend dashboard. |
| Magic-link link points to localhost | `AUTH_URL` not set to `https://<your-domain>` in `.env`. |
| OAuth callback "Mismatch" error | Provider's redirect URI doesn't match `<AUTH_URL>/api/auth/callback/<provider>` exactly. Trailing slashes, `www.` prefix, http vs https — all matter. |
| Rate limiter blocks requests too aggressively | Reverse proxy IP shows up as the client. Confirm the `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` line from Step 4 is present in `/etc/nginx/sites-enabled/kerf`. (Caddy forwards by default if you went that path.) |

---

## What's not in this guide

- **Sentry / observability.** Optional. If you add it, drop the DSN
  into `.env` and follow Sentry's Node setup; nothing in kerf's code
  needs to change.
- **CI/CD.** Out of scope (per Task 4.6). If you want it later, GitHub
  Actions building the image + pushing to GHCR + SSH-deploying via
  webhook is the standard pattern.
- **Multi-host / load balancer.** kerf's session persistence is
  database-backed (no in-memory state), so horizontal scaling is
  possible — but the rate limiter is in-process, so two app
  containers would have independent buckets. Out of scope for V1.
