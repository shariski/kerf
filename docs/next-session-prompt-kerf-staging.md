# Next Session Prompt — Isolated kerf-staging test environment

> Copy/paste this into the next agent session. It assumes zero prior context.

```markdown
# Session goal: isolated kerf-staging test environment on the VPS (jumbo)

## Mission
Build a private, isolated staging environment for the kerf "Coach" feature on
the VPS, deployed the SAME way production is (GitHub Actions → GHCR → VPS
pull), reachable only by me via Tailscale (mirroring the fpl-autopilot
project), with NO repo clone inside the VPS. Do NOT touch the existing
production kerf stack. Do NOT merge anything to main. Do NOT run automated
end-to-end UI tests — I will test the feature manually myself.

## Context to read first
1. `/Users/shariski/Work/kerf/docs/coach-development-status.md` — full status
   + roadmap. Section 6 is the original spec; this prompt supersedes it where
   they conflict (deployment flow, networking, no auto-testing).
2. `/Users/shariski/Work/kerf/DEPLOYMENT.md` — how prod is deployed.
3. `/Users/shariski/Work/kerf/.github/workflows/build-deploy.yml` — the EXACT
   prod CI/CD flow to mirror: build image → push to GHCR (short_sha + latest)
   → scp compose to VPS → SSH deploy (isolated DOCKER_CONFIG login, explicit
   pull, one-shot migration, `compose up -d`). Repo secrets: DEPLOY_HOST,
   DEPLOY_USER, DEPLOY_SSH_KEY.
4. `/opt/fpl-autopilot/docker-compose.yml` on jumbo — the Tailscale pattern:
   app bound to `127.0.0.1:<port>` and the host's `tailscale serve` forwards
   HTTPS from the tailnet to it. Nothing is publicly routable.

## Facts
- Repo: `/Users/shariski/Work/kerf`, branch `feat/coach-ai-adaptive` (Coach
  feature lives ONLY on this branch; main does not have it).
- VPS: `ssh jumbo`. Prod stack: `/opt/kerf` (kerf-app-1 / kerf-postgres-1,
  host nginx-proxy, typekerf.com). **Never stop/restart/modify anything in
  /opt/kerf**; never reuse its volumes, networks, or .env.
- Tailscale is already running on the VPS (host `server1`,
  100.96.87.32) and my devices are on the same tailnet. `tailscale serve`
  runs on the host (outside Docker) for fpl-autopilot — mirror that.
- DeepSeek API key: `/Users/shariski/Work/kerf-adaptive-poc/.env`
  (DEEPSEEK_API_KEY) — goes into the staging .env ON THE VPS, never committed.
- CI only builds `main` today; the staging workflow you add is what builds
  the feature branch.

## Build steps

### 1. CI/CD — staging workflow (same shape as prod)
- Add `.github/workflows/deploy-staging.yml` mirroring `build-deploy.yml`:
  - Trigger: `push` to `feat/coach-ai-adaptive` AND `workflow_dispatch`
    (with a `ref` input so I can deploy any branch).
  - Build job: build the same image, push tags
    `ghcr.io/shariski/kerf:staging` + `ghcr.io/shariski/kerf:staging-<short_sha>`.
  - Deploy job: scp `docker-compose.staging.yml` → `/opt/kerf-staging/` on
    the VPS, then SSH deploy mirroring prod EXACTLY: isolated
    `DOCKER_CONFIG=/opt/kerf-staging/.docker`, login, explicit
    `docker compose -f docker-compose.staging.yml pull app postgres`,
    one-shot migration (`run --rm app node scripts/migrate.mjs`), then
    `compose up -d`. Use the same repo secrets (same host/user/ssh key).
  - Concurrency group separate from prod (`deploy-staging`).
  - Do NOT touch the prod workflow.

### 2. VPS — staging compose + env (copy PROD FORMAT, do not clone the repo)
- Create `/opt/kerf-staging/` with `docker-compose.staging.yml` derived from
  the prod compose (which CI ships), adapted:
  - Compose project name / container prefix: `kerf-staging`.
  - App: NO VIRTUAL_HOST. Bind `127.0.0.1:<port>` (pick a free port, e.g.
    8081) — fpl-autopilot uses 8000, so avoid that.
  - Postgres: own volume + db (e.g. `kerf_staging`), healthy-wait as prod.
- `/opt/kerf-staging/.env` (from `.env.production.example` format):
  DATABASE_URL → staging postgres service; fresh AUTH_SECRET
  (`openssl rand -base64 32`); AUTH_URL → the Tailscale URL (see step 3);
  EMAIL_DEV_MODE=log (magic links print to container logs); DEEPSEEK_API_KEY /
  DEEPSEEK_MODEL=deepseek-v4-flash / DEEPSEEK_BASE_URL. Never committed.

### 3. Networking — Tailscale (mirror fpl-autopilot)
- Check `tailscale serve status` on jumbo to see how fpl-autopilot forwards;
  mirror it for kerf-staging: host-level `tailscale serve` forwarding HTTPS
  from the tailnet to `127.0.0.1:<port>` (e.g. via a dedicated port or path
  on the same tailnet name). If a separate tailnet name is needed, check how
  fpl-autopilot exposes it (`tailscale serve` / MagicDNS name) and follow the
  same mechanism.
- IMPORTANT: this makes staging reachable ONLY on my tailnet (like
  fpl-autopilot: "Nothing is publicly routable"). AUTH_URL must match the
  tailnet URL so magic links work.

### 4. Boot verification (NO UI testing — I do that manually)
- App container healthy (image `/api/health`).
- Migration applied: staging postgres has `passages`, `coach_quota`,
  `sessions.passage_id` (migration 0006).
- App responds on the tailnet URL (page load is enough; login redirect is
  expected without a session).
- Container logs print magic-link URLs (EMAIL_DEV_MODE=log works).

## Out of scope for you
- Signing up / signing in / typing / Coach flow testing — I do all of that
  manually after you finish.
- Seeding the staging DB with my data (I can type fresh sessions there).
- Anything touching /opt/kerf (prod).

## Constraints
- Feature branch + staging workflow only. No pushes to main, no PRs.
- No secrets in any committed file; staging .env stays on the VPS (chmod 600).
- Keep the staging image pull working the way prod does (isolated
  DOCKER_CONFIG — do not write to the shared docker config).
- Leave a README in `/opt/kerf-staging/`: how to start/stop, the tailnet URL,
  how to reset the daily quota (`docker exec <staging-postgres> psql -U kerf
  -d kerf_staging -c "DELETE FROM coach_quota;"`), and how to redeploy
  (workflow_dispatch).

## Report back
- Tailnet URL, container names, port, env keys set (names only).
- Proof of boot verification (health, migration tables, page response).
- The workflow file added + how to trigger a manual deploy.
- Anything that diverged from this prompt or the status doc §6.
- Remaining follow-ups (billing §8, hardening §7, rollout §9).
```
