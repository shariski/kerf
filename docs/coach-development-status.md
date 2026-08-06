# Coach (AI Adaptive Practice) — Development Status & Roadmap

> Last updated: 2026-08-06
> Branch: `feat/coach-ai-adaptive` (23 commits ahead of main, pushed to origin)

## 1. TL;DR

The Coach feature is **feature-complete and working in local dev**: a daily
AI-generated typing passage targeting the user's *mechanism-level* weaknesses
(why-report), delivered through kerf's existing three-stage deliberate-practice
loop (briefing → attention → evaluation), with a paid-feature-shaped UI (free
quota 1/day, Subscribe button disabled "coming soon"). Billing (LemonSqueezy),
the isolated VPS test environment, and production rollout are NOT done.

## 2. Current state — what's built

### Architecture

```
session data (keystroke_events)
  → why-engine (deterministic): classifies true confusions into 6 finger
    mechanisms (same-finger / adjacent-finger / row-cross / cross-hand /
    space-timing / non-alpha) using the sofle/lily58 finger tables
  → weakness-set key = md5(sorted top-3 mechanisms + difficulty)
  → passage catalog lookup (least-used variant; grow-to-2 rotation)
  → miss: DeepSeek two-step generation
      A) root-cause analysis (reasoning ON)
      B) passage generation (thinking OFF) — 1 passage, priority mechanism,
         exact gate thresholds injected, retry-with-feedback up to 3×
  → deterministic gate: mechanism saturation vs baseline (1.2×/1.1×/0.9×/1.5×),
    120-350 words, 1-3 paragraphs, no meta-commentary words
  → normalize (newlines → spaces; typing engine can't type \n)
  → store in catalog + atomic daily quota claim (1/day, TOCTOU-safe)
  → serve to /practice/coach
```

### Key files

| Area | Files |
|---|---|
| Domain | `src/domain/coach/{mechanisms,whyReport,triggerDensity,gate,mechanismPerformance,normalize}.ts` (+ tests) |
| Server | `src/server/coach.ts` (orchestrator + preview), `src/server/coach/{llm,catalog,quota}.ts`, `src/server/coach/prompts/{analysis,generation}.md` (V6 prompts, IP) |
| DB | `passages`, `coach_quota` tables + `sessions.passage_id` (migration `0006_clever_lionheart.sql`) |
| UI | `src/components/coach/{CoachPanel,CoachPreSessionStage,CoachPostSessionStage}.tsx`, `src/routes/practice_.coach.tsx`, entry in `PreSessionStage.tsx` + `src/routes/practice.tsx` (preview fetch) |

### Product shape (confirmed with owner)

- **Coach is visibly distinct**: highlighted panel on the practice page —
  "A passage generated for you personally…", today's teaser (mechanism + top
  confusion), quota state line, disabled **Subscribe (coming soon)** button.
- **Never interrupts typing**: identical typing engine; mechanism ribbon
  replaces the target ribbon; no interstitials mid-session.
- **Quota**: 1 free session/day, consumed at fetch, atomic claim; exhausted →
  panel disables Start, adaptive practice never blocked, no error screens.
- **No "AI" branding** anywhere (copy rule); no pass/fail verdicts (ADR-003).
- **Refresh-safe**: sessionStorage cache restores the day's passage on reload.
- Design-system aligned (tokens, shared `.kerf-btn-primary`, 4px grid).

### Verification status

- 952 tests green (51 coach), build clean, lint clean.
- Typecheck: 4 pre-existing errors only (`src/routes/api/auth/$.ts`,
  `src/routes/api/health.ts`) — unrelated to Coach.
- Live-tested in local dev end-to-end: generation (Silk Road, Apollo 11,
  Great Barrier Reef), catalog rotation, gate, quota, refresh-restore.
- DeepSeek API params verified live (`thinking:{disabled}` + `json_object`).

## 3. How the flow works (user's view)

1. `/practice` shows the **Coach panel** with today's teaser + quota.
2. Start → `/practice/coach` → **briefing**: why (mechanism, % of slips, top
   confusion), attention directive ("what to notice"), passage title.
3. Typing: passage as target, mechanism ribbon (e.g. "Coach · cross-hand").
4. Completion → **evaluation**: mechanism performance on this session
   ("3 of 12 cross-hand transitions had errors") + intent echo + used-state.
5. "Practice again" = same passage (free repetition); next day = rotated
   passage (least-used variant) or fresh generation when the weakness-set
   changes.

## 4. Local dev environment (as of today)

- **App**: `pnpm dev` → http://localhost:3001 (port 3000 is taken by another
  project's next-server). `AUTH_URL=http://localhost:3001` in `.env`.
- **DB**: docker `kerf-postgres-1` (colima), port 5432, db `kerf_dev`.
- **Resolved incident**: sawermaz's homebrew postgresql@14 had hijacked
  localhost:5432 (shadowing kerf's docker postgres for new connections).
  Stopped the homebrew service (`brew services stop postgresql@14`); colima
  now forwards 5432 to kerf's container. **Do NOT start homebrew postgres
  again while kerf dev runs** — or move kerf to 5433.
- **Magic link login**: `EMAIL_DEV_MODE=log` prints the link to the dev
  server console (`/tmp/kerf-dev.log`).
- **Quota reset for testing**: `DELETE FROM coach_quota;` in the dev DB.
- **Known dev quirk**: LLM-path fetches (~60-90s: analysis call is slow with
  reasoning ON) occasionally lose the response in vite dev — server finishes,
  reload serves the cached catalog passage. Catalog hits are instant.

## 5. Known limitations / follow-ups (pre-production)

1. **LLM latency**: analysis call (reasoning ON) ~60s. Production needs a
   prefetch pipeline (generate next passage while typing) or a loading UX
   decision (loading copy already says "takes about a minute").
2. **Events load uncapped**: last 50 sessions × all events fetched per
   request; fine at this scale, bound it before real traffic.
3. **Verbatim sessions not sent to the LLM** (post-MVP); digest only.
4. **Passage analytics**: usage_count + `sessions.passage_id` exist; no
   analytics jobs yet (avg_user_accuracy, passage ranking).
5. **Topic axis**: catalog supports multiple topics per weakness-set; only
   "first suggested topic" is used — personalization is future work.
6. **Prompt IP**: the V6 prompts ship in the public repo (`?raw` imports).
   Before launch: decide public-vs-closed generation service.
7. **Typecheck debt**: 4 pre-existing errors (auth/$.ts, health.ts).

## 6. Next step 1 — Isolated VPS test environment (owner's current goal)

Build a private test instance on the VPS (jumbo) so the owner can test Coach
without local setup. Suggested spec for that session:

- **Location**: `/opt/kerf-staging/` (separate compose project; do NOT touch
  the existing `/opt/kerf` production stack).
- **Compose**: clone `docker-compose.prod.yml`, rename project + container
  prefix (e.g. `kerf-staging`), bind the app to a host port (e.g.
  `127.0.0.1:3001:3000` or a staging VIRTUAL_HOST like `kerf-staging.…` if
  nginx-proxy routing is wanted), separate postgres volume + db name.
- **Image**: build locally (`docker build -t kerf-staging .`) or pull the
  branch image from GHCR if CI pushes branches; the Coach code is NOT on
  main yet, so the image must come from `feat/coach-ai-adaptive`.
- **Env**: copy `.env.production.example` + add `DEEPSEEK_API_KEY`,
  `DEEPSEEK_MODEL=deepseek-v4-flash`, `DEEPSEEK_BASE_URL`; `AUTH_URL` pointing
  at the staging URL; `EMAIL_DEV_MODE=send` or a real magic-link flow.
- **Migration**: run the baked-in migration (`node scripts/migrate.mjs` in
  the app image or `pnpm db:migrate`) — applies `0006` (passages,
  coach_quota, sessions.passage_id).
- **Data**: fresh DB is fine (Coach needs ~20 true confusions minimum for a
  diagnosis — type a few sessions first). Optionally copy the local dev DB.
- **Test checklist**: login → practice page shows Coach panel → start →
  briefing → type passage → evaluation → quota exhausted state → Subscribe
  disabled → refresh keeps the passage → next day/rotation.
- **Cost note**: each new generation ≈ $0.01-0.02; catalog hits are free.

## 7. Next step 2 — Feature hardening (quick wins, before billing)

1. Prefetch pipeline (generate next passage during typing).
2. Bound events query; consider caching why-report per day.
3. Wire `avg_user_accuracy` analytics job on passages.
4. Optional: mechanism-trigger keys in the ribbon; topic variety.

## 8. Next step 3 — Billing: LemonSqueezy (Plan B)

Design sketch (unchanged from the PoC decision):

- **Provider**: LemonSqueezy (handles global tax/VAT, no PCI).
- **Plan**: subscription ~$5/mo "Coach Unlimited" (+ optional credit pack).
  Free tier stays: 1 Coach session/day.
- **Server**:
  - `coach_quota` gains a paid gate: `checkCoachAccess(userId)` →
    subscription active? unlimited : `DAILY_COACH_LIMIT`.
  - Subscription state table (`user_subscriptions`: user_id, provider,
    status, current_period_end) + LemonSqueezy webhook endpoint
    (`/api/webhooks/lemonsqueezy`) handling `subscription_created`,
    `subscription_updated`, `subscription_cancelled`, `subscription_expired`
    (verify signature; idempotent).
  - Checkout URL creation: `checkout.lemonsqueezy.com` redirect with a
    `checkout-data` (user id) so the webhook can attribute.
- **Client**:
  - Replace the disabled Subscribe button with an active one when billing
    exists → redirects to checkout.
  - Quota-exhausted copy becomes "Subscribe for unlimited Coach sessions".
  - `getCoachPreview` returns subscription state for the panel.
- **Env**: `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`,
  `LEMONSQUEEZY_WEBHOOK_SECRET`.
- **Security**: verify webhook signatures; never trust client-side claims;
  server-side enforcement in `getCoachSession` (paid users skip the quota
  claim).

## 9. Next step 4 — Production rollout

1. Merge `feat/coach-ai-adaptive` → main (after final review + staging test).
2. Prod migration (0006) via the deploy flow; add DEEPSEEK_* env to the
   prod `.env` on jumbo.
3. Prompt-IP decision (public prompts vs closed generation service).
4. User-facing privacy note: aggregated stats + confusion pairs are sent to
   DeepSeek, not raw keystrokes (already true by design — document it).
5. Analytics/observability for generation failures (503s seen on DeepSeek —
   fallback provider consideration).

## 10. Quick reference

```bash
# tests / checks
pnpm vitest run src/domain/coach src/server/coach src/components/coach
pnpm typecheck   # 4 pre-existing errors expected
pnpm build
# local dev
pnpm dev         # http://localhost:3001
# quota reset (local dev DB)
docker exec kerf-postgres-1 psql -U kerf -d kerf_dev -c "DELETE FROM coach_quota;"
```
