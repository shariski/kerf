# kerf: Information Architecture

> Companion to 01-product-spec.md, 02-architecture.md, 04-design-system.md
> Status: v0.1 (initial, expect iteration)
> Last updated: 2026-04-17

## 1. Mental Model

The product surfaces four core "nouns" to users:

1. **Keyboard Profile** - the user's physical device (Sofle/Lily58 with finger assignments)
2. **Session** - one practice instance (start, type, end, summary)
3. **Stats** - accumulated data across sessions (per character, per bigram, trends)
4. **Insight** - interpretation derived from stats (weakness ranking, decision rationale, recommendations)

**Relationships:**

- A user has 1+ Keyboard Profiles (multi-keyboard support)
- Each Keyboard Profile has its own independent stats
- Each Session is bound to 1 Keyboard Profile and produces keystroke events that feed Stats
- Insights are derived from Stats

**Surfaced mental model**: "Each keyboard is a separate journey." Switching from Sofle to Lily58 means moving to a different journey - stats are independent, weakness ranking resets, progress charts restart. This is technically accurate (muscle memory differs per keyboard) and honest to the user.

## 2. Audience Behavior Assumptions

Based on conversations with the target user (split keyboard transitioner), we assume:

- Usage pattern is **variable** - sometimes deep practice, sometimes sporadic micro-sessions
- Landing intent is **mood-dependent** - sometimes user wants to start typing immediately, sometimes wants to explore progress first
- Preferred warm-up flow: standard exercise first, then weakness-focused

**IA design principle from these assumptions**: support both quick-start and explore paths from the home page, with no forced funnel.

## 3. Sitemap

### Top-Level Routes

```
PUBLIC ROUTES
/                          → Landing page (visitors not logged in)
/login                     → Login / register

AUTHENTICATED ROUTES
/                          → Home (lobby with quick start + summary cards)
/onboarding                → First-time keyboard profile setup
/practice                  → Practice page (default mode: adaptive)
/practice/drill            → Drill submode (focused weakness attack)
/dashboard                 → Detailed stats, heatmap, weakness ranking, insights
/keyboards                 → Keyboard profile management (switch, add)
/settings                  → Account & preferences
```

**Total: 7 top-level routes** (kept intentionally minimal for MVP).

### Excluded Routes (and Rationale)

- `/profile` - merged into `/settings`
- `/insights` - merged into `/dashboard` (insight is a dashboard section)
- `/sessions/history` - no strong MVP use case, defer to V2
- `/help`, `/docs`, `/about` - footer links only, not in primary navigation

## 4. Page-Level Specifications

### 4.1 `/` (Home / Lobby)

**Purpose**: Adaptive landing - quick start for users who want to type immediately, glanceable insight for users who want to check progress.

**This is NOT a dashboard.** It's a lobby that surfaces enough context to motivate the next action.

**Hierarchy (top to bottom):**

1. **Hero CTA section**: Primary button "Start practice" (amber, prominent) + secondary "Drill weakness". This honors the quick-start path.
2. **Active keyboard indicator**: Small visual showing the currently active keyboard profile (Sofle/Lily58) with a subtle "switch" affordance.
3. **Last session summary** (if exists): Compact card showing WPM, accuracy, top weakness from the most recent session. Click → navigate to `/dashboard`.
4. **Streak / activity**: Simple 7-30 day visualization (GitHub-style contribution graph). Non-intrusive but shows consistency.
5. **Top 3 weaknesses preview**: Brief peek at weakness ranking. Click → navigate to `/dashboard`.

**What's NOT here:**

- Full charts (those live on `/dashboard`)
- Full weakness list (those live on `/dashboard`)
- Formula explanations or transparency panels
- Detailed session history

### 4.2 `/practice` (Practice Page - Heart of the Product)

**Purpose**: Deliver typing experience with minimum chrome and maximum focus.

**Pre-session state** (when user lands fresh):

Brief intermediate screen offering:

- "Continue adaptive practice" (default, large CTA)
- "Switch to drill mode"
- "Start with warm-up" (gentle exercise before adaptive engages, honors the warm-up preference)
- Filter adjustments (hand isolation, max length) - collapsed by default

**Active session state**:

Layout:

- **Top bar**: Auto-hidden (Monkeytype-style). Hidden during active typing. Reveals on:
  - Mouse hover near top of viewport
  - Keyboard shortcut (Esc)
  - Session pause
- **When visible**, top bar shows: keyboard profile indicator (left), session timer + progress (center), settings/exit (right)
- **Main typing area**: typing text (dominant, center), visual keyboard SVG below
- **Live stats**: Small WPM/accuracy/time display in a corner, low-emphasis (does not compete with typing area)
- **Filters**: collapsible drawer, default closed

**Keyboard shortcuts** (during practice):

- `Esc` - reveal nav / pause session
- `Tab + Enter` - restart current exercise
- `Ctrl + Enter` - end session early
- `Ctrl + Shift + D` - toggle distraction-free mode (also hides stats)

**Post-session state**:

Auto-shown summary view (modal or inline, TBD):

- WPM, accuracy, time
- Top 3 weaknesses (before vs after this session)
- Plain-language insight
- CTAs: "Practice again" / "View dashboard" / "Take a break"

### 4.3 `/practice/drill` (Drill Submode)

**Purpose**: Targeted attack on a specific weakness.

**Pre-drill screen**:

- Question: "What to drill?"
- Two options:
  - **Auto-recommend** (default): engine selects top weakness
  - **Manual select**: grid of characters/bigrams the user can pick from (recently struggled units highlighted)
- Show estimated drill duration (e.g., "About 2-3 minutes")

**Active drill state**: same layout as `/practice` but with:

- Header label: "Drill: [target unit]" prominent
- Progress shown as drill completion (e.g., "12 of 30 reps")

**Post-drill state**: similar to practice summary but specific to the drilled target:

- Error rate before vs after (this drill only)
- Suggestion: "Run again" / "Move to adaptive practice"

### 4.4 `/dashboard` (Detailed Insight)

**Purpose**: Deep-dive destination for progress and engine transparency.

**This is a separate destination from `/`** - reaching `/dashboard` is an intentional act of "I want to look closely."

**Layout**: scrollable single page, NOT tabs. Encourages exploration.

**Sections (top to bottom):**

1. **Hero stats panel**: All-time WPM, current WPM trend (sparkline), accuracy, total sessions. Big numbers, hero treatment.

2. **Visual keyboard heatmap**: SVG of the active keyboard with per-key error rate as color overlay (using the `--kerf-heat-*` ramp from design system). Powerful for visual learners.

3. **Top weaknesses ranking**: Full top 10 list with score breakdown. Each row shows:
   - Rank, key/bigram, error rate, mean time, weakness score
   - Visual bar showing score relative to others
   - Collapsible "How is this calculated?" section showing the formula and component values

4. **Trend charts**: WPM over time (line chart), accuracy over time, character mastery curve (how many characters meet "mastered" threshold over time).

5. **Weekly insight**: Text-heavy section with plain-language analysis. Patterns like "You practice most consistently on weekday afternoons" or "Your accuracy on bigram 'er' improved 40% this week."

6. **Decision rationale**: Plain text explanation of what the next exercise will emphasize and why. Example: "Next exercise will emphasize: B (score 2.8), er (score 2.1), T (score 1.7). These represent 60% of your high-friction units this week."

7. **Per-keyboard tabs** (if user has multiple profiles): switcher at top of page to view stats for different profiles. Each profile is independent.

### 4.5 `/keyboards` (Keyboard Profile Management)

**Purpose**: Manage profiles - switch between, add new, view per-keyboard summary.

**Layout**: list/grid of profile cards. Each card shows:

- Keyboard name (Sofle / Lily58)
- Visual mini-render of the keyboard
- Quick stats (sessions logged, current WPM, time on this keyboard)
- "Active" badge if currently active
- Click anywhere on card → switch active profile (with confirmation)
- Click "View dashboard" → go to `/dashboard` filtered to this profile

Top of page: **"Add new keyboard profile"** CTA → opens onboarding flow with skip if user already exists.

### 4.6 `/onboarding` (First-Time Setup)

**Purpose**: Capture minimum required info with lowest friction.

**Flow**: Linear, 3 steps, no skip allowed.

1. **Step 1: Pick keyboard**. Visual cards for Sofle and Lily58 with images. Click to select.
2. **Step 2: Pick dominant hand**. Two simple cards (left / right).
3. **Step 3: Self-report level**. Three cards:
   - "First day on split" - new to columnar, just started
   - "Few weeks in" - getting accustomed
   - "Comfortable but want refinement" - already proficient, tuning

After step 3: redirect to `/practice` with a curated first-session exercise (not random adaptive output, since stats are zero).

**No top nav during onboarding.** Just progress indicator (1/3, 2/3, 3/3) and Back/Next buttons.

### 4.7 `/settings`

**Purpose**: Catch-all for preferences not fitting elsewhere.

**Sections** (anchored, scrollable):

1. **Account**: email, display name, password / re-auth
2. **Preferences**:
   - Default mode when entering practice (adaptive / drill / ask each time)
   - Reduce motion (accessibility)
   - Sound effects (V2)
3. **Theme**: dark only in MVP, light mode placeholder for V2
4. **Data**: export all data (JSON), reset stats (per profile, with strong confirmation)
5. **Danger zone**: delete account (with strong confirmation, email verification)

## 5. Navigation Pattern

### Top Navigation Bar

**Layout**:

```
[wordmark]  Practice  Dashboard  Keyboards          [⚙ settings] [👤 user menu]
```

**Visual specifications**:

- Height: 48px
- Background: `--kerf-bg-base` with optional 1px `--kerf-border-subtle` bottom border
- Logo (left): wordmark, 18px, JetBrains Mono, click → `/`
- Primary nav (center-left): Practice, Dashboard, Keyboards. Active page indicated by amber underline (1px, `--kerf-amber-base`).
- Right cluster: settings icon (gear, 16px) + user menu (initials avatar, 24px circle)

**Behavior on `/practice`** (Monkeytype-style):

- During pre-session and post-session: nav visible normally
- During active typing: nav auto-hides after 1 second of typing activity
- Reveals on:
  - Mouse moves to top 60px of viewport
  - Esc key pressed
  - Session pause (e.g., user stops typing for 3+ seconds)
- Smooth fade-in/out (150ms, `--kerf-ease-default`)

**Behavior on other pages**: always visible, sticky to top.

### Why Top Nav, Not Sidebar?

- Top nav is more familiar to the developer-leaning audience (Linear, Vercel, GitHub all use top nav for primary)
- Sidebar would steal horizontal space critical for typing area on `/practice`
- 7 top-level routes fit comfortably in top nav; sidebar would be over-engineered
- Easier to auto-hide cleanly than sidebar (sidebar collapse is a different UX problem)

### Breadcrumbs

**Not in MVP.** Hierarchy is not deep enough to warrant breadcrumbs. If needed in V2 (e.g., when keyboard profile becomes a deep navigation context), add then.

### User Menu

Click on initials avatar opens dropdown:

- Display name + email (read-only, top of menu)
- Active keyboard profile (with mini icon, click → `/keyboards`)
- Settings → `/settings`
- Sign out

## 6. Critical User Flows

### Flow 1: First-Time User

```
/ (landing for visitor)
  → "Get started" CTA
/login (register form, magic link option)
  → email magic link sent → user clicks link in email
/onboarding step 1 (pick keyboard)
  → next
/onboarding step 2 (dominant hand)
  → next
/onboarding step 3 (self-report level)
  → next
/practice (auto-start with curated first exercise)
```

**Time to first keystroke target**: under 60 seconds from landing page.

### Flow 2: Returning User - Quick Practice

```
/ (auto-redirect from landing if logged in cookie)
  = home with prominent "Start practice" CTA
  → click CTA
/practice (pre-session screen)
  → "Continue adaptive practice" (default, focused button)
/practice (active session)
  → user types for 5-10 minutes
/practice (auto-shown post-session summary)
  → "Practice again" or "Take a break"
```

**Time to first keystroke target**: under 5 seconds from home.

### Flow 3: Returning User - Check Progress

```
/ (home)
  → notice "last session" card or weakness preview
  → click "View dashboard"
/dashboard
  → scroll: hero stats → heatmap → weaknesses → trends → insights
  → optional: click "Start practice" CTA in dashboard footer
/practice (pre-session)
  ...
```

### Flow 4: Switch Keyboard Profile

```
[any page]
  → click user menu (avatar)
  → click active keyboard profile in dropdown
/keyboards
  → click target profile card
  → confirmation modal: "Switch to [profile]? Your active practice stats will reflect this profile."
  → confirm
  → redirect back to source page (or to /practice if from / or /dashboard)
```

## 7. Open Questions / TBD

These are deliberate deferrals, not oversights:

1. **Modal vs full-page for post-session summary**: Modal feels lighter but may hide CTAs. Full page is heavier but more deliberate. Defer to UI design phase.
2. **Onboarding skip / default profile**: Should we let returning users skip onboarding? For MVP, no - every new user goes through it.
3. **Session pause/resume across browser sessions**: If user closes tab mid-session, do we restore? Defer to error handling phase.
4. **Multi-tab handling**: If user opens `/practice` in two tabs, what happens? Probably warn and disable second tab.
5. **Empty state for `/dashboard` (zero data user)**: What does dashboard look like before any session? Defer to UI phase - probably teaser of what data will populate.

## 8. IA Validation Checklist

Before considering this IA "good enough" for MVP, verify:

- [ ] User can reach typing within 5 seconds from authenticated home
- [ ] User can switch keyboard profiles within 3 clicks from any page
- [ ] User can find their top weakness within 2 clicks from home
- [ ] User can export their data without contacting support (settings)
- [ ] User can delete account without contacting support (settings, with safeguards)
- [ ] No critical action is buried more than 2 levels deep in nav
- [ ] Every "primary" route is reachable from every other primary route in 1 click (via top nav)
