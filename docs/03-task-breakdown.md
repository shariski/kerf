# Leftype-Rightype: Task Breakdown for Claude Code

> Strategy: build incrementally with shippable milestones. Every phase produces something demo-able.
> Estimated total timeline: 8–14 weeks (solo developer, part-time)
> Last updated: 2026-04-17

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

## Phase 1: Domain Core (Estimate: 1.5 weeks)

**Goal**: the adaptive engine works in isolation. No UI consumes it yet. All tasks here are pure code — no infrastructure work.

**Note**: this entire phase is Claude Code scope by default. No VPS or external service involvement. Your role is to review code, validate finger assignments against your real keyboard experience, and write/run tests.

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
- Implement `computeBaseline.ts`: from user stats → UserBaseline
- Implement `decayStats.ts`: discount weight for events older than 30 days
- Exhaustive unit tests

**Your scope:**
- Review test fixtures to make sure they represent realistic user data
- Validate that baseline computation makes intuitive sense (e.g., a user with 95% accuracy should get baseline error rate around 5%)

### Task 1.3: Adaptive engine (word-picker approach)

**Content generation strategy for MVP: word-picker (see 02-architecture.md §4.2).** The engine selects from a static English word corpus, not LLM-generated content. LLM-based content generation is a V2 feature.

**Claude Code scope:**
- Curate English word corpus (target ~10,000 words): source from a permissively-licensed frequency list (e.g., Google 10000 English, or Peter Norvig's corpus), filter out offensive/profane words manually
- Precompute corpus metadata: for each word compute length, constituent characters, bigrams, frequency rank, hand distribution (per Sofle and Lily58 finger assignment tables)
- Store corpus as static JSON file (target <300KB) loaded client-side
- Implement `weaknessScore.ts` with the formula in 02-architecture.md
- Implement `exerciseGenerator.ts` (adaptive mode, word-picker) with seeded random for testability
- Implement `drillGenerator.ts` (targeted drill) with synthetic string generation
- Unit tests with fixture data

**Your scope:**
- Review the curated corpus and remove any words that feel inappropriate for a typing platform (offensive, overly complex, overly simple)
- Review the weakness scoring formula and challenge if any coefficient feels wrong
- Test the exercise generator manually: feed it a fake user weak in B, verify generated words contain B more frequently than baseline
- **Gut-check the output quality**: the word-picker produces disjoint words, not prose. Validate that this feels acceptable for MVP launch, or flag if it feels too rough even as an MVP compromise

**Explicitly out of scope for MVP:**
- LLM integration for content generation (deferred to V2)
- Any server-side content generation (everything must run client-side on the static corpus)

### Task 1.4: Insight generator

**Claude Code scope:**
- Implement `sessionInsight.ts`
- Implement plain-language summary (template-based for MVP, no LLM)
- Unit tests for various scenarios

**Your scope:**
- Review template-generated summaries and challenge if any feel robotic, condescending, or unhelpful
- Suggest tone adjustments based on what feels right for a transitioner audience

**Phase 1 milestone**: unit test suite proving the engine works. CLI script `npm run demo:engine` simulating user data and outputting generated exercises. Run this manually and gut-check that output looks reasonable.

---

## Phase 2: Typing Experience (Estimate: 2.5 weeks)

**Goal**: user can onboard, pick a keyboard, practice, and see results. Largest and most critical chunk.

**Note**: like Phase 1, this is mostly Claude Code scope. All work is in the codebase, all testing is local.

### Task 2.1: Onboarding flow

**Claude Code scope:**
- Page `/onboarding` with 3-step linear flow (per 05-information-architecture.md §4.6)
- Pick keyboard, dominant hand, self-report level
- Save to `keyboard_profiles` table via Drizzle
- Redirect to `/practice` with initial curated exercise

**Your scope:**
- Run through onboarding as a real user, note any friction
- Validate copy doesn't sound condescending or AI-generated

### Task 2.2: Visual Keyboard SVG (high priority, complex)

**Claude Code scope:**
- Component `<SofleSVG />` rendering both halves
- Component `<Lily58SVG />` rendering both halves
- 8-color finger coding from design system
- Highlight target key (brighter color, glow effect)
- Highlight expected finger in finger guide area
- Per-keypress visual feedback: green flash (correct), red flash (error), yellow (hesitation > 2σ)
- **Critical**: feedback latency < 16ms; use refs + direct DOM manipulation instead of React state for the critical path

**Your scope:**
- Side-by-side compare rendered SVG with your physical keyboards. The proportions and key positions should match.
- Test feedback latency feels instant (it should — if there's any noticeable delay, push back to Claude Code)

**Tip**: this is the most visual and most error-prone task. Don't accept the first SVG output — iterate until it feels right.

### Task 2.3: Typing area component

**Claude Code scope:**
- Component `<TypingArea />`: display target text, highlight current position, capture keystrokes
- Hook `useKeystrokeCapture` to handle keydown events, compute keystroke_ms, detect errors
- Buffer keystroke events in Zustand store
- End-session button + auto-end when exercise completes

**Your scope:**
- Type through several exercises, validate that the experience feels natural and responsive
- Catch edge cases: what happens if you type too fast, too slow, hold a key, press modifier combos

### Task 2.4: Practice page integration

**Claude Code scope:**
- Page `/practice` per 05-information-architecture.md §4.2
- Pre-session screen with options (continue / drill / warm-up)
- Active session: typing area + keyboard SVG side by side
- Auto-hide top nav during active typing
- On session end: batch insert keystroke events to local DB, update stats tables
- Post-session summary screen

**Your scope:**
- Run a full session end-to-end and validate data is persisted correctly
- Inspect the database manually to confirm keystroke events look right

### Task 2.5: Drill mode

**Claude Code scope:**
- Page `/practice/drill` per 05-information-architecture.md §4.3
- Pre-drill screen: auto-recommend or manual select
- Generate synthetic string via drill generator
- Same typing experience flow as practice

**Your scope:**
- Test that drill mode actually feels different from adaptive practice — heavier repetition of target unit

### Task 2.6: Hand isolation filter

**Claude Code scope:**
- Toggle UI for "left hand only" / "right hand only" / "both"
- Pass to exercise generator as a filter
- Filter word_corpus accordingly

**Your scope:**
- Validate that "left hand only" actually generates words typeable with left hand only on Sofle/Lily58

**Phase 2 milestone**: full end-to-end flow. Onboard, practice adaptively for 5 minutes, data persists in local DB.

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

### Task 3.2: Dashboard page

**Claude Code scope:**
- Page `/dashboard` per 05-information-architecture.md §4.4
- Per-key heatmap on visual keyboard (using SofleSVG/Lily58SVG with `--lr-heat-*` overlay)
- WPM and accuracy trend charts (Recharts)
- Top 5 weakness ranking with score breakdown

### Task 3.3: Power-user transparency panel

**Claude Code scope:**
- Collapsible "How is this calculated?" section
- Show weakness score formula
- Show current values per component
- Decision rationale explanation

**Your scope:**
- Validate that the transparency panel is actually understandable, not just "transparent in theory"

### Task 3.4: Weekly insight

**Claude Code scope:**
- Aggregate stats per week
- Temporal patterns chart
- Skill trajectory text
- Actionable recommendations (template-based)

### Task 3.5: Multi-keyboard switcher

**Claude Code scope:**
- Header / settings switch between profiles
- Stats per profile (independent)
- Visual indicator for active profile

**Phase 3 milestone**: dashboard functional locally. You can see your progress (from your own dogfooding sessions) and understand why the engine picks specific exercises.

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

## Phase 5+: Post-MVP (Reactive)

Driven by beta feedback. Candidates from product spec:
- Real Sentence Mode
- Layer Training
- More keyboards (Corne likely top request)
- Leaderboard

**Avoid**: don't add features without signal from real users. Keep them in GitHub issues.

---

## Tips for Working with Claude Code

**Per task, prepare context:**
- Reference relevant doc files (`01-product-spec.md`, `02-architecture.md`, `04-design-system.md`, `05-information-architecture.md`)
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
