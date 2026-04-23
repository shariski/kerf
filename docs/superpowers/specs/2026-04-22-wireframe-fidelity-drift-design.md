# Wireframe-fidelity drift-fix — Design

**Status:** draft → pending user review
**Target PR branch:** `fix/wireframe-fidelity-drift` (off `main`)
**Scope:** six concrete drift items identified in an audit against `design/*-wireframe.html`. Spec-driven deliberate deviations (accuracy-first stat order, phase suggestion banner, vim scroll footer, drill "coming soon" badge) are out of scope — not drift, intentional.

## Why

A before-Task-4.3 audit of implemented routes against `design/home-wireframe.html`,
`design/practice-page-wireframe.html`, `design/dashboard-wireframe.html`, and
`design/keyboards-wireframe.html` surfaced six visual/affordance gaps where the
implementation diverged from the wireframe without a spec-level justification.
Fixing these first keeps Task 4.3 (responsive) focused on viewport-size
concerns and lands a clean 1:1 baseline before that next layer.

## Drift items in scope

| # | Page | Drift | Kind |
|---|------|-------|------|
| 1 | `/` (home) | Active-keyboard pill missing trailing `switch →` affordance | affordance |
| 2 | `/` (home) | Primary CTA keycap missing `↵ enter` text | affordance |
| 3 | `/practice` pre-session | Hero left-aligned with pill + badge at opposite corners; wireframe centers the row and title | layout |
| 4 | `/practice` pre-session | Active-keyboard pill missing `switch →` affordance | affordance |
| 5 | `/practice` pre-session | Phase badge is lowercase `transitioning`; wireframe uses UPPERCASE | typography |
| 6 | `/dashboard` | Missing top-right `viewing {layout} ▼` keyboard-switcher pill with dropdown | component |

## Non-drift (explicitly kept as-is)

- Dashboard stat order leads with accuracy (per `CLAUDE.md §B3` + Task 3.2a) — wireframe leads with WPM; **spec wins**.
- Phase-suggestion banner above dashboard (Task 3.4a).
- Vim scroll-shortcut footer on dashboard (later polish).
- `coming soon` badge on `Warm up` mode card.

## Design

### Shared copy / naming decision

Both home and practice wireframes use the pattern `active {layoutSlug} switch →`
(home wireframe showed `active keyboard lily58` in one variant, but per
user decision `2026-04-22` we unify on the shorter `active {layoutSlug} switch →`
form — less text density, matches the "quiet mentor" tone in §B3).

### New components

Directory: `src/components/keyboard/`.

#### `<ActiveKeyboardPill>` (items 1, 4)

```
⌨ active {layoutSlug}  switch →
```

- Props: `{ layoutSlug: string }`
- `switch →` is a `<Link to="/keyboards">` styled as an inline tertiary link
- Used on `/` and `/practice` pre-session
- No dropdown — pill is inline, tells the user which keyboard is active and routes them to the switcher page

#### `<KeyboardSwitcherPill>` (item 6)

```
⌨ viewing {displayName} ▼
```

- Props: `{ profiles: KeyboardProfile[]; activeProfileId: string }`
- Dropdown menu on click, containing:
  - Profile list — one row per profile; active profile is highlighted as `● current` and non-interactive
  - Horizontal divider
  - `Manage all →` — `<Link to="/keyboards">` at the bottom
- Selecting an inactive profile → calls existing `switchActiveProfile` server fn (from Task 3.5) → on success, invalidates the router cache so the dashboard refetches with the new active profile
- Keyboard: **Esc** closes; **↑ / ↓** moves focus within menu items; **Enter** activates; click-outside closes; focus returns to trigger on close
- Positioned top-right of the dashboard hero heading row (align-baseline with `Dashboard` h1)
- Dashboard-only — home and practice do **not** get the dropdown (wireframes don't show one there; staying scoped)

### Route changes

- `src/routes/index.tsx`
  - Replace the current inline keyboard pill markup with `<ActiveKeyboardPill>`
  - Primary CTA ("Continue adaptive practice" / "Start first session") — inside the existing amber keycap pill, add the text `↵ enter` next to the icon
- `src/routes/practice.tsx`
  - Replace inline pill with `<ActiveKeyboardPill>`
  - Wrap pill + `<PhaseBadge>` in a single flex row, centered
  - Center the title ("What will you practice?") and subtitle ("Accuracy first. Speed follows.")
- `src/routes/dashboard.tsx`
  - Import `<KeyboardSwitcherPill>`; place in a flex-between row alongside the existing `YOUR PROGRESS / Dashboard` heading block
  - Route loader already selects the active profile — extend it (if needed) to also select the user's other profiles for the dropdown. Use existing Drizzle query patterns.

### CSS

In `src/styles.css`, adjust `.kerf-phase-badge`:

```css
.kerf-phase-badge {
  /* existing rules … */
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
```

This affects all uses of `<PhaseBadge>` — `/practice` pre-session, `/practice/drill` pre-session, and the dashboard `<EngineInsight>` section. Uppercase treatment is appropriate in all three contexts (it's a small label badge).

### Server / data layer

- Reuse `switchActiveProfile` from Task 3.5. No new server fns needed.
- Dashboard route loader: ensure it returns `profiles` (all) alongside the currently-loaded active profile and stats. If the loader doesn't already, add one Drizzle select in the same server fn.

### Routing / navigation

- `<ActiveKeyboardPill switch →>` → `router.navigate` or `<Link>` to `/keyboards`
- `<KeyboardSwitcherPill> Manage all →` → same target

## Testing

**Automated:**
- Unit test for `<KeyboardSwitcherPill>` keyboard navigation:
  - Esc closes
  - ↑ / ↓ cycles focus
  - Enter on inactive profile calls mocked `switchActiveProfile`
  - Focus returns to trigger after close
- Unit test asserting `<ActiveKeyboardPill>` renders `switch →` as a link to `/keyboards`
- Existing `PreSessionStage.test.tsx` should still pass after the centering change; update any queries that depend on old DOM order if needed.

**Manual / Playwright:**
- Screenshot `/`, `/practice`, `/dashboard` at 1280×800 after the changes and visually compare with `design/*.html` equivalents
- Switch profile via the dashboard dropdown; verify the dashboard hero + stats refetch for the new active profile

## Out of scope

- Task 4.3 responsive work (separate PR, next)
- Onboarding / login audit (not in drift list; if drift exists there it'll be captured in a future pass)
- Post-session / pause / drill-state visual audits (state transitions weren't traversed in this audit; can do in a follow-up)
- Any behavior changes beyond the six drift items

## Risks

- **CSS scope spillover:** `.kerf-phase-badge` uppercase applies globally. Risk mitigated by checking all three use sites still look right (practice pre-session, drill pre-session, dashboard engine insight).
- **Dashboard loader data shape change:** adding `profiles` to the loader response means any component reading `loader.data` needs to accept the new shape. Use TypeScript to enforce.
- **Dropdown focus/a11y regressions:** custom dropdown is non-trivial. Will use a small dedicated component with focused tests rather than copy-paste into `dashboard.tsx`.

## Rollback

Single PR, no schema changes, no env changes. Revert the PR if anything regresses.

## Working commits (suggested)

1. `feat(keyboard): ActiveKeyboardPill shared component` — new component + wire into home + practice
2. `fix(home,practice): wireframe fidelity — hero centering, enter-keycap, switch affordance, phase badge uppercase`
3. `feat(dashboard): KeyboardSwitcherPill dropdown` — new component + dashboard integration + loader data update

---

_Authored 2026-04-22 before starting Task 4.3 responsive-design work. This spec is intentionally small — it unblocks the responsive PR by closing visual drift first._
