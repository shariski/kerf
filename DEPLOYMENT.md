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
- Reverse proxy via `nginxproxy/nginx-proxy` (Docker) with TLS
  terminated at a Cloudflare Origin Certificate at the origin.
  acme-companion runs alongside to handle Let's Encrypt certs for
  any other domains you host on the same VPS.
- Magic-link emails delivered through Resend with a verified domain.
- (Optional) Google + GitHub social login.
- GitHub Actions builds the production image, pushes to GHCR, and SSHes
  into the VPS to deploy on every push to `main`.

What this guide assumes:

- You can SSH into a VPS and have `sudo`. Tested against Debian 12 /
  Ubuntu 22.04+, but should work on any modern Linux.
- You own a domain with DNS you can edit.
- You have admin access to the GitHub repo (to add deploy secrets).

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
- [ ] An SSH key pair dedicated to deploys (do **not** reuse your
  personal key — see Step 8.5).

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

## Step 2 — DNS via Cloudflare

We use Cloudflare for DNS so we can also use their bot detection / WAF
/ caching layer in front of the VPS, plus their free Email Routing for
inbound `hello@<domain>` mail (Step 6). The domain itself can stay
registered wherever you bought it; only the nameservers move.

- [ ] At Cloudflare: Add a site → enter `typekerf.com` → Free plan.
      Cloudflare assigns you two nameservers (e.g.
      `xxx.ns.cloudflare.com`, `yyy.ns.cloudflare.com`) — note them.

- [ ] At your registrar (Hostinger panel → Domains → typekerf.com →
      DNS / Nameservers): switch from the default nameservers to the
      two Cloudflare ones. Save.

- [ ] Wait for Cloudflare to detect the change and flip the site to
      "Active" in their dashboard. Usually < 1 hour, max 24h. Don't
      add DNS records below until activation is green — records added
      pre-activation can land in the wrong zone.

- [ ] Once active, in Cloudflare → DNS → Records, add:

      typekerf.com.        A     <VPS-IPv4>     Proxied (orange cloud)
      www.typekerf.com.    A     <VPS-IPv4>     Proxied (orange cloud)

  (Add `AAAA` records if your VPS has IPv6.)

  **Proxied (orange cloud) is required** — without it, Cloudflare is
  just a DNS provider and you lose the WAF / bot-fight / caching that
  motivated this setup.

- [ ] Sanity-check from your laptop:

      dig +short typekerf.com

  When proxied, this returns Cloudflare anycast IPs, **not** your VPS
  IP — that's correct. To verify the origin route, use the host header:

      curl -I --resolve typekerf.com:443:<VPS-IPv4> https://typekerf.com/

  (Will 502 until the app is up; that's fine — we just want TLS to
  negotiate without a cert error.)

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

- The compose file uses `expose: 3000` (Docker-network only — no host
  port binding), so port 3000 is unreachable from outside Docker
  regardless of firewall state. nginx-proxy reaches the app over the
  shared `webproxy` Docker network. Belt + suspenders.

---

## Step 4 — Reverse proxy: nginx-proxy + acme-companion

We use the [`nginxproxy/nginx-proxy`](https://github.com/nginx-proxy/nginx-proxy)
+ [`nginxproxy/acme-companion`](https://github.com/nginx-proxy/acme-companion)
stack — auto-routing reverse proxy for Docker. App containers declare
`VIRTUAL_HOST=foo.com` env vars; nginx-proxy generates the vhost and
routes traffic. acme-companion provisions Let's Encrypt certs for any
container that also sets `LETSENCRYPT_HOST`.

For typekerf.com specifically we **skip Let's Encrypt** and use a
Cloudflare Origin Certificate instead (Step 5). acme-companion stays
running to handle other domains on the VPS.

If you don't already have nginx-proxy running, set it up in its own
directory (sibling to `/opt/kerf`, not inside it).

- [ ] Pick a directory:

      sudo mkdir -p /opt/proxy && sudo chown "$USER:$USER" /opt/proxy
      cd /opt/proxy

- [ ] Create `/opt/proxy/docker-compose.yml`. Note the bind-mounted
      `./certs` — that's so dropping a Cloudflare Origin Cert in
      Step 5 is just `cp` to a known host path:

      services:
        nginx-proxy:
          image: nginxproxy/nginx-proxy:1.6
          restart: unless-stopped
          ports:
            - "80:80"
            - "443:443"
          volumes:
            - ./certs:/etc/nginx/certs
            - vhost:/etc/nginx/vhost.d
            - html:/usr/share/nginx/html
            - /var/run/docker.sock:/tmp/docker.sock:ro
          networks:
            - webproxy

        acme-companion:
          image: nginxproxy/acme-companion:2.4
          restart: unless-stopped
          depends_on:
            - nginx-proxy
          volumes:
            - ./certs:/etc/nginx/certs
            - vhost:/etc/nginx/vhost.d
            - html:/usr/share/nginx/html
            - acme:/etc/acme.sh
            - /var/run/docker.sock:/var/run/docker.sock:ro
          environment:
            DEFAULT_EMAIL: you@example.com
            NGINX_PROXY_CONTAINER: nginx-proxy

      volumes:
        vhost:
        html:
        acme:

      networks:
        webproxy:
          name: webproxy

- [ ] Create the bind-mount target:

      mkdir -p /opt/proxy/certs

- [ ] Bring it up:

      cd /opt/proxy
      docker compose up -d
      docker compose ps         # both containers running

- [ ] Confirm the network name and update `docker-compose.prod.yml` in
      the kerf repo if needed. The kerf compose file ships with
      `name: webproxy` — if you used a different name above, edit
      both `networks.webproxy.name` and the matching service entries:

      docker network ls | grep -i proxy

- [ ] If `X-Forwarded-For` is critical for the better-auth rate limiter
      (see `src/server/auth.ts` `advanced.ipAddress`), nginx-proxy sets
      it correctly by default — no extra config needed. Verify after
      first deploy with a request and check that the limiter buckets
      per IP, not globally.

---

## Step 5 — TLS via Cloudflare Origin Certificate

Cloudflare in proxy mode (orange cloud) terminates browser TLS at its
edge and re-encrypts to the origin. The origin needs a cert; we use a
**Cloudflare Origin Certificate**, which CF issues for free, valid only
for CF↔origin (browsers never see it) and good for 15 years.

This sidesteps Let's Encrypt entirely for typekerf.com — no HTTP-01
challenge to worry about, no 60-day renewal cron. acme-companion keeps
running for other domains; we just don't enroll typekerf.com with it.

- [ ] In Cloudflare → SSL/TLS → Overview, set encryption mode to
      **Full (strict)**. (Anything less either accepts self-signed
      certs at origin or sends plaintext over the public internet.)

- [ ] Cloudflare → SSL/TLS → Origin Server → Create Certificate.
      Defaults are fine: RSA 2048, hostnames `typekerf.com` +
      `*.typekerf.com`, 15-year validity. Click Create.

- [ ] Cloudflare shows you the **Origin Certificate** (`.pem`) and the
      **Private Key** **once**. Copy both into your clipboard before
      closing — they're not retrievable later.

- [ ] On the VPS, drop the cert + key into `/opt/proxy/certs/` (the
      directory you bind-mounted in Step 4). **Filenames must match
      the `VIRTUAL_HOST` exactly** — that's how nginx-proxy auto-binds
      certs to vhosts:

      sudo $EDITOR /opt/proxy/certs/typekerf.com.crt   # paste the .pem cert
      sudo $EDITOR /opt/proxy/certs/typekerf.com.key   # paste the private key
      sudo chmod 600 /opt/proxy/certs/typekerf.com.key

- [ ] Restart nginx-proxy to pick up the cert (it re-scans the certs
      dir on startup; subsequent picks are auto-triggered when proxied
      containers start):

      docker compose -f /opt/proxy/docker-compose.yml restart nginx-proxy

- [ ] Smoke-test from your laptop:

      curl -I https://typekerf.com/
      # → 502 Bad Gateway (kerf not up yet — TLS negotiating cleanly
      #   through Cloudflare is what we're checking here)

---

## Step 5.5 — Proxy customizations: `www` → apex 301

Search Console treats `www.typekerf.com` and `typekerf.com` as
separate hosts. Even though every page declares `<link rel="canonical"
href="https://typekerf.com/...">`, the `www` variant still gets
crawled and logged as "Alternate page with proper canonical tag" — a
distraction in the index report and a small but persistent
canonicalization tax. The clean fix is to never serve the `www` host
content at all: redirect the entire host to apex at the proxy edge.

Two reasonable layers to do this. **Pick one, not both:**

- **Cloudflare Redirect Rule** (recommended if you're on Cloudflare
  proxy mode — orange cloud — from Step 2). The redirect happens at
  Cloudflare's edge; the origin never sees `www` traffic, so latency
  drops and origin load is unaffected by stray `www` crawls.
  Configure under **Cloudflare → Rules → Redirect Rules**: trigger on
  `Hostname eq www.typekerf.com`, action 301 redirect to apex
  preserving path and query string. Cloudflare's UI evolves; if the
  exact field names have moved, the search term is "redirect rule
  301 path preservation". This option is **not under git control** —
  re-document the rule's existence in your ops notes.

- **nginx-proxy `vhost.d` override** (use this if you ever leave
  Cloudflare or want the redirect under git/SSH control). nginx-proxy
  reads per-vhost custom directives from files inside its `vhost.d`
  volume. A file named `<HOSTNAME>_location` is included inside that
  vhost's `location /` block; a `return 301` short-circuits before
  nginx-proxy's default `proxy_pass` runs. The kerf app keeps
  advertising `www.typekerf.com` in `VIRTUAL_HOST` (so nginx-proxy
  generates the server block + binds the wildcard cert) — only the
  per-vhost override changes the response:

      # vhost.d is a docker-named volume mounted in Step 4. Write
      # into it via a one-shot container (volume name follows the
      # compose project — typically `proxy_vhost` when the proxy
      # compose lives at /opt/proxy/docker-compose.yml):

      docker volume ls | grep vhost   # confirm volume name
      docker run --rm -v proxy_vhost:/vhost.d nginx:alpine \
        sh -c 'echo "return 301 https://typekerf.com\$request_uri;" \
        > /vhost.d/www.typekerf.com_location'

      docker compose -f /opt/proxy/docker-compose.yml \
        exec nginx-proxy nginx -s reload

- [ ] Smoke-test the redirect from your laptop (works for either
      layer). Status `301`, `Location` is the apex equivalent:

      curl -sIL https://www.typekerf.com/welcome | grep -iE 'HTTP/|location:'
      # → HTTP/2 301
      # → location: https://typekerf.com/welcome
      # → HTTP/2 200

- [ ] In Search Console, request re-indexing of the apex URL
      (`https://typekerf.com/welcome`) so Google re-crawls and sees
      the now-redirecting `www` host. Existing "Alternate page with
      proper canonical tag" reports for `www.*` URLs will clear over
      Google's normal re-crawl cycle (days to weeks).

---

## Step 6 — Outbound email (Resend)

- [ ] Sign up at <https://resend.com> (free tier: 3,000/month).
- [ ] Paste the API key — you'll add it to `.env` in Step 9.
- [ ] **Verify your sending domain** at <https://resend.com/domains>:
      add the SPF + DKIM TXT records to **Cloudflare → DNS → Records**
      (since Cloudflare is now your DNS provider), then click "Verify"
      in the Resend dashboard. Until verified, real sends are
      restricted to `onboarding@resend.dev`.
- [ ] Once verified, your `EMAIL_FROM` can use the branded address —
      e.g. `kerf <hello@typekerf.com>`. No code change is needed;
      `src/server/email/send.ts` reads this env var with the sandbox
      sender as the default fallback.

## Step 7 — Inbound mail (Cloudflare Email Routing)

The `/contact` page surfaces `hello@<your-domain>`. You need that
address to actually receive mail. Cloudflare Email Routing forwards
inbound mail to a real inbox of yours, and since DNS is already at
Cloudflare it's the path of least resistance.

- [ ] Cloudflare → Email → Email Routing → Get started.
- [ ] Add a destination address (e.g. your personal Gmail). Cloudflare
      sends a verification email; click through.
- [ ] Add a routing rule: `hello@typekerf.com` → that destination.
      Add `support@typekerf.com` too if you want — saves users who
      guess that pattern from dead-ending.
- [ ] Cloudflare auto-adds the required MX records and an SPF TXT
      record. Verify both landed under DNS → Records.
- [ ] Important: the Email Routing SPF record will coexist with the
      Resend SPF record from Step 6. Cloudflare merges them into a
      single TXT value automatically. If you ever see two separate
      `v=spf1 ...` records on the apex, that's wrong — flatten them.

---

## Step 8 — OAuth providers (optional)

Skip this section if you only want magic-link auth at launch — magic-link
works without any of these creds. Add providers later if you want them.

### Google

- [ ] Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client ID.
- [ ] Application type: Web application.
- [ ] Authorized redirect URI: `https://typekerf.com/api/auth/callback/google`
      (and `http://localhost:3000/api/auth/callback/google` for dev).
- [ ] Copy Client ID + Client Secret — they go in `.env` in Step 9.

### GitHub

- [ ] github.com/settings/developers > New OAuth App.
- [ ] Authorization callback URL: `https://typekerf.com/api/auth/callback/github`
- [ ] Copy Client ID + Client Secret.

---

## Step 8.5 — GitHub repo secrets + deploy SSH key

CI builds the image and SSHes into the VPS to deploy. That requires a
dedicated keypair and three repo secrets.

- [ ] On your laptop, generate a key pair just for deploys (no passphrase
      so the workflow can use it non-interactively):

      ssh-keygen -t ed25519 -f ~/.ssh/kerf_deploy -C "kerf-deploy" -N ""

- [ ] Copy the **public** half to the VPS, into the deploy user's
      `~/.ssh/authorized_keys`:

      ssh-copy-id -i ~/.ssh/kerf_deploy.pub "$DEPLOY_USER@$VPS_HOST"

  (The deploy user must already be in the `docker` group from Step 1.)

- [ ] Verify the key works:

      ssh -i ~/.ssh/kerf_deploy "$DEPLOY_USER@$VPS_HOST" "docker version"

- [ ] In GitHub: repo → Settings → Secrets and variables → Actions →
      New repository secret. Add three:

      DEPLOY_HOST     <VPS hostname or IP>
      DEPLOY_USER     <ssh username, e.g. deploy>
      DEPLOY_SSH_KEY  <contents of ~/.ssh/kerf_deploy — the PRIVATE half>

  Paste the private key including the `-----BEGIN OPENSSH PRIVATE
  KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines and the
  trailing newline.

- [ ] After CI's first push to GHCR (Step 10), make the published image
      **public** so the VPS can pull without authenticating:

      GitHub → your profile → Packages → kerf → Package settings →
      Change visibility → Public

  (Skip this if you'd rather keep the image private. You'll then need
  to `docker login ghcr.io` on the VPS with a PAT scoped to
  `read:packages`.)

---

## Step 9 — VPS application directory

The VPS holds only configuration — `.env`, the compose file (kept fresh
by CI), and the backups directory. No source tree, no `git clone`.

- [ ] Pick a directory on the VPS:

      sudo mkdir -p /opt/kerf
      sudo chown "$USER:$USER" /opt/kerf
      cd /opt/kerf

- [ ] Generate fresh secrets:

      openssl rand -base64 32   # → AUTH_SECRET
      openssl rand -base64 32   # → POSTGRES_PASSWORD

- [ ] From your laptop, copy the env template up:

      scp .env.production.example "$DEPLOY_USER@$VPS_HOST:/opt/kerf/.env"

  Then on the VPS, edit:

      $EDITOR /opt/kerf/.env

  Fill in:
  - `POSTGRES_PASSWORD` (the one you just generated)
  - `DATABASE_URL` (matches POSTGRES_USER/PASSWORD/DB; hostname stays `postgres`)
  - `AUTH_SECRET` (the other one you generated)
  - `AUTH_URL=https://typekerf.com`
  - `RESEND_API_KEY`
  - `EMAIL_FROM=kerf <hello@typekerf.com>` (after Resend domain verified)
  - `GOOGLE_*` / `GITHUB_*` if Step 8 was done

- [ ] Lock the file down:

      chmod 600 /opt/kerf/.env

- [ ] Create the backups directory (the compose file bind-mounts it):

      mkdir -p /opt/kerf/backups

- [ ] One-time-only: scp the compose file from your laptop checkout so
      the very first deploy has something to run against. CI will
      keep it fresh after that:

      scp docker-compose.prod.yml "$DEPLOY_USER@$VPS_HOST:/opt/kerf/"

---

## Step 10 — First deploy

Trigger the workflow once to build and push the initial image and run
the deploy end-to-end.

- [ ] Push to `main` (or use Actions → "build and deploy" → Run workflow)
      and watch the run in the GitHub Actions UI.

- [ ] If the image push succeeded but the package is still private,
      make it public per Step 8.5 and re-run the deploy job.

- [ ] When the workflow completes, ssh to the VPS and confirm both
      services are up:

      ssh "$DEPLOY_USER@$VPS_HOST"
      cd /opt/kerf
      docker compose -f docker-compose.prod.yml ps
      # app: running (healthy), postgres: running (healthy)

- [ ] Watch logs until you see the listen line:

      docker compose -f docker-compose.prod.yml logs -f app
      # → "Listening on: http://localhost:3000/ (all interfaces)"

The CI workflow does the equivalent of:

    docker compose -f docker-compose.prod.yml pull app postgres
    docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate
    docker compose -f docker-compose.prod.yml up -d app
    docker image prune -f

If you ever need to deploy by hand (CI down, debugging), `cd /opt/kerf`
and run those commands. `IMAGE_TAG=latest` is the implicit default; set
`IMAGE_TAG=<short-sha>` to pin a specific build.

---

## Step 11 — Smoke test

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

## Step 12 — Backups

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

Push to `main`. CI builds the image, pushes to GHCR tagged with the
commit SHA + `latest`, scps the (possibly updated) compose file to the
VPS, runs pending migrations, and recreates the `app` container against
the new image.

To redeploy a known-good SHA without code changes (e.g. environment
hiccup recovery): GitHub → Actions → "build and deploy" → Run workflow.

The migrate step is a no-op if no new migrations exist; safe to run
every deploy.

### Restoring from a backup

    gunzip -c backups/kerf-20260420T030000Z.sql.gz \
      | docker compose -f docker-compose.prod.yml exec -T postgres \
          psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

The backup uses `pg_dump --clean --if-exists`, so the restore is
idempotent — it drops existing tables before recreating.

### Rolling back a release

Every CI build pushes `ghcr.io/<owner>/kerf:<short-sha>` alongside
`:latest`, so any prior build is one ssh + env-var away:

    ssh "$DEPLOY_USER@$VPS_HOST"
    cd /opt/kerf
    IMAGE_TAG=<previous-short-sha> docker compose -f docker-compose.prod.yml pull app
    IMAGE_TAG=<previous-short-sha> docker compose -f docker-compose.prod.yml up -d app

Find the SHA in the Actions history (the build job logs it as
`short_sha`) or via `gh run list --workflow=build-deploy.yml`.

If the rollback crosses a migration that's already been applied, you
have to manually craft a down-migration — Drizzle's runtime migrator
doesn't auto-revert. This is rare in practice but worth knowing.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `502 Bad Gateway` from nginx-proxy | App isn't running, or app + nginx-proxy aren't on the same Docker network. `docker compose -f docker-compose.prod.yml ps` to check app status; `docker network inspect <webproxy-name>` and confirm both containers are listed. If `VIRTUAL_HOST` was changed, nginx-proxy needs a restart to regenerate its config. |
| `[env] DATABASE_URL is required in production` on startup | `.env` not loaded or var unset. Confirm `chmod 600 .env` is in repo root, not under `/opt/kerf/foo/`. |
| `Error: connect ECONNREFUSED 127.0.0.1:5432` | App tried to reach postgres on `localhost`. Check `DATABASE_URL` hostname is `postgres` (compose service name), not `localhost`. |
| Magic-link emails go to spam | Resend domain not fully verified. Re-check SPF + DKIM in Resend dashboard. |
| Magic-link link points to localhost | `AUTH_URL` not set to `https://<your-domain>` in `.env`. |
| OAuth callback "Mismatch" error | Provider's redirect URI doesn't match `<AUTH_URL>/api/auth/callback/<provider>` exactly. Trailing slashes, `www.` prefix, http vs https — all matter. |
| Rate limiter blocks requests too aggressively | Cloudflare or nginx-proxy IP shows up as the client. nginx-proxy sets `X-Forwarded-For` correctly by default; the issue is usually that Cloudflare's IP is being read as the client because the app isn't trusting the chain. Confirm `src/server/auth.ts` has `advanced.ipAddress.ipAddressHeaders=["x-forwarded-for"]`, and that nginx-proxy is appending CF's `cf-connecting-ip` to the chain (or trust CF's IP ranges directly). |

---

## What's not in this guide

- **Sentry / observability.** Optional. If you add it, drop the DSN
  into `.env` and follow Sentry's Node setup; nothing in kerf's code
  needs to change.
- **Multi-host / load balancer.** kerf's session persistence is
  database-backed (no in-memory state), so horizontal scaling is
  possible — but the rate limiter is in-process, so two app
  containers would have independent buckets. Out of scope for V1.
