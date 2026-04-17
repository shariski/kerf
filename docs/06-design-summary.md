# Leftype-Rightype: Design Summary

> Consolidation of all design decisions made during brainstorming
> Companion to 04-design-system.md and 05-information-architecture.md
> Status: v0.1 (locked for MVP, iterate as we build)
> Last updated: 2026-04-17

## Purpose of This Document

This is the single source of truth for **what we've decided** about the visual design, page layouts, and interaction patterns across all MVP pages. It references the detailed specs (04, 05) and the HTML wireframes, but serves as the quick reference when implementing.

## Visual Identity (Locked)

- **Vibe**: Mechanical Workshop — deliberate utilitarianism, premium tool aesthetic
- **Reference points**: Linear (precision), Monkeytype (focus), Berkeley Mono (craft)
- **Mode**: Dark only for MVP. Light mode planned V2.
- **Background**: Dark espresso `#181410` (warm near-black, not sterile)
- **Accent**: Amber `#F59E0B` (Tailwind amber-500) — used sparingly
- **Typography**: Inter (UI), JetBrains Mono (typing content + numerical data)
- **Finger colors**: 8-color system, left = earth tones, right = sky tones

Full token list: see `04-design-system.md`.

## Information Architecture (Locked)

7 top-level routes:

```
/                    → Home (lobby for logged-in, landing for visitors)
/login               → Magic link + GitHub + Google OAuth
/onboarding          → 3-step first-time setup
/practice            → Heart of product (adaptive mode default)
/practice/drill      → Drill submode
/dashboard           → Stats, heatmap, weakness ranking, insights
/keyboards           → Profile management
/settings            → Account, preferences, theme, data, danger zone
```

Navigation: top nav bar (48px), auto-hide during active typing on /practice, always visible elsewhere.

Full spec: see `05-information-architecture.md`.

## Page-by-Page Decisions Reference

### `/` Home (Lobby)

**Purpose**: adaptive launching pad — support both quick-start and explore paths.

**Layout**: centered column, max-width 720px.

**Returning user sections** (top to bottom):
1. Greeting ("Ready to practice?" + amber highlight)
2. Active keyboard pill (compact, with switch link)
3. Hero CTA grid: primary "Continue adaptive practice" + secondary "Drill weakness"
4. Last session card (when, WPM, accuracy, time, click → dashboard)
5. Activity strip (30-day grid + streak count)
6. Weakness strip (3 amber pills + context line)

**Zero data state**:
- Welcome greeting with split muscle memory framing
- Keyboard pill (active profile visible)
- Big "Start your first session" CTA with "~3 minutes · baseline capture" meta
- Subtle "Or read how it works first" escape hatch

**Anti-overlap with dashboard**: home is glanceable trailer (scan in 2-5s). Dashboard is full cinema (deep data).

Wireframe: `design/home-wireframe.html`

### `/login`

**Purpose**: single page for both login and register.

**Layout**: centered card, max-width 420px, fullscreen no-nav.

**Sections**:
1. Logo wordmark + tagline ("adaptive typing for split keyboards")
2. Login card:
   - Email input + "Send magic link" primary button
   - Divider ("or continue with")
   - GitHub OAuth button + Google OAuth button
3. Legal footer (Terms + Privacy Policy links)

**Check email state**:
- Envelope icon mark
- "Check your email — sent to **you@example.com**"
- Resend section with 60s cooldown
- Back link ("Use a different email")

**Magic link detection**: single page handles both login (existing user) and register (new user) automatically based on email lookup.

Wireframe: `design/login-wireframe.html`

### `/onboarding`

**Purpose**: capture minimum setup (keyboard, hand, level) with lowest friction.

**Layout**: fullscreen, no nav. Logo + 3-segment progress bar + step counter at top. Back/Continue buttons at bottom.

**Step 1 — Pick keyboard**:
- 2 cards side-by-side (Sofle, Lily58)
- Photo placeholder area (replace with real photos when available)
- **Default: Lily58 selected**
- Meta info: "58 keys · 6×4+X thumbs · split columnar"

**Step 2 — Dominant hand**:
- 2 simple cards (L / R)
- Font-mono letter as icon, large
- **Default: Right selected** (90% of population)

**Step 3 — Self-report level**:
- 3 equal-hierarchy cards
- Each card includes: eyebrow ("level 1/2/3"), name, description, **engine effect** (transparency)
- **Default: Level 1 "First day on split"**

**Landing (post-onboarding)**:
- Return arrow icon
- Message setting baseline expectation
- Setup summary (keyboard, hand, level)
- Big amber CTA + 3s auto-redirect countdown

Wireframe: `design/onboarding-wireframe.html`

### `/practice`

**Purpose**: heart of product. Three distinct states.

**State 1 — Pre-session**:
- Keyboard context indicator (active profile + switch link)
- Primary CTA: "Continue adaptive practice" with engine focus preview
- 3 secondary mode cards: Drill weakness / Warm up / Hand isolation
- Collapsible filters drawer (hand isolation, max length, visual keyboard default)

**State 2 — Active typing**:
- Top nav auto-hidden (Monkeytype-style)
- Session progress bar thin (2px) at top, amber fill
- Typing area dominant center (JetBrains Mono, 30px)
- Visual keyboard below (togglable via `Ctrl+K`)
- Live WPM only in bottom-right corner, minimal
- Shortcut hints in bottom-left (subtle): Esc, Tab+Enter, Ctrl+K

**State 3 — Post-session modal**:
- Modal overlay with backdrop blur
- Summary stats: WPM, accuracy, time (with deltas vs average)
- Weakness shifts section (improvements + new emergent weaknesses)
- Plain-language insight in amber callout
- Actions: primary "Practice again →" (new exercise), secondary "Retry same exercise" / "View dashboard"

**Key decisions**:
- No threshold/gating — completed = session complete
- "Practice again" = new adaptive exercise (default), retry same as secondary
- Visual keyboard default: visible (user can toggle off)
- Stats live during typing: minimal (WPM only)

Wireframe: `design/practice-page-wireframe.html`

### `/practice/drill`

Derivative of `/practice`, skipped separate wireframe. Same layout as practice with:
- Pre-drill screen: "What to drill?" with auto-recommend or manual select grid
- Header label "Drill: [target]" visible during active drill
- Progress shown as reps completion
- Post-drill summary: error rate before/after for specific target

### `/dashboard`

**Purpose**: deep-dive destination for progress & engine transparency.

**Layout**: single scrollable page, max-width 1100px, 6 sections in narrative order.

**Section 1 — Hero stats** ("Where you are now"):
- Featured: Average WPM (42px) with sparkline + trend delta
- Secondary: Accuracy, Mastered (22/26), Streak (12 days)
- All-time data as default

**Section 2 — Activity log** ("Recent activity"):
- 30-day GitHub-style contribution grid
- Latest 5 sessions list (when, mode badge, WPM, accuracy, duration)

**Section 3 — Heatmap** ("Where errors happen"):
- Visual keyboard SVG with per-key error color overlay
- 5-step heat scale (transparent → heat-4)
- Both halves side-by-side

**Section 4 — Weakness ranking** ("Top weaknesses"):
- Table: rank, key/bigram, relative weight bar, error %, avg time, score
- Top 7-10 entries
- "Drill these →" action link

**Section 5 — Skill trajectory**:
- 2 trend cards side-by-side: Speed (WPM), Mastery (%)
- Current value + trend delta vs 30 sessions ago

**Section 6 — Engine insight**:
- Plain-language narrative
- Decision rationale in amber callout
- Formula section always-expanded: equation + component breakdown + current calculation for top weakness

**Footer CTA**: "Ready to keep going?" with context + Start practice button.

Wireframe: `design/dashboard-wireframe.html`

### `/keyboards`

**Purpose**: manage profiles — switch, add, view summary.

**Layout**: responsive card grid (auto-fill, minmax 280px), max-width 1100px.

**Card structure**:
- Photo placeholder area (16:10 aspect ratio)
- Active badge (top-right) if active
- 3-dot menu (top-right, visible on hover)
- Body: keyboard name + meta ("58 keys · split columnar")

**States handled**:
- **Default**: 2+ profiles, one active (highlighted amber border)
- **Single profile**: 1 card + empty-message nudge to add another
- **Switching**: instant switch + undo toast (5s with progress bar)
- **Adding modal**: compact 3-step form with prefilled dominant hand from existing profile

**Interaction**:
- Click card → instant switch (no confirmation)
- Safety net via undo toast bottom-center
- Add modal excludes already-added keyboards

Wireframe: `design/keyboards-wireframe.html`

### `/settings`

**Purpose**: preferences and account management.

**Layout**: two-column (200px sidebar + content), sidebar sticky with anchor links.

**Sidebar sections**:
- Account
- Preferences
- Theme
- Data
- Danger zone (red text)

**Account section**:
- Email (inline edit)
- Display name (inline edit, "not set" muted state)
- Account created (read-only metadata)

**Preferences section**:
- Default practice mode (pill group: Adaptive / Drill / Ask each time)
- Visual keyboard default (pill group: Visible / Hidden)
- Reduce motion (toggle switch)
- Sound effects (disabled, "coming in v2")

**Theme section**:
- 2 theme preview cards: Dark (active), Light (disabled, "v2" badge)
- Previews show actual theme colors

**Data section**:
- Export all data (button → JSON download)
- Reset stats per keyboard profile (granular, one row per profile with danger button)

**Danger zone**:
- Red-tinted container
- Delete account flow: modal → data summary → type "DELETE" → send verification email → 24h grace period

**Inline edit pattern**: click field → amber border + save/cancel buttons appear, other fields stay read-only.

Wireframe: `design/settings-wireframe.html`

## Cross-Page Patterns

### Keyboard Shortcuts (Practice Mode)

- `Esc` — reveal nav / pause session
- `Tab + Enter` — restart current exercise
- `Ctrl + Enter` — end session early
- `Ctrl + Shift + D` — toggle distraction-free mode
- `Ctrl + K` — toggle visual keyboard

### Visual Feedback Timings

- Keypress visual feedback: <100ms (must feel instant)
- Hover states: 150ms ease
- Modal open: 200ms ease
- Page transitions: 300ms max
- Always respect `prefers-reduced-motion`

### Auto-Hide Behaviors

- Practice nav: hides 1s after typing starts, reveals on mouse-near-top/Esc/pause
- Toast notifications: 5s auto-dismiss with progress bar
- Onboarding landing: 3s auto-redirect to /practice

### Amber Accent Usage Rules

Amber is used for:
- Primary action buttons
- Active states (selection, current page, target key)
- Brand moments (logo accent)
- Highlighted metrics (WPM prominent display)
- Currently-in-focus weakness pills

Amber is NOT used for:
- Decorative fills
- Secondary text
- Generic borders
- Success states (green instead)
- Error states (red instead)

## Open Iteration Topics

These are acknowledged but not yet locked — likely to need attention during implementation:

1. **Photo sourcing for keyboards**: consistent style needed. Either self-photographed or sourced with permission.
2. **Empty state for dashboard**: user with zero data — layout is unclear.
3. **Email verification flow on email change**: wireframe shows inline edit, but real flow is more complex.
4. **Gamification balance**: streak counter + mastered metric (22/26) feel on-vibe but monitor for Duolingo-drift.
5. **First-session experience at /practice**: after onboarding auto-redirect, initial exercise needs careful curation.
6. **Responsive behavior**: desktop primary, tablet acceptable, mobile shows "use desktop" message. Needs final touches per page.
7. **Keyboard shortcut conflicts**: `Ctrl+K` is common (command palette in many apps). Verify no browser conflict.

## Wireframe Files

All wireframes are interactive HTML in `design/` folder:

- `design-specimen.html` — design tokens specimen
- `ia-sitemap.html` — IA visualization (sitemap, flows, navigation)
- `home-wireframe.html` — home/lobby, 2 states
- `login-wireframe.html` — login page, 2 states
- `onboarding-wireframe.html` — onboarding, 4 states
- `practice-page-wireframe.html` — practice page, 3 states
- `dashboard-wireframe.html` — dashboard, single state
- `keyboards-wireframe.html` — keyboards, 4 states
- `settings-wireframe.html` — settings, 3 states
- `background-comparison.html` — dark warmth comparison (historical reference)

Navigate all wireframes via `design/index.html`.
