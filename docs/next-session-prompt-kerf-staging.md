# Next Session Prompt — Isolated kerf-staging test environment

> Copy/paste this into the next agent session. It assumes zero prior context.

```markdown
# Session goal: isolated kerf-staging test environment on the VPS (jumbo)

## Mission
Build a private, isolated staging environment for the kerf "Coach" feature on
the VPS so I can test it myself without local setup. Do NOT touch the existing
production kerf stack. Do NOT merge anything to main.

## Context to read first
1. `/Users/shariski/Work/kerf/docs/coach-development-status.md` — the full
   status + roadmap. Section 6 ("Next step 1 — Isolated VPS test environment")
   is the spec for this session. Read it fully before starting.
2. `/Users/shariski/Work/kerf/DEPLOYMENT.md` — how the prod stack is deployed
   (nginx-proxy, image build/pull, migration flow).

## Facts
- Repo: `/Users/shariski/Work/kerf` (local), branch `feat/coach-ai-adaptive`
  (23+ commits ahead of main — the Coach feature lives ONLY on this branch).
- VPS: `ssh jumbo`. Production stack lives at `/opt/kerf` (containers
  kerf-app-1 / kerf-postgres-1 behind host nginx-proxy + acme-companion,
  domain typekerf.com). **Never stop, restart, or modify anything in /opt/kerf.**
- DeepSeek API key: in `/Users/shariski/Work/kerf-adaptive-poc/.env`
  (DEEPSEEK_API_KEY). Use it for the staging env.
- Local dev postgres on the Mac (kerf_dev) holds test data — optional to
  migrate, but a fresh staging DB works if I first type a few sessions there.

## Build steps
1. Clone the repo on jumbo into `/opt/kerf-staging` (git clone + checkout
   `feat/coach-ai-adaptive`), or copy the existing /opt/kerf compose and
   adapt. Use a SEPARATE compose project name (e.g. `kerf-staging`) and
   separate postgres volume/db so nothing collides with prod.
2. Build the app image FROM THE BRANCH (docker build with the branch checked
   out — CI only builds main, so a branch image must be built manually).
3. Compose services:
   - app: no VIRTUAL_HOST (or a dedicated one only if DNS/nginx routing is
     already wired for it — otherwise prefer a direct host port like
     `127.0.0.1:8081:3000` or a published port I can reach; if published
     publicly, note that login is required for any access).
   - postgres: own volume + db name (e.g. `kerf_staging`).
   - migrate: run the baked-in migration (`node scripts/migrate.mjs` in the
     image) — must apply migration 0006 (passages, coach_quota,
     sessions.passage_id). Verify tables exist.
4. Staging `.env` (copy `.env.production.example`): DATABASE_URL pointing at
   the staging postgres service, fresh AUTH_SECRET (`openssl rand -base64 32`),
   AUTH_URL = the staging URL you chose, EMAIL_DEV_MODE=log (magic links print
   to container logs — easiest for testing), DEEPSEEK_API_KEY /
   DEEPSEEK_MODEL=deepseek-v4-flash / DEEPSEEK_BASE_URL.
5. Health-check the app (the image has /api/health).

## Acceptance (test end-to-end, not just boot)
1. Register/login via magic link (grab the link from the app container logs).
2. Create a keyboard profile (onboarding) if the staging DB is fresh.
3. Type at least 1-2 adaptive sessions (Coach needs ~20 true confusions
   before it can diagnose — INSUFFICIENT_DATA guard otherwise).
4. `/practice` shows the highlighted Coach panel with today's teaser + quota.
5. Start a Coach session: briefing (mechanism + evidence + passage title) →
   type the passage → evaluation (mechanism performance) → quota shows used.
6. Quota exhausted: panel disables Start, shows "Free: today's session used",
   Subscribe button disabled ("coming soon"), adaptive practice unaffected.
7. Refresh mid-flow restores the day's passage (sessionStorage cache).
8. Report generation latency for the first (LLM) fetch vs later (catalog) hits.

## Constraints
- Feature branch only. No pushes to main, no PRs, no prod changes.
- Do not expose secrets in any committed file; the staging .env stays on the
  VPS (or locally, gitignored).
- If the staging port is publicly reachable, mention it and confirm the app
  requires login (it does via better-auth).
- Leave a short README in /opt/kerf-staging documenting: how to start/stop,
  the URLs, how to reset the daily quota
  (`docker exec <staging-postgres> psql -U kerf -d kerf_staging -c "DELETE FROM coach_quota;"`),
  and how to reach me if anything is ambiguous.

## Report back
- URLs (app + how to reach it), container names, env keys set (names only),
- what was verified from the acceptance list (with evidence),
- anything that diverged from the spec in §6 of the status doc,
- remaining follow-ups for the next session (billing §8, hardening §7, rollout §9).
```
