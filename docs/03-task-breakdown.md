# Leftype-Rightype: Task Breakdown for Claude Code

> Status: v0.2 — transition-aware MVP (Phase A)
> Strategy: build incrementally with shippable milestones. Every phase produces something demo-able.
> Estimated total timeline: 12–18 weeks for Phase A MVP (solo developer, part-time)
> Last updated: 2026-04-18

## Phase A / Phase B Context

This document covers **Phase A only** — the first shippable MVP that validates the transition-focused positioning with real users. Phase A deliberately does NOT include:

- Week-by-week structured curriculum (Phase B, post-beta)
- LLM-based content generation (V2, separate roadmap)
- Additional keyboards beyond Sofle and Lily58 (V2+)

Phase A ships a working transition-aware adaptive engine, split-specific metrics, error review, and phase detection. Phase B is committed to only after Phase A beta validates the positioning works.

See `01-product-spec.md` §5 and §7 for full Phase A scope definition.

## Philosophy

This breakdown assumes:
1. You'll use Claude Code with a focused context per task
2. Each task is granular enough for one Claude Code session (1–3 hours of focus)
3. Each phase has a milestone you can demo (motivation + checkpoint)
4. Critical path comes first; polish comes last

## Important: Scope Boundaries

This document is explicit about **who does what** to prevent ambiguity. Every task that touches infrastructure or external systems is split into two scopes:

- **Claude Code scope**: things Claude Code generates, writes, or executes locally on your development machine. This includes source code, configuration files, local Docker containers, local migrations, tests, and documentation. All output is committed to the repo.

- **Your scope**: things you do manually, especially anything that touches your VPS, production database, secrets, deployment, or external services (DNS, TLS, email provider). Claude Code may generate artifacts to support these tasks, but you execute them.

**Why this split**: giving Claude Code direct access to production infrastructure (SSH, deploy commands, secrets) creates a trust boundary that's too large for the autonomy it has. The safer pattern is: Claude Code produces deployable artifacts, you deploy them.

## Development Setup Convention

All development happens locally:
- PostgreSQL runs in Docker on your laptop (via `docker-compose.dev.yml`)
- App runs locally pointing to local postgres
- All migrations tested locally before being applied anywhere else
- VPS is only touched when you decide to deploy (Phase 4+)

This means Claude Code never needs SSH access or VPS credentials.

---

## Phase 0: Foundation (Estimate: 1 week)

**Goal**: project skeleton ready to build on. No user-facing features yet.

### Task 0.1: Project setup

**Claude Code scope:**
- Initialize project structure per 02-architecture.md
- Configure TypeScript with strict mode, ESLint, Prettier
- Set up Vite + Tanstack Start (or Next.js 15 — finalize this in a quick tech decision before starting)
- Configure Tailwind with custom color tokens from 04-design-system.md (8 finger colors, amber accent, dark espresso palette)
- Create a hello world page that proves the dev server works
- Generate `.gitignore`, `package.json` scripts (`dev`, `build`, `lint`, `typecheck`)
- Generate basic `README.md` with local dev instructions

**Your scope:**
- Verify Node.js version installed (probably 20+ LTS)
- Run `npm install` once Claude Code generates `package.json`
- Run `npm run dev` and confirm hello world renders in browser

### Task 0.2: Local database setup

**Claude Code scope:**
- Generate `docker-compose.dev.yml` with postgres service (postgres:16, exposed on 5432, with volume for persistence)
- Generate `.env.example` with all DB-related vars documented (`DATABASE_URL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)
- Set up Drizzle ORM and Drizzle Kit
- Write `db/schema.ts` with all tables from 02-architecture.md
- Generate initial migration via `drizzle-kit generate` and commit to `db/migrations/`
- Write `db/seed.ts` that loads word_corpus from a static source (google-10000-english or similar — Claude Code can suggest sources, you decide)
- Generate `db/README.md` with local setup instructions
- Add `npm run db:generate`, `db:migrate`, `db:seed` scripts to `package.json`

**Your scope:**
- Verify Docker installed locally
- Copy `.env.example` to `.env` and set local dev credentials (any password is fine for local)
- Run `docker-compose -f docker-compose.dev.yml up -d` to start postgres
- Run `npm run db:migrate` to apply schema
- Run `npm run db:seed` to populate word_corpus
- Verify by querying postgres (psql, DBeaver, TablePlus, or similar)

### Task 0.3: Auth infrastructure

**Claude Code scope:**
- Install and configure better-auth (or lucia — finalize before starting)
- Implement email magic link flow (with email provider stubbed for local dev — log magic link to console instead of sending real email)
- Generate session/auth tables via Drizzle migration
- Write protected route helper (middleware or hook depending on framework)
- Build minimal login + logout pages (functional, not styled — polish comes later)
- Generate `.env.example` additions for auth (`AUTH_SECRET`, email provider keys when ready)

**Your scope:**
- Decide email provider for production later (Resend, Postmark, AWS SES, etc.) — not needed for local dev
- For local dev, just read magic link from server console output

**Phase 0 milestone**: register, login, logout works locally. Empty placeholder for authenticated home page.

---

## Phase 1: Domain Core (Estimate: 2.5 weeks)

**Goal**: the transition-aware adaptive engine works in isolation. No UI consumes it yet. All tasks here are pure code — no infrastructure work.

**Note**: this entire phase is Claude Code scope by default. No VPS or external service involvement. Your role is to review code, validate finger assignments against your real keyboard experience, and write/run tests.

**Scope change from v0.1**: Phase 1 now includes transition-phase-aware logic and split-specific metrics computation. Estimate grew from 1.5 to 2.5 weeks accordingly.

### Task 1.1: Finger assignment data

**Claude Code scope:**
- Research Sofle finger assignments from public sources (QMK keymap defaults, r/ergomechkeyboards references)
- Research Lily58 finger assignments from public sources
- Write TypeScript constants in `domain/finger/sofle.ts` and `lily58.ts`
- Implement `resolver.ts` with API: `getFingerForKey(layout, char) → KeyAssignment`
- Write unit tests covering every key in both layouts

**Your scope:**
- **Critical**: review and validate finger assignments against your real Sofle and Lily58. You are the ground truth here. Public references can be wrong or default to assumptions that don't match your physical setup.
- Correct any assignments that don't match your experience and explain to Claude Code why

### Task 1.2: Statistics computation

**Claude Code scope:**
- Implement `computeStats.ts`: from array of keystroke events → CharacterStats[] + BigramStats[]
- Implement `computeBaseline.ts`: from user stats → UserBaseline, **phase-aware** (transitioning-phase baseline is higher error rate than refining-phase)
- Implement `decayStats.ts`: discount weight for events older than 30 days
- Exhaustive unit tests

**Your scope:**
- Review test fixtures to make sure they represent realistic user data
- Validate that baseline computation makes intuitive sense for both phases (transitioning user around 8% error baseline, refining user around 3%)

### Task 1.3: Adaptive engine (transition-aware, word-picker)

**Content generation strategy for MVP: word-picker (see 02-architecture.md §4.2).** The engine selects from a static English word corpus, not LLM-generated content. LLM-based content generation is a V2 feature.

**Claude Code scope:**
- Curate English word corpus (target ~10,000 words): source from a permissively-licensed frequency list (e.g., Google 10000 English, or Peter Norvig's corpus), filter out offensive/profane words manually
- Precompute corpus metadata: for each word compute length, constituent characters, bigrams, frequency rank, hand distribution (per Sofle and Lily58 finger assignment tables), **columnar complexity score** (how much inner-column content does this word have)
- Store corpus as static JSON file (target <300KB) loaded client-side
- Implement `weaknessScore.ts` with **phase-aware coefficients** per 02-architecture.md §4.1 (COEFFICIENTS object with `transitioning` and `refining` variants + inner-column transition bonus)
- Implement `exerciseGenerator.ts` (adaptive mode, word-picker) with **phase-aware content weighting** — transitioning phase biases toward columnar-heavy words, refining phase uses pure weakness profile
- Implement `drillGenerator.ts` (targeted drill) with synthetic string generation
- Implement preset drill modes: "inner column" (B, G, H, N, T, Y focus), "thumb cluster" (space + thumb keys), "cross-hand bigrams" (th, he, in, etc.)
- Unit tests with fixture data for both phases

**Your scope:**
- Review the curated corpus and remove any words that feel inappropriate for a typing platform (offensive, overly complex, overly simple)
- Review the weakness scoring formula and challenge if any coefficient feels wrong
- Test the exercise generator manually for both phases: feed it a transitioning-phase user weak in B, verify generated words are both B-heavy AND contain inner-column characters more frequently than baseline. Then test a refining-phase user and validate different output characteristics
- **Gut-check the output quality**: the word-picker produces disjoint words, not prose. Validate that this feels acceptable for MVP launch

**Explicitly out of scope for MVP:**
- LLM integration for content generation (deferred to V2)
- Any server-side content generation (everything must run client-side on the static corpus)

### Task 1.4: Split-specific metrics computation (NEW)

**Claude Code scope:**
- Implement `computeSplitMetrics.ts` per 02-architecture.md §4.5
- Compute 4 metrics from keystroke events:
  - Inner column error rate (B, G, H, N, T, Y)
  - Thumb cluster decision time (time to press thumb keys)
  - Cross-hand bigram timing (bigrams spanning both hands)
  - Columnar stability (inferred from error patterns — same-hand adjacent-column drift)
- Handle insufficient-data case (sessions with <50 keystrokes return "not enough data")
- Unit tests with fixture keystroke streams

**Your scope:**
- Validate that columnar stability heuristic makes sense for your real error patterns — especially verify that B→V and B→N errors classify differently (V is adjacent column, same hand = drift; N is different hand entirely = QWERTY memory residue)
- Flag if the 4 metrics feel redundant or if any can be cut

### Task 1.5: Insight generator

**Claude Code scope:**
- Implement `sessionInsight.ts`
- Implement plain-language summary (template-based for MVP, no LLM)
- Implement pattern analysis — detect common error patterns (B↔N confusion, B↔V drift, thumb cluster hesitation) and surface in session insight
- Templates should honor accuracy-first copy guidelines (see 01-product-spec.md §6.2): lead with accuracy, frame speed-up-with-accuracy-drop as a concern, use quiet affirmation tone
- Unit tests for various scenarios

**Your scope:**
- Review template-generated summaries and challenge if any feel robotic, condescending, or hyped
- Suggest tone adjustments based on what feels right for a transitioner audience

### Task 1.6: Phase transition suggestion (NEW)

**Claude Code scope:**
- Implement `phaseSuggestion.ts` per 02-architecture.md §4.6
- Logic: detect when user should transition from `transitioning` → `refining` (10+ sessions with >95% accuracy AND <8% inner column error), or vice versa (return after 2+ weeks break with accuracy drop)
- Output: `PhaseTransitionSignal` with suggested phase, reason (plain language), and confidence level
- Unit tests covering both directions and edge cases (insufficient sessions, mixed signals)

**Your scope:**
- Review the thresholds (>95% accuracy, <8% inner column error, 10 sessions, 2 weeks) and challenge if any feel wrong based on your transition experience
- Test that the suggestion messaging doesn't feel pushy or condescending

**Phase 1 milestone**: unit test suite proving the transition-aware engine works. CLI script `npm run demo:engine` simulating both transitioning-phase and refining-phase users, outputting generated exercises and computed split metrics. Run manually and gut-check.

---

## Phase 2: Typing Experience (Estimate: 3.5 weeks)

**Goal**: user can onboard, pick a keyboard, practice with proper error visualization, and see results inline. Largest and most critical chunk.

**Scope change from v0.1**: added error "expected character above" visualization, pause state with inline settings, post-session inline transition, and post-session error review. Estimate grew from 2.5 to 3.5 weeks.

**Note**: like Phase 1, this is mostly Claude Code scope. All work is in the codebase, all testing is local.

### Task 2.1: Onboarding flow

**Claude Code scope:**
- Page `/onboarding` with 3-step linear flow (per 05-information-architecture.md §4.6 and onboarding-wireframe.html)
- Step 1: pick keyboard (Sofle / Lily58 with SVG previews — reuse SofleSVG and Lily58SVG from Task 2.2)
- Step 2: pick dominant hand (left / right)
- Step 3: self-report level (first day / few weeks / comfortable) — determines initial `transition_phase` per 02-architecture.md §2 keyboard_profiles
- Save to `keyboard_profiles` table via Drizzle with `transition_phase` set (first_day/few_weeks → transitioning; comfortable → refining)
- Redirect to `/practice` with initial curated first-session exercise (diagnostic for new users)

**Your scope:**
- Run through onboarding as a real user, note any friction
- Validate copy doesn't sound condescending or AI-generated

### Task 2.2: Visual Keyboard SVG (reuse from design artifacts)

**Claude Code scope:**
- Extract SVG structure from `design/keyboard-svg-preview.html` (Step 3 of design phase generated both Sofle and Lily58 SVGs with finger color bars)
- Component `<SofleSVG />` rendering both halves from the design asset
- Component `<Lily58SVG />` rendering both halves from the design asset
- Props: `targetKey?: string`, `showFingerBars?: boolean`, `onKeyClick?: (key) => void`
- Highlight target key (amber fill, brighter border, subtle glow)
- Per-keypress visual feedback: green flash (correct), red flash (error), yellow (hesitation > 2σ)
- **Critical**: feedback latency < 16ms; use refs + direct DOM manipulation instead of React state for the critical path
- Extract keyboard specs to `.ts` data files so components can read positions programmatically (for heatmap overlay on dashboard)

**Your scope:**
- Side-by-side compare rendered SVG with your physical keyboards. The proportions and key positions should match — you caught the proportions already in design phase, but verify they didn't drift during React port.
- Test feedback latency feels instant. If there's any noticeable delay, push back to Claude Code.

### Task 2.3: Typing area component (with error visualization)

**Claude Code scope:**
- Component `<TypingArea />`: display target text, highlight current position, capture keystrokes
- Font size 36px (large, generous line-height per practice-page-wireframe.html)
- Hook `useKeystrokeCapture` to handle keydown events, compute keystroke_ms, detect errors
- **Error visualization pattern** (per 01-product-spec.md §6.1):
  - Wrong character displayed red with underline
  - **Expected character displayed in small amber badge above the typed character** with arrow pointer
  - Cursor stays at position — user must backspace to correct
  - No audio feedback
- Buffer keystroke events in Zustand store
- End-session auto-triggers when exercise completes
- Preference respect: `expectedLetterHint: 'on' | 'off'` from user settings

**Your scope:**
- Test error visualization feels helpful, not noisy. Especially try scenarios where you make 2-3 errors in quick succession — expected-character badges shouldn't overlap or flicker jarringly.
- Validate 36px feels right on your monitor, or adjust size setting defaults

### Task 2.4: Practice page integration with pause state (NEW)

**Claude Code scope:**
- Page `/practice` with three stage states per practice-page-wireframe.html: pre-session, active typing, post-session (inline, NOT modal)
- Pre-session: keyboard context pill + transition phase badge + primary CTA + mode cards (adaptive, inner column drill, warm up) + collapsible filters
- Active typing: typing area + visual keyboard (below) + live WPM (corner) + shortcut hints (corner) + auto-hidden nav
- **Pause overlay state** (triggered by Esc key):
  - Semi-opaque backdrop blur overlay
  - Pause panel with inline settings: typing text size (S/M/L/XL), visual keyboard visibility, expected-letter hint toggle
  - Actions: Resume (Enter), Restart exercise (Tab+Enter), End session
  - Settings update in-session, not globally saved (global settings are in `/settings`)
- Transition between states via fade animation (200-300ms)

**Your scope:**
- Validate pause workflow: Esc → settings → Enter to resume feels natural
- Confirm that during active typing, NO settings are accessible (distraction prevention)

### Task 2.5: Post-session inline summary with error review (NEW)

**Claude Code scope:**
- Post-session state transitions inline in `/practice` (same page, typing area replaced with summary)
- Summary layout per practice-page-wireframe.html:
  - Complete badge at top
  - Title (context-aware based on accuracy/speed outcome — e.g., "Accuracy held up well." for flat accuracy, "Nice accuracy gain." for improvement)
  - Stats row with accuracy FIRST (featured amber), speed second, time third
  - **Error review section** (NEW): full exercise text with error characters highlighted red, hover tooltip showing "typed X, expected Y", pattern analysis paragraph below
  - Weakness shifts section: two columns (improved / watch this)
  - Insight callout in amber
  - Actions: Practice again (primary), Drill [specific weakness] (context-aware secondary), View dashboard
- Pattern analysis logic: detect error patterns from session keystrokes (reuses Task 1.5 insight generator logic)
- Copy follows accuracy-first guidelines from 01-product-spec.md §6.2

**Your scope:**
- Validate error review pattern analysis is actually useful, not just generic summaries
- Confirm accuracy-first framing lands — stat hierarchy should visually lead with accuracy
- Test hover tooltips on error characters work smoothly

### Task 2.6: Drill mode submode

**Claude Code scope:**
- Page `/practice/drill` per 05-information-architecture.md §4.3
- Pre-drill screen: auto-recommend target (from top weakness) or manual select
- Include **preset drill modes** from Task 1.3: inner column, thumb cluster, cross-hand bigrams
- Generate synthetic string via drill generator
- Same typing experience flow as practice (typing area, SVG keyboard, pause state, post-session)

**Your scope:**
- Test that drill mode actually feels different from adaptive practice — heavier repetition of target unit
- Validate inner column preset drill feels meaningfully focused on B/G/H/N/T/Y

### Task 2.7: Hand isolation filter

**Claude Code scope:**
- Toggle UI for "left hand only" / "right hand only" / "both" in pre-session filters
- Pass to exercise generator as a filter
- Filter word_corpus accordingly using precomputed hand distribution metadata

**Your scope:**
- Validate that "left hand only" actually generates words typeable with left hand only on Sofle/Lily58

**Phase 2 milestone**: full end-to-end flow. Onboard, practice adaptively for 5 minutes, see inline post-session summary with error review, data persists in local DB.

---

## Phase 3: Dashboard & Meta-Cognition (Estimate: 2 weeks)

**Goal**: surface insights to the user with power-user style transparency.

**Note**: still entirely local development. No infra work.

### Task 3.1: Session summary screen

**Claude Code scope:**
- Auto-shown after session end
- Show metrics: WPM, accuracy, improvements
- Show top 3 weaknesses before vs after
- Plain-language summary
- "Practice again" CTA

### Task 3.1: Session summary integration (already covered in Task 2.5)

Task 2.5 implements the inline post-session summary. This section documents it as a Phase 3 milestone dependency — the summary is part of the dashboard ecosystem even though implemented in Phase 2.

### Task 3.2: Dashboard page

**Claude Code scope:**
- Page `/dashboard` per 05-information-architecture.md §4.4 and dashboard-wireframe.html
- 6 sections in narrative order:
  1. Hero stats — accuracy featured primary (not speed), split-specific metrics secondary
  2. Activity log — 30-day GitHub-style contribution grid + latest 5 sessions list
  3. Heatmap — per-key error rate overlay on visual keyboard SVG
  4. Weakness ranking — top 7-10 with score breakdown
  5. Skill trajectory — WPM and accuracy trend charts (Recharts)
  6. Engine insight — plain-language narrative + decision rationale + always-expanded formula
- **Split-specific metrics section (NEW)**: dedicated area for inner column error rate, thumb cluster time, cross-hand bigram timing, columnar stability with accuracy caveats surfaced (per 01-product-spec.md §5.4)
- Footer CTA: "Ready to keep going?" with context-aware next-exercise preview
- Phase indicator: small badge showing current phase (transitioning/refining) with link to change in settings

**Your scope:**
- Review dashboard narrative flow — does scrolling top to bottom tell a coherent story?
- Validate that accuracy is visually primary (not speed)
- Sanity check split-specific metrics — does the columnar stability number feel meaningful, or noise?

### Task 3.3: Power-user transparency panel

**Claude Code scope:**
- Always-expanded "How is this calculated?" section per dashboard §6 (not collapsed)
- Show weakness score formula with **current phase coefficients** (visually different for transitioning vs refining)
- Show current values per component for top weakness with live calculation breakdown
- Decision rationale: "Next exercise will emphasize: B (score 2.8), er (score 2.1), T (score 1.7). These represent 60% of high-friction units this week."
- Include inner-column transition bonus explanation when applicable

**Your scope:**
- Validate that the transparency panel is actually understandable, not just "transparent in theory"
- Gut-check that the formula display doesn't look intimidating to a developer-leaning user

### Task 3.4: Weekly insight + phase transition detection

**Claude Code scope:**
- Aggregate stats per week
- Temporal patterns chart (WPM by hour/day)
- Skill trajectory text
- Actionable recommendations (template-based)
- **Phase transition suggestion banner** (NEW): non-intrusive banner at top of dashboard when `phaseSuggestion.ts` detects user should switch phases. Dismissible. Max once per session.
- Weekly insight copy honors accuracy-first guidelines

**Your scope:**
- Review weekly insights for honesty — if user hasn't improved in 2 weeks, platform should say so (per Core Value 2.2)
- Validate phase transition suggestion isn't pushy

### Task 3.5: Multi-keyboard switcher

**Claude Code scope:**
- Header / settings switch between profiles
- Stats per profile (independent)
- Visual indicator for active profile
- Each profile has its own transition_phase (user could be transitioning on new Lily58, refining on established Sofle)

**Phase 3 milestone**: dashboard functional locally. You can see your progress (from your own dogfooding sessions) and understand why the engine picks specific exercises. Split-specific metrics are visible and make intuitive sense.

---

## Phase 4: Polish & Launch Prep (Estimate: 1.5–2 weeks)

**Goal**: ready to deploy to your VPS and open to beta users.

**This is where infra work begins.** Significant split between Claude Code scope (artifacts) and your scope (deployment).

### Task 4.1: First-session experience

**Claude Code scope:**
- Special handling for users with zero data
- Curated default exercise (not random)
- Onboarding tooltip in typing area
- Encouraging copy

### Task 4.2: Error handling & edge cases

**Claude Code scope:**
- Network failure during session save (retry + local cache)
- Partial session (user closes browser mid-way)
- Browser refresh during typing
- Multi-tab handling

### Task 4.3: Responsive design

**Claude Code scope:**
- Desktop primary
- Tablet acceptable
- Mobile: show "use desktop" message

### Task 4.4: Accessibility basics

**Claude Code scope:**
- Keyboard navigation across all flows
- Screen reader labels
- WCAG AA color contrast
- Reduce-motion option

### Task 4.5: Documentation page

**Claude Code scope:**
- "How it works" page explaining adaptive engine
- "Why split keyboard transition is hard" page
- FAQ
- Privacy policy + ToS (template-based, you customize)

### Task 4.6: Production deployment artifacts

**Claude Code scope:**
- Generate production `Dockerfile` for the app (multi-stage build, optimized)
- Generate `docker-compose.prod.yml` example with app + postgres services (you'll customize for your VPS)
- Generate `.env.production.example` with all required env vars documented
- Generate `DEPLOYMENT.md` with step-by-step manual deployment checklist
- Generate database backup script template (`scripts/backup-db.sh`)
- Generate health check endpoint in app (`/health` returning 200)

**Your scope (entirely manual):**
- Provision VPS (you've done this before)
- Install Docker + docker-compose on VPS
- Set up reverse proxy (Nginx/Caddy) with TLS via Let's Encrypt
- Set up firewall rules (ufw or similar)
- Configure DNS for your domain
- Set up email provider (Resend/Postmark/etc.) and add credentials to production .env
- Set up Sentry or alternative for error tracking (optional but recommended)
- Set up backup cron job using the script template Claude Code generated
- SSH to VPS, pull docker-compose.prod.yml, populate .env, deploy
- Run production migrations
- Smoke test: register, onboard, run a session, verify data persists

**Important**: Claude Code does not generate CI/CD workflows (GitHub Actions, etc.) since you're handling deployment manually. If you change your mind later and want to automate, that becomes a separate task.

### Task 4.7: Beta launch

**Claude Code scope:**
- Generate launch announcement template (for r/ErgoMechKeyboards, Discord, etc.)
- Generate feedback form (simple Google Form or in-app)

**Your scope:**
- Post to communities (r/ErgoMechKeyboards, r/ergodox, QMK/ZMK Discord)
- Engage with feedback
- Track Phase 1 success metrics from product spec

**Phase 4 milestone**: live at your domain. First beta users using it.

---

## Phase 5: MVP Phase B (Gated — Post-Beta Validation Only)

**Important**: Do NOT start Phase B until Phase A beta validates the transition-focused positioning (see 01-product-spec.md §8 "Phase A → Phase B transition gate").

**If validation succeeds, Phase B adds:**
- Week-by-week structured curriculum (Week 1: home row → Week 2: inner column → Week 3: thumb cluster → Week 4: cross-hand bigram flow)
- Progression milestones with unlock criteria
- Deeper diagnostic assessments (vs. Phase A lightweight diagnostic)
- Curriculum dashboard
- Transition/refinement UI mode switcher (curriculum UI for transitioners, adaptive UI for refiners)

Phase B tasks will be specced in detail only after Phase A beta provides clear feedback. Don't pre-scope this.

## Phase 6+: Post-MVP (Reactive)

Driven by beta feedback. Candidates from product spec:
- LLM-based content generation (V2 upgrade from word-picker)
- Real Sentence Mode
- Layer Training
- More keyboards (Corne likely top request)
- Leaderboard
- BYO-LLM via MCP (experimental, far future)

**Avoid**: don't add features without signal from real users. Keep them in GitHub issues.

---

## Tips for Working with Claude Code

**Per task, prepare context:**
- Reference relevant doc files (`01-product-spec.md`, `02-architecture.md`, `04-design-system.md`, `05-information-architecture.md`, `06-design-summary.md`)
- Wireframes in `design/` folder — reference specific wireframe file per task (e.g., Task 2.4 references `practice-page-wireframe.html`)
- Specific task description from this document
- Existing files relevant to the task (don't dump entire codebase)

**Workflow pattern:**
1. Start by writing a test (or executable spec)
2. Have Claude Code implement until tests pass
3. Review the code, request refactors as needed
4. Commit with a descriptive message

**When to challenge Claude Code:**
- Code you don't fully understand → ask for explanation, don't accept blindly
- Design decisions that contradict the docs → push back, refer to doc
- Architecture suggestions that feel over-engineered → push for simpler
- Code that "works" but feels off → trust your instinct, ask for alternatives
- Copy that sounds hyped or condescending → enforce accuracy-first guidelines from 01-product-spec.md §6.2
- Adaptive behavior that doesn't respect transition phase → flag it

**When to trust Claude Code:**
- Boilerplate generation (Drizzle schemas, basic React components)
- Test scaffolding
- Refactoring within established patterns
- Documentation generation

**Anti-patterns to avoid:**
- Telling Claude Code "build the whole app" — it'll be messy
- Skipping tests for domain logic — regression will be painful
- Accepting infrastructure code without reviewing it line by line — production secrets and security are not areas to delegate fully
- Letting Claude Code modify production data or VPS directly — keep that boundary
