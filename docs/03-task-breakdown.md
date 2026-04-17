# Leftype-Rightype: Task Breakdown for Claude Code

> Strategy: build incrementally with shippable milestones. Every phase produces something demo-able.
> Estimated total timeline: 8–14 weeks (solo developer, part-time)

## Philosophy

This breakdown assumes:
1. You'll use Claude Code with a focused context per task
2. Each task is granular enough for one Claude Code session (1–3 hours of focus)
3. Each phase has a milestone you can demo (motivation + checkpoint)
4. Critical path comes first; polish comes last

## Phase 0: Foundation (Estimate: 1 week)

**Goal**: project skeleton ready to build on. No user-facing features yet.

### Task 0.1: Project setup
- Initialize the project structure (per 02-architecture.md)
- Set up TypeScript strict mode, ESLint, Prettier
- Set up Vite (if pure SPA) or Tanstack Start (if fullstack)
- Set up Tailwind with custom color tokens (8 colors for 8 fingers)
- Hello world page

### Task 0.2: Database setup
- Set up PostgreSQL on the VPS (Docker compose)
- Set up Drizzle ORM
- Write schemas for all tables in 02-architecture.md
- Set up the migration workflow
- Seed script for word_corpus (use google-10000-english or similar)

### Task 0.3: Auth infrastructure
- Set up better-auth (or lucia)
- Implement email magic link flow
- Protected route helper
- Login + logout pages (minimal UI, polish later)

**Phase 0 milestone**: register, login, logout works. Empty dashboard placeholder.

---

## Phase 1: Domain Core (Estimate: 1.5 weeks)

**Goal**: the adaptive engine works in isolation. No UI consumes it yet.

### Task 1.1: Finger assignment data
- Research Sofle finger assignments (references on r/ergomechkeyboards, or your own experience)
- Research Lily58 finger assignments (same)
- Write as TypeScript constants in `domain/finger/sofle.ts` and `lily58.ts`
- Implement `resolver.ts` with API: `getFingerForKey(layout, char) → KeyAssignment`
- Unit test all keys

**Note**: as a Sofle and Lily58 user yourself, you're the best ground-truth source for validating these assignments.

### Task 1.2: Statistics computation
- Implement `computeStats.ts`: from array of keystroke events → CharacterStats[] + BigramStats[]
- Implement `computeBaseline.ts`: from user stats → UserBaseline (mean error rate, mean keystroke time, etc.)
- Implement `decayStats.ts`: discount weight for events older than 30 days
- Exhaustive unit tests

### Task 1.3: Adaptive engine
- Implement `weaknessScore.ts` with the formula in 02-architecture.md
- Implement `exerciseGenerator.ts` (adaptive mode) with seeded random for testability
- Implement `drillGenerator.ts` (targeted drill) with synthetic string generation
- Unit tests with fixture data (e.g., a user weak in B should generate words heavy in B)

### Task 1.4: Insight generator
- Implement `sessionInsight.ts`
- Implement plain-language summary (template-based for MVP, no LLM)
- Unit tests for various scenarios (improvement, regression, new weakness)

**Phase 1 milestone**: a unit test suite proving the engine works. CLI script `npm run demo:engine` simulating user data and outputting generated exercises.

---

## Phase 2: Typing Experience (Estimate: 2.5 weeks)

**Goal**: user can onboard, pick a keyboard, practice, and see results. This is the largest and most critical chunk.

### Task 2.1: Onboarding flow
- Page `/onboarding`
- Pick keyboard (Sofle / Lily58) with visual preview
- Pick dominant hand
- Self-report level (3 options)
- Save to `keyboard_profiles` table
- Redirect to practice page

### Task 2.2: Visual Keyboard SVG (high priority, complex)
- Component `<SofleSVG />`: render both halves as SVG
- Component `<Lily58SVG />`: same
- 8-color finger coding
- Highlighted target key (brighter color, glow effect)
- Highlighted expected finger in the finger guide area (below or beside the keyboard)
- Per-keypress visual feedback: green flash (correct), red flash (error), yellow (hesitation > 2σ)
- **Critical**: feedback latency < 16ms; use refs + direct DOM manipulation

**Claude Code tip**: this is the most visual task. Consider asking Claude Code to generate a basic SVG first, then refine manually or via figma → svg export.

### Task 2.3: Typing area component
- Component `<TypingArea />`: display target text, highlight current position, capture keystrokes
- Hook `useKeystrokeCapture` to handle keydown events, compute keystroke_ms, detect errors
- Buffer keystroke events in the Zustand store
- End-session button + auto-end when exercise completes

### Task 2.4: Practice page integration
- Page `/practice`
- Show active keyboard profile (with switch option)
- Generate exercise via the adaptive engine (initial: cold start with default exercise)
- Show typing area and keyboard SVG side by side
- On session end: batch insert keystroke events to server, update stats tables (server side)

### Task 2.5: Drill mode
- Page `/practice/drill` or `/practice?mode=drill`
- UI to pick a target (auto-recommend from top weakness, or manual select)
- Generate synthetic string via the drill generator
- Same typing experience flow

### Task 2.6: Hand isolation filter
- Toggle UI for "left hand only" / "right hand only" / "both"
- Pass to exercise generator as a filter
- Generator filters word_corpus accordingly

**Phase 2 milestone**: full end-to-end flow. User can onboard, practice adaptively for 5 minutes, and data persists in the DB.

---

## Phase 3: Dashboard & Meta-Cognition (Estimate: 2 weeks)

**Goal**: surface insights to the user with power-user style transparency.

### Task 3.1: Session summary screen
- Auto-shown after session end
- Show metrics: WPM, accuracy, improvements
- Show top 3 weaknesses before vs after
- Plain-language summary
- "Practice again" CTA

### Task 3.2: Dashboard page
- Page `/dashboard`
- Per-key heatmap on the visual keyboard (use SofleSVG/Lily58SVG with color overlay)
- WPM trend chart over time (Recharts)
- Accuracy trend chart over time
- Current top 5 weakness ranking with score breakdown

### Task 3.3: Power-user transparency panel
- Collapsible "How is this calculated?" section
- Show the weakness score formula
- Show current values per component (alpha × normalized_error, beta × normalized_hesitation, etc.)
- Decision rationale: "Next exercise will emphasize: letter B (score 2.3), bigram 'er' (score 1.8), letter T (score 1.5)"

### Task 3.4: Weekly insight
- Aggregate stats per week
- Temporal patterns: chart showing WPM by hour of day, by day of week
- Skill trajectory: "Over the past 7 days, character mastery rose from 18 to 24 of 26 letters"
- Actionable recommendations: template-based for MVP

### Task 3.5: Multi-keyboard switcher
- Header / settings: switch between keyboard profiles
- Stats per profile (independent)
- Visual indicator for the active profile

**Phase 3 milestone**: dashboard is functional. Users can see their progress and understand why the engine picks specific exercises.

---

## Phase 4: Polish & Launch Prep (Estimate: 1.5–2 weeks)

**Goal**: ready to open to beta users.

### Task 4.1: First-session experience
- Special handling for users with zero data
- Default exercise that's well-curated (not random)
- Onboarding tooltip in the typing area
- Encouraging copy

### Task 4.2: Error handling & edge cases
- Network failure during session save (retry + local cache)
- Partial session (user closes browser mid-way)
- Browser refresh during typing
- Multiple tabs

### Task 4.3: Responsive design
- Desktop primary (target audience uses physical keyboards)
- Tablet acceptable
- Mobile: show "use desktop" message (no split keyboards on mobile)

### Task 4.4: Accessibility basics
- Keyboard navigation across all flows
- Screen reader labels (even if audience usage is likely low)
- Color contrast at WCAG AA minimum
- Reduce-motion option (for visual flashes)

### Task 4.5: Documentation page
- "How it works" page explaining the adaptive engine
- "Why split keyboard transition is hard" page
- FAQ
- Privacy policy + ToS (template-based is fine for MVP)

### Task 4.6: Deployment hardening
- Docker compose for the full stack (app + postgres + reverse proxy)
- Nginx/Caddy config with TLS (Let's Encrypt)
- Database backup strategy
- Basic monitoring (uptime, error tracking via Sentry free tier)

### Task 4.7: Beta launch
- Soft launch to the split keyboard community (r/ErgoMechKeyboards, r/ergodox, QMK/ZMK Discord)
- Feedback form
- Track Phase 1 metrics from the product spec

**Phase 4 milestone**: public beta. Ready for feedback from real users.

---

## Phase 5+: Post-MVP (Reactive)

Depends on feedback. Candidates:
- Real Sentence Mode (if users request typing articles/novels)
- Layer Training (if users use layers heavily)
- More keyboards (Corne is most likely the top request)
- Leaderboard (if users want competition)

**Avoid**: don't add features without signal from real users. Keep them in GitHub issues as a backlog.

---

## Tips for Working with Claude Code

A few practical recommendations:

**Per task, prepare context with:**
- File `01-product-spec.md` (to understand the goal)
- File `02-architecture.md` (to understand the structure)
- Specific task description from this document
- Relevant existing files (don't dump the entire codebase)

**Workflow pattern:**
1. Start by writing a test (or executable spec)
2. Have Claude Code implement until tests pass
3. Review the code, request refactors as needed
4. Commit with a descriptive message

**Don't:**
- Tell Claude Code to "build the whole app" (it'll be messy)
- Skip tests for domain logic (regression will be painful)
- Accept code you don't fully understand (you'll become an "AI plumber" without ownership)

**Do:**
- Review every PR/diff like reviewing code from a junior dev
- Push back when you disagree with a decision
- Treat these documents as the source of truth, and update them when things change
