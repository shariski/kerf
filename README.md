# kerf

Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first.

kerf is a typing platform specifically designed for people migrating from row-staggered QWERTY to split columnar keyboards (Sofle and Lily58 in MVP). It treats split keyboard adoption as a distinct learning journey with its own pain points, not as a generic "learn to type faster" program.

## Stack

See `docs/01-product-spec.md §9` for the full rationale. Quick list:

- **Framework**: Tanstack Start (Vite + Tanstack Router + Nitro)
- **Language**: TypeScript (strict)
- **UI**: React + Tailwind CSS v4
- **State**: Zustand (Phase 1+)
- **ORM**: Drizzle + PostgreSQL 16 (Task 0.2+)
- **Auth**: better-auth (Task 0.3+)
- **Email**: Resend (prod) / console log (local)

## Prerequisites

- **Node.js** 22 LTS (`node --version` should show `v22.x.x`)
- **Docker** (for Task 0.2 local database setup)
- **Playwright Chromium** (one-time, for `npm run test:a11y`) — `npx playwright install chromium`

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000

Other scripts:

```bash
npm run build       # production build
npm run start       # production preview
npm run typecheck   # tsc --noEmit
npm run lint        # linter
```

## Documentation

| File | Description |
|------|-------------|
| `docs/01-product-spec.md` | Product positioning, core values, feature list, tech stack |
| `docs/02-architecture.md` | Data model, adaptive engine algorithm, module layout |
| `docs/03-task-breakdown.md` | Phase-by-phase task list for Claude Code sessions |
| `docs/04-design-system.md` | Color tokens, typography, spacing, component specs |
| `docs/05-information-architecture.md` | 7-route IA, navigation patterns |
| `docs/06-design-summary.md` | Single source of truth for locked design decisions |

## Status

- [x] Phase 0 / Task 0.1: Tanstack Start scaffold + design tokens + hello world page
- [x] Phase 0 / Task 0.2: Local database setup (Drizzle + PostgreSQL)
- [x] Phase 0 / Task 0.3: Auth infrastructure (better-auth)
- [x] Phase 1: Adaptive engine domain logic
- [x] Phase 2 / Task 2.1: Onboarding flow
- [x] Phase 2 / Task 2.2: Visual Keyboard SVG (SofleSVG / Lily58SVG with target highlight, finger bars, imperative flash API)
- [x] Phase 2 / Task 2.3: Typing area component (TypingArea + useKeystrokeCapture + sessionStore with amber expected-letter badge on errors)
- [x] Phase 2 / Task 2.4: Practice page integration with pause state (pre-session → active → pause overlay → post-session placeholder)
- [x] Phase 2 / Task 2.5: Post-session inline summary with error review (summarizeSession + pickSummaryTitle + 1:1 wireframe port)
- [x] Phase 2 / Task 2.6: Drill mode submode (`/practice/drill` route, manual target + 3 presets, before/after card in post-drill)
- [x] Phase 2 / Task 2.7: Hand isolation filter (UI + filter plumbing + corpus metadata already in place from Tasks 1.3 / 2.4; locked in by a real-corpus integration test)
- [x] Phase 2 / Task 2.8: Session persistence (`persistSession` server function with all-or-nothing transaction, client-generated UUID for idempotency, UPSERT on per-user stats)
- [x] Phase 3 / Task 3.1: Post-session summary screen (implemented inline as part of Task 2.5 per `docs/03-task-breakdown.md §3.1`)
- [x] Phase 3 / Task 3.2: Dashboard page — `/dashboard` with 6 sections
  - [x] 3.2a: Hero stats (accuracy-featured) + split-keyboard metrics
  - [x] 3.2b: Activity log (30-day contribution grid + last 5 sessions list)
  - [x] 3.2c: Heatmap overlay on visual keyboard SVG (per-key error-rate, amber → red ramp, legend + plain-language caption)
  - [x] 3.2d: Weakness ranking (top-10 mixed chars + bigrams, score from the same engine formula the adaptive exercise generator uses, self-normalized bar widths)
  - [x] 3.2e: Skill trajectory charts (Recharts area charts for accuracy + WPM over the last 30 sessions, with baseline comparison and trend delta)
  - [x] 3.2f: Engine insight narrative + rationale + phase badge + footer CTA
- [x] Phase 3 / Task 3.3: Power-user transparency panel — always-expanded "How is this calculated?" section on `/dashboard` with live phase-aware formula + per-component breakdown (value vs. baseline vs. normalized vs. contribution) for the top weakness, inner-column bonus explanation when applicable
- [x] Phase 3 / Task 3.4: Weekly insight + phase-transition suggestion banner
  - [x] 3.4a: Phase-transition suggestion banner (top-of-dashboard, dismissible per session, wires the existing `phaseSuggestion.ts` advisory + new `updateTransitionPhase` write path)
  - [x] 3.4b: Weekly insight aggregation + narrative card (`generateWeeklyInsight` pure domain with 6-frame classification including honest `stagnant` per Core Value 2.2, rolling 7d-vs-7d comparison, phase-aware template recommendations; new "This week vs last" dashboard section)
  - [x] 3.4c: Temporal patterns chart — mean WPM by hour-of-day (24 bars) and day-of-week (7 bars), last 30 days, client-side bucketing in local tz via `computeTemporalPatterns`, peak-bucket plain-language caption ("fastest around 14:00 — Sat is your strongest day")
- [x] Phase 3 / Task 3.5: Multi-keyboard switcher — `/keyboards` page with card grid + active badge, inline add-profile form (only un-added keyboard types offered), transactional `switchActiveProfile` server fn that atomically deactivates siblings, `createKeyboardProfile` updated to deactivate existing profiles when a user adds their second keyboard
- [x] Phase 4 / Task 4.1: First-session experience — curated diagnostic exercise for zero-data profiles, `hasAnySessionOnActiveProfile` gate on `/practice`, mode `'diagnostic'` plumbed through `persistSession`, dismissible onboarding tooltip above `TypingArea` (auto-fades after ~1 word), accuracy-first pre-session copy, plus the Home/lobby page at `/` (both zero-data and returning-user states per `home-wireframe.html`) since no other numbered task covered it
- [x] Phase 4 / Task 4.2: Error handling & edge cases — network failure during save retries via localStorage-backed queue (`persistSessionWithRetry` + `sessionRetryQueue`, capped at 10 entries, FIFO with `sessionId` dedup, drained on mount + after any successful save), `beforeunload` warning hook while a session is in flight, cross-tab detection via `BroadcastChannel` (`useOtherTabActive`) with a quiet banner on the pre-session stage in both `/practice` and `/practice/drill`. No partial-session restore — Phase A scope stays "warn, then accept whatever you typed" per §B6.
- [x] Phase 4 / Task 4.3: Responsive design — full-screen `<MobileGate />` at viewports below 768px via CSS media query; desktop/tablet UI (≥768px) unchanged. Pure CSS swap in `__root.tsx`, no JS viewport detection, no SSR hydration swap. Gate applies uniformly to every route.
- [x] Phase 4 / Task 4.4: Accessibility basics — WCAG 2.1 AA via `@axe-core/playwright` sweep (`npm run test:a11y`) across 8 routes/states, all green. Global `:focus-visible` amber ring, skip-to-main-content link, `<main id="main-content">` landmark on every route, explicit `aria-live="off"` on LiveWpm, contract + keyboard ref + contrast table documented in `docs/a11y.md`.
- [x] Phase 4 / Task 4.5: Documentation page — five footer-linked static pages (`/how-it-works`, `/why-split-is-hard`, `/faq`, `/privacy`, `/terms`) via a shared `<DocPage>` layout; new global `<AppFooter>` in `__root.tsx` (hidden on chromeless routes); legal pages ship as templates with `{{PLACEHOLDER}}` markers, amber banner, and `docs/legal-templates.md` deploy checklist.
- [x] Phase 5 / Task 5.1: Journey capture — `finger_assignment` text column on `keyboard_profiles`, `JourneyCode` domain type, onboarding step 4 (How do you type?), `updateFingerAssignment` server-fn, and a `/settings` route with a journey toggle. The pre-ADR-003 one-time capture card was scoped out as speculative for a pre-launch cohort (§B6 / §B10).
- [x] Phase 5 / Task 5.2: Columnar-motion drill library — `motionPatterns.ts` (verticalColumn / innerColumn / thumbCluster candidate scorers), `drillLibrary.ts` (schema + `lookupDrill`), and `drillLibraryData.ts` (33 pre-authored entries covering every vertical column, inner-column, and thumb-cluster target). Journey-blind at the scoring layer; journey weighting lives at Target Selection.
- [x] Phase 5 / Task 5.3: Target Selection engine — `targetSelection.ts` (`selectTarget` + `diagnosticTarget` + `TARGET_JOURNEY_WEIGHTS`) with journey-weighted argmax over character / bigram / vertical-column / inner-column / thumb-cluster candidates; `weaknessScore` extended with phase-aware `JOURNEY_BONUSES` for columnar users.
- [x] Phase 5 / Task 5.4: `generateSession` + persistence — `sessionGenerator.ts` wraps `selectTarget` + exercise generation + briefing assembly; new `session_targets` Postgres table (`0004_naive_firebird.sql`); `persistSession` writes a target row inside the same transaction after the idempotency guard; `sessionStore` gains `targetKeys` / `targetAttempts` / `targetErrors` accumulators in the reducer.
- [x] Phase 5 / Task 5.5: Three-stage session UI wired into `/practice` and `/practice/drill` — `SessionBriefing` component (briefing card with target label + copy + keys + Start, Enter-to-start), `TargetRibbon` static strip (no live metrics), `KeyboardSVG` ivory ring via new `targetKeys` prop, shared `IntentEchoBlock` extracted for post-session intent echo + per-key breakdown + soft next-target preview. Drill route adds a Vertical-reach preset (10-column picker) alongside the existing inner-column / thumb-cluster / cross-hand-bigram presets, same-day compact briefing variant via `sessionStorage`. New `getEngineStatsAndBaseline` server-fn loads the triple `generateSession` needs.
- [x] Phase 5 / Task 5.6: Briefing copy templates V1–V7 — `briefingTemplates.ts` `buildBriefing(target, journey, phase)` returns `{ text, keys }`. Vertical-column (V1) and inner-column (V2) are journey-specific; thumb-cluster, hand-isolation, cross-hand-bigram, character, bigram, diagnostic (V3–V7) are journey-shared. Every string self-checks against §B3 (no hype, no verdict, quietly affirming).
- [x] Phase 5 / Task 5.7: Transparency reframe (copy-only) — coefficient panel acknowledges "hand-tuned starting values, not derived from your data — we'll revisit with beta feedback"; columnar-stability label gains "(experimental)" + footnote about the inferred signal; phase-transition banner switches from declarative "time to switch" to hypothesis framing ("the engine thinks you might be ready to shift focus — you decide"). No metrics, thresholds, or logic changed.
- [x] Phase 5 / Task 5.8: Integration + regression sweep + README ticks — full typecheck / test / format / lint green on `origin/main` after Phase 5 commits; Biome lint baseline settled at 47 errors / 139 warnings / 27 infos with `routeTree.gen.ts` excluded per its own directive. Manual E2E walkthrough deferred to developer per §B9.
