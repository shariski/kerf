# kerf: Design Summary

> Consolidation of all design decisions made during brainstorming
> Companion to 04-design-system.md and 05-information-architecture.md
> Status: v0.2 (transition-focused revision)
> Last updated: 2026-04-18

## Purpose of This Document

This is the single source of truth for **what we've decided** about the visual design, page layouts, and interaction patterns across all MVP pages. It references the detailed specs (04, 05) and the HTML wireframes, but serves as the quick reference when implementing.

## Positioning (Revised)

**From**: "Adaptive typing platform for split keyboards"
**To**: "Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first."

This shift acknowledges that split keyboard adoption is a distinct learning journey, not a generic typing improvement use case. See 01-product-spec.md §1 for full positioning.

**Phase A vs Phase B**: MVP is deliberately split. Phase A ships transition-aware adaptive engine + split-specific metrics (8-12 weeks). Phase B (curriculum) gated on Phase A beta validation. See 01-product-spec.md §5 and 03-task-breakdown.md.

## Core Values (Product Principles)

These are decision criteria, not marketing fluff. Every product choice should be checkable against these:

1. **Accuracy over speed, always** — session reports lead with accuracy, no speed leaderboards, speed-at-accuracy-cost framed as regression
2. **Deliberate practice, not addictive practice** — no streak-break anxiety, no artificial urgency, platform encourages breaks when fatigue shows
3. **Transition is the primary journey** — first weeks weighted toward columnar pain points (B, G, H, N, T, Y, thumb clusters, cross-hand bigrams); refinement phase is a later stage
4. **Transparent engine, no black box** — formula, decision rationale, current values always visible

See 01-product-spec.md §2 for full expansion.

## Visual Identity (Locked)

- **Vibe**: Mechanical Workshop — deliberate utilitarianism, premium tool aesthetic
- **Reference points**: Linear (precision), Monkeytype (focus), Berkeley Mono (craft)
- **Mode**: Dark only for MVP. Light mode planned V2.
- **Background**: Dark espresso `#181410` (warm near-black, not sterile)
- **Accent**: Amber `#F59E0B` (Tailwind amber-500) — used sparingly
- **Typography**: Inter (UI), JetBrains Mono (typing content + numerical data)
- **Finger colors**: 8-color system, left = earth tones, right = sky tones
- **Keyboard visuals**: hand-authored SVG by design tooling (not photos) — see `design/keyboard-svg-preview.html`

Full token list: see `04-design-system.md`.

## Information Architecture (Locked)

7 top-level routes:

```
/                    → Home (lobby for logged-in, landing for visitors)
/login               → Magic link + GitHub + Google OAuth
/onboarding          → 3-step first-time setup
/practice            → Heart of product (adaptive mode default)
/practice/drill      → Drill submode (with preset modes: inner column, thumb cluster, cross-hand bigrams)
/dashboard           → Stats, heatmap, weakness ranking, insights, split-specific metrics
/keyboards           → Profile management
/settings            → Account, preferences, theme, data, danger zone
```

Navigation: top nav bar (48px), auto-hide during active typing on /practice, always visible elsewhere.

Full spec: see `05-information-architecture.md`.

## Transition-Aware Behavior (NEW in v0.2)

Every page that shows engine-derived content adapts behavior based on user's `transition_phase`:

### Pre-session (/practice)

- Phase badge visible (transitioning / refining)
- CTA meta references transition-relevant weaknesses (e.g., "columnar focus: B, N, T")
- Mode cards include "Inner column" preset drill for transitioners

### Dashboard (/dashboard)

- Split-specific metrics (inner column error rate, thumb cluster time, cross-hand bigram timing, columnar stability) as primary hero stats
- Weakness ranking weighted by phase (transitioning gives inner-column bonus)
- Formula section shows current phase coefficients with visual distinction
- Phase transition suggestion banner when thresholds crossed (non-intrusive, dismissible)

### Post-session (/practice inline)

- **Accuracy featured first** in stat hierarchy (not speed)
- **Error review section** with hover tooltips and pattern analysis
- Insight copy phase-aware (transitioning: "building muscle memory" framing; refining: "polishing flow" framing)
- Recommended next drill is context-aware (e.g., "Drill B specifically" after B-N confusion session)

### Copy Guidelines (accuracy-first)

Every copy string honors:

- Lead with accuracy, not speed
- Speed-up-with-accuracy-drop is framed as concern, not win
- No hyped language ("amazing!", "crushing it!", etc.)
- Quiet affirmation tone, not cheerleading
- Platform honestly reports when user hasn't improved

See 01-product-spec.md §6.2 for full guidelines.

## Page-by-Page Decisions Reference

### `/` Home (Lobby)

**Purpose**: adaptive launching pad — support both quick-start and explore paths.

**Layout**: centered column, max-width 720px.

**Returning user sections** (top to bottom):

1. Greeting
2. Active keyboard pill + phase badge
3. Hero CTA grid: primary "Continue adaptive practice" + secondary "Drill weakness"
4. Last session card (when, WPM, accuracy, time, click → dashboard)
5. Activity strip (30-day grid + streak count)
6. Weakness strip (3 amber pills + context line)

**Zero data state**:

- Welcome with split muscle memory framing
- Keyboard pill (active profile visible)
- Big "Start your first session" CTA with baseline capture meta
- Subtle "Or read how it works first" escape hatch

Wireframe: `design/home-wireframe.html`

### `/login`

**Purpose**: single page for both login and register.

**Layout**: centered card, max-width 420px, fullscreen no-nav.

**Sections**:

1. Logo wordmark + tagline
2. Login card: email + magic link + OAuth (GitHub, Google)
3. Legal footer

**Check email state**: confirmation with 60s resend cooldown, back link.

**Single page detection**: magic link handles both existing-user login and new-user register automatically.

Wireframe: `design/login-wireframe.html`

### `/onboarding`

**Purpose**: capture minimum setup with lowest friction.

**Layout**: fullscreen, no nav. Logo + 3-segment progress + step counter. Back/Continue buttons.

**Step 1 — Keyboard**: 2 cards (Sofle, Lily58) with SVG previews. Default: Lily58.
**Step 2 — Dominant hand**: 2 cards (L / R). Default: Right.
**Step 3 — Self-report level**: 3 equal cards (first day / few weeks / comfortable). Each includes engine effect text. Default: Level 1.

**Maps to transition_phase**: first_day + few_weeks → `transitioning`; comfortable → `refining`.

**Landing**: return arrow icon, setup summary, 3s auto-redirect to `/practice` with curated first-session exercise.

Wireframe: `design/onboarding-wireframe.html`

### `/practice`

**Purpose**: heart of product. Three distinct states + pause overlay.

**State 1 — Pre-session**:

- Keyboard context + phase badge
- Primary CTA with columnar-aware engine preview
- 3 mode cards: Drill weakness / Inner column / Warm up
- Collapsible filters (hand isolation, max length, visual keyboard)

**State 2 — Active typing**:

- Nav auto-hidden (Monkeytype-style)
- Session progress bar at top (amber fill, 2px)
- Typing area 36px font, line-height 2.0, dominant element
- **Error visualization**: red underlined character with amber badge above showing expected character (Typerfast pattern)
- SVG keyboard below (Sofle or Lily58 based on active profile) with finger color bars on left edges
- Live WPM bottom-right, shortcut hints bottom-left

**State 3 — Paused (NEW)**:

- Triggered by Esc
- Semi-opaque backdrop blur overlay
- Inline settings: typing text size (S/M/L/XL), visual keyboard visibility, expected-letter hint toggle
- Actions: Resume, Restart exercise, End session
- Copy: "Take a breath. Accuracy improves when you slow down."

**State 4 — Post-session (INLINE, not modal)**:

- Complete badge + title (context-aware based on accuracy/speed outcome)
- **Stats: accuracy FIRST (featured), speed second, time third** — ordering reflects value
- **Error review section**: full exercise text with error chars highlighted, hover tooltip, pattern analysis below
- Weakness shifts (improved + emergent)
- Insight callout (amber, plain-language)
- Actions: Practice again / Drill [specific weakness] / View dashboard

**Key decisions**:

- No modals in practice flow (inline transitions only)
- Settings accessible during pause, NOT during active typing
- Expected-letter hint is toggleable (default on)

Wireframe: `design/practice-page-wireframe.html` (v0.3)

### `/practice/drill`

Derivative of `/practice`. Same layout with:

- Pre-drill screen: "What to drill?" — auto-recommend, manual select, or preset mode (inner column / thumb cluster / cross-hand bigrams)
- Same active typing and post-session patterns

### `/dashboard`

**Purpose**: deep-dive destination for progress & engine transparency.

**Layout**: single scrollable page, max-width 1100px, 6 sections in narrative order.

**Section 1 — Hero stats**: accuracy + split-specific metrics (inner column error, thumb time, cross-hand bigram, columnar stability) — NOT generic WPM primary
**Section 2 — Activity log**: 30-day grid + latest 5 sessions
**Section 3 — Heatmap**: visual keyboard with per-key error overlay
**Section 4 — Weakness ranking**: top 7-10, phase-aware scoring
**Section 5 — Skill trajectory**: 2 trend cards (speed + mastery)
**Section 6 — Engine insight**: plain-language + decision rationale + always-expanded formula with current phase coefficients

**New in v0.2**:

- Split-specific metrics section with accuracy caveats for columnar stability
- Phase transition suggestion banner (top, dismissible)
- Phase indicator in header

Wireframe: `design/dashboard-wireframe.html`

### `/keyboards`

**Purpose**: manage profiles — switch, add, view summary.

**Layout**: responsive card grid (auto-fill, minmax 280px), max-width 1100px.

**Card structure**: SVG keyboard preview + active badge (if active) + 3-dot menu (hover) + name + meta

**States**: default (2+ profiles), single (1 + empty nudge), switching (instant + undo toast), adding (modal, prefilled)

**Interaction**: click card → instant switch + 5s undo toast.

**New in v0.2**: each profile has independent `transition_phase` — user could be transitioning on new keyboard while refining on older one.

Wireframe: `design/keyboards-wireframe.html`

### `/settings`

**Purpose**: account & preferences.

**Layout**: two-column (sticky sidebar 200px + content), max-width 1100px.

**Sections**: Account, Preferences, Theme, Data, Danger zone.

**Account**: email (inline edit), display name (inline edit), account created (read-only)
**Preferences**: default practice mode, visual keyboard default, reduce motion, sound effects (v2 disabled), **transition phase** (manual override of auto-detected phase)
**Theme**: dark (active), light (v2 disabled)
**Data**: export all (JSON), reset stats per keyboard
**Danger zone**: delete account (type DELETE + email verification + 24h grace)

Wireframe: `design/settings-wireframe.html`

## Cross-Page Patterns

### Keyboard Shortcuts

**Global**:

- `Esc` — pause session (in /practice) / close modal (elsewhere)
- `⌘D` / `Ctrl+D` — navigate to dashboard

**Practice Mode**:

- `Esc` — pause + reveal settings
- `Tab + Enter` — restart current exercise
- `Ctrl + Enter` — end session early
- `Ctrl + Shift + D` — toggle distraction-free mode

**Post-session** (new in v0.2.1, vim-kiblat):

- `j` — scroll down
- `k` — scroll up
- `Enter` — practice again (primary action)
- `D` — drill specific weakness (context-aware secondary)
- `⌘D` / `Ctrl+D` — view dashboard

Guard rules for post-session `j`/`k`: ignore when input/textarea focused, ignore when modifier key pressed (prevents conflict with `⌘D`), only active while post-session stage is rendered.

### Visual Feedback Timings

- Keypress visual feedback: <100ms (must feel instant)
- Hover states: 150ms ease
- State transitions: 200-300ms ease
- Expected-character badge fade-in: 150ms
- Always respect `prefers-reduced-motion`

### Amber Accent Usage Rules

Amber is used for:

- Primary action buttons
- Active states (selection, current page, target key)
- Brand moments (logo accent)
- Highlighted metrics (accuracy featured stat)
- Currently-in-focus weakness pills
- Expected-character hint badges during error visualization

Amber is NOT used for:

- Decorative fills
- Secondary text
- Generic borders
- Success states (green instead)
- Error states (red instead)

### Error Visualization Rules

During active typing:

- Wrong character: red fill, red underline
- **Expected character**: small amber badge above typed character with arrow pointer
- Cursor stays at position (user must backspace)
- No audio feedback

Post-session:

- Full text with error positions highlighted red
- Hover shows "typed X, expected Y"
- Pattern analysis paragraph below (template-based from Task 1.5)

## Open Iteration Topics

Not yet locked, likely to surface during implementation:

1. **Copy audit ongoing**: accuracy-first guidelines applied in wireframes but need review with every new string generated during implementation
2. **Split-specific metrics accuracy**: columnar stability is inferred, not measured — needs real-user validation on whether the heuristic holds
3. **Phase transition thresholds**: 95% accuracy, 8% inner column error, 10 sessions — all arbitrary, tune based on real data
4. **Weakness score coefficients**: phase-aware coefficients (ALPHA/BETA/GAMMA/DELTA) are educated guesses — needs tuning
5. **Error review pattern analysis**: template-based for MVP, quality depends on pattern detection logic
6. **Expected-character hint overlap**: when multiple errors close together, badges might overlap — needs real-world testing
7. **36px typing font**: might feel too large on 13" laptop screens — user-adjustable as workaround, but default may need tweak
8. **Phase B scope**: structured curriculum content still undefined, committed only after Phase A beta
9. **Vim-kiblat keyboard shortcuts principle** (NEW, unresolved): user wants strong keyboard-first navigation throughout platform with vim/neovim-inspired bindings. First applied: `j`/`k` scroll down/up in post-session (practice wireframe v0.4). Full principle still to be defined — candidates include: `gg`/`G` for scroll to top/bottom, `h`/`l` where horizontal navigation applies, `/` for search, `?` for help overlay showing all shortcuts, `:` for command palette. Needs dedicated design session to define complete system before expanding beyond post-session.

## Wireframe Files

All wireframes are interactive HTML in `design/` folder:

- `design-specimen.html` — design tokens specimen
- `ia-sitemap.html` — IA visualization (sitemap, flows, navigation)
- `keyboard-svg-preview.html` — generated SVG keyboards (Sofle + Lily58) preview
- `home-wireframe.html` — home/lobby, 2 states
- `login-wireframe.html` — login page, 2 states
- `onboarding-wireframe.html` — onboarding, 4 states
- `practice-page-wireframe.html` — practice page, 4 states (pre / active / paused / post) — **v0.3**
- `dashboard-wireframe.html` — dashboard, single scrollable page
- `keyboards-wireframe.html` — keyboards, 4 states
- `settings-wireframe.html` — settings, 3 states
- `background-comparison.html` — dark warmth comparison (historical reference)

Navigate all wireframes via `design/index.html`.

## Revision History

**v0.2.1 (2026-04-18)** — vim scroll shortcut increment

- `j`/`k` scroll down/up shortcuts added to post-session only (practice wireframe v0.4)
- Visible hint strip at bottom of viewport during post-session
- Broader vim-kiblat shortcut principle logged as open iteration topic for future session

**v0.2 (2026-04-18)** — transition-focused pivot

- Positioning rewrite: transition program vs generic adaptive
- Core values section added (01-product-spec.md §2)
- Phase A / Phase B split with validation gate
- Transition-aware adaptive engine (phase-aware coefficients)
- Split-specific metrics (4 new metrics)
- Error visualization pattern (expected character above)
- Post-session error review with pattern analysis
- Post-session inline transition (no modal)
- Paused state with inline settings
- SVG keyboards generated (Sofle + Lily58) replacing photo placeholders
- Accuracy-first copy guidelines codified

**v0.1 (2026-04-17)** — initial consolidation

- 7 page wireframes + design system + IA
- Word-picker content strategy for MVP
- Dark espresso background + amber accent locked
