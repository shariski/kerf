# Wireframe-fidelity Drift-Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close six identified visual/affordance drift items between implemented routes and `design/*-wireframe.html`, on branch `fix/wireframe-fidelity-drift`, before starting Task 4.3 responsive work.

**Architecture:** Mostly additive — enhance the existing `KeyboardContextPill` with a `switch →` link, add `enter` label inside the home CTA keycap, center the practice pre-session hero, uppercase the phase badge, and introduce a dashboard-only `KeyboardSwitcherPill` dropdown that reuses the Task-3.5 server fns (`listKeyboardProfiles` + `switchActiveProfile`). No schema changes.

**Tech Stack:** React + Tanstack Router + Tanstack Start server fns, Tailwind + hand-rolled `kerf-*` CSS in `src/styles.css`, Vitest for unit tests, Playwright for visual verification.

---

## Pre-flight

- Branch already created: `fix/wireframe-fidelity-drift` (off `main`, commit `926d6ce`).
- Spec lives at `docs/superpowers/specs/2026-04-22-wireframe-fidelity-drift-design.md` (local-only, gitignored).
- Dev server may already be running on `:3000`. If not, `npm run dev`.
- Design-folder HTTP server for wireframe comparison runs on `:8765`. If not running: `cd design && python3 -m http.server 8765 &`.

## File map

**Modify:**
- `src/components/practice/KeyboardContextPill.tsx` — add `switch →` link
- `src/routes/index.tsx` — add `enter` text inside home CTA keycaps (two places: ZeroState + ReturningState)
- `src/components/practice/PreSessionStage.tsx` — center the topline row + title + subtitle
- `src/styles.css` — `.kerf-phase-badge { text-transform: uppercase; letter-spacing: 0.06em; }`; may need minor `.kerf-pill` adjustments to fit trailing `switch →` link
- `src/routes/dashboard.tsx` — integrate `<KeyboardSwitcherPill>` into hero row
- `src/server/dashboard.ts` — add hero-side profile list to loader data, OR keep dashboard loader as-is and have `<KeyboardSwitcherPill>` call `listKeyboardProfiles` itself. **Decision in Task 6.**

**Create:**
- `src/components/practice/KeyboardContextPill.test.tsx` — test new `switch →` link
- `src/components/dashboard/KeyboardSwitcherPill.tsx`
- `src/components/dashboard/KeyboardSwitcherPill.test.tsx`

**Delete:** none.

**Existing affected tests to re-run:**
- `src/components/practice/PreSessionStage.test.tsx` (topline + title structure change — may or may not break existing queries)
- `src/routes/onboarding.test.tsx` (unaffected, just sanity-run)

---

## Task 1: `KeyboardContextPill` — add `switch →` link

**Files:**
- Modify: `src/components/practice/KeyboardContextPill.tsx`
- Create: `src/components/practice/KeyboardContextPill.test.tsx`

- [ ] **Step 1: Write the failing test**

Write `src/components/practice/KeyboardContextPill.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryHistory, createRootRoute, createRouter, createRoute, RouterProvider, Outlet } from "@tanstack/react-router";
import { KeyboardContextPill } from "./KeyboardContextPill";

function renderWithRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <>{ui}<Outlet /></> });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const keyboardsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/keyboards", component: () => <div>keyboards page</div> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, keyboardsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("KeyboardContextPill", () => {
  it("renders active keyboard name", () => {
    renderWithRouter(<KeyboardContextPill keyboardType="lily58" />);
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("lily58")).toBeInTheDocument();
  });

  it("renders a switch link to /keyboards", () => {
    renderWithRouter(<KeyboardContextPill keyboardType="sofle" />);
    const link = screen.getByRole("link", { name: /switch/i });
    expect(link).toHaveAttribute("href", "/keyboards");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/practice/KeyboardContextPill.test.tsx`
Expected: the "renders a switch link" test FAILS — no link with name "switch" is rendered.

- [ ] **Step 3: Implement — add trailing `switch →` link**

Replace the body of `src/components/practice/KeyboardContextPill.tsx` with:

```tsx
/**
 * Pre-session pill showing which keyboard profile is active, plus a
 * trailing `switch →` link that routes to `/keyboards` (Task 3.5 landed
 * the profile-switcher page, so the affordance is now live — it was a
 * no-op placeholder until that task shipped).
 */

import { Link } from "@tanstack/react-router";
import type { KeyboardType } from "#/server/profile";

type Props = {
  keyboardType: KeyboardType;
};

export function KeyboardContextPill({ keyboardType }: Props) {
  return (
    <div className="kerf-pill" aria-label={`Active keyboard: ${keyboardType}`}>
      <span className="kerf-pill-icon" aria-hidden>
        ⊞
      </span>
      <span className="kerf-pill-state">active</span>
      <span className="kerf-pill-name">{keyboardType}</span>
      <Link to="/keyboards" className="kerf-pill-switch">
        switch →
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Add supporting CSS**

In `src/styles.css`, after the existing `.kerf-pill-name` block (near line 489), add:

```css
.kerf-pill-switch {
  margin-left: 8px;
  padding-left: 10px;
  border-left: 1px solid var(--color-kerf-border-subtle);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-kerf-text-tertiary);
  text-decoration: none;
  transition: color 120ms ease;
}

.kerf-pill-switch:hover,
.kerf-pill-switch:focus-visible {
  color: var(--color-kerf-text-secondary);
}
```

- [ ] **Step 5: Run the tests again**

Run: `npx vitest run src/components/practice/KeyboardContextPill.test.tsx`
Expected: both tests PASS.

- [ ] **Step 6: Run the broader practice-component tests to catch incidentals**

Run: `npx vitest run src/components/practice/`
Expected: all tests PASS. If `PreSessionStage.test.tsx` breaks due to an added `<a>` / `<Link>` inside the topline, fix the test query (not the implementation).

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/practice/KeyboardContextPill.tsx src/components/practice/KeyboardContextPill.test.tsx src/styles.css
git commit -m "feat(keyboard): KeyboardContextPill has a working switch → link to /keyboards

Task 3.5 landed /keyboards so the placeholder no-op can become a real
TanStack Router Link. Matches the wireframe affordance on home and the
practice pre-session hero."
```

---

## Task 2: Home CTA — add `enter` text inside the keycap

**Files:**
- Modify: `src/routes/index.tsx:119-122` (ZeroState CTA keycap) and `src/routes/index.tsx:158-161` (ReturningState CTA keycap)

**Context:** Wireframe shows `↵ enter →` inside a single pill-shaped keycap. Implementation today shows `<kbd>⏎</kbd>` + separate arrow. We add the word `enter` inside the `<kbd>` so it reads as one keycap pill.

- [ ] **Step 1: Update the ZeroState CTA keycap**

In `src/routes/index.tsx`, find the ZeroState CTA (lines ~119-122):

```tsx
<span className="kerf-home-cta-primary-action" aria-hidden>
  <kbd className="kerf-kbd">⏎</kbd>
</span>
```

Replace with:

```tsx
<span className="kerf-home-cta-primary-action" aria-hidden>
  <kbd className="kerf-kbd kerf-kbd--with-label">
    <span className="kerf-kbd-icon">⏎</span>
    <span className="kerf-kbd-label">enter</span>
  </kbd>
  <span className="kerf-home-cta-primary-arrow">→</span>
</span>
```

- [ ] **Step 2: Update the ReturningState CTA keycap**

In the same file (lines ~158-161):

```tsx
<span className="kerf-home-cta-primary-action" aria-hidden>
  <kbd className="kerf-kbd">⏎</kbd>
  <span className="kerf-home-cta-primary-arrow">→</span>
</span>
```

Replace with:

```tsx
<span className="kerf-home-cta-primary-action" aria-hidden>
  <kbd className="kerf-kbd kerf-kbd--with-label">
    <span className="kerf-kbd-icon">⏎</span>
    <span className="kerf-kbd-label">enter</span>
  </kbd>
  <span className="kerf-home-cta-primary-arrow">→</span>
</span>
```

- [ ] **Step 3: Add CSS for the new label variant**

In `src/styles.css`, locate the existing `.kerf-kbd` block (search: `.kerf-kbd `). Add immediately after it:

```css
.kerf-kbd--with-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
}

.kerf-kbd--with-label .kerf-kbd-icon {
  font-size: 12px;
}

.kerf-kbd--with-label .kerf-kbd-label {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 4: Verify with Playwright screenshot**

Run dev server if not running. Navigate to `http://localhost:3000/` and take a screenshot at 1280×800. Visually confirm the CTA pill now reads `⏎ enter →`.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx src/styles.css
git commit -m "fix(home): CTA keycap now reads ⏎ enter → per wireframe

Match home-wireframe.html affordance — the enter label inside the keycap
pill makes the keyboard-first navigation discoverable without a tooltip."
```

---

## Task 3: Phase badge UPPERCASE

**Files:**
- Modify: `src/styles.css` — the existing `.kerf-phase-badge` block (around line 496)

- [ ] **Step 1: Read the existing rule**

Confirm the current block at line 496 starts with `.kerf-phase-badge {`.

- [ ] **Step 2: Add uppercase + letter-spacing**

Inside the existing `.kerf-phase-badge { … }` rule (not replacing, just appending two declarations), add:

```css
  text-transform: uppercase;
  letter-spacing: 0.06em;
```

- [ ] **Step 3: Visual verification**

Reload `/practice`. The phase badge should now read `● TRANSITIONING` (or `● REFINING`) instead of `● transitioning`. Also reload `/dashboard` and scroll to `Engine insight` section — the phase badge there should also be uppercase; confirm this looks right (it's a small label badge so uppercase is appropriate per §B4 WCAG AA / scannability).

- [ ] **Step 4: Run tests**

Run: `npx vitest run`
Expected: all tests PASS. The existing `PreSessionStage.test.tsx:49` query `container.querySelector(".kerf-phase-badge")` is class-based, so uppercase CSS doesn't break it.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css
git commit -m "style(phase-badge): uppercase + letter-spacing to match wireframe

Applies to pre-session (practice + drill) and the dashboard engine-insight
badge uniformly — uppercase is appropriate for a small label badge in all
three contexts."
```

---

## Task 4: Practice pre-session hero centering

**Files:**
- Modify: `src/components/practice/PreSessionStage.tsx` — markup stays, just class-level centering
- Modify: `src/styles.css` — `.kerf-pre-session-topline`, `.kerf-pre-title`, `.kerf-pre-subtitle`

- [ ] **Step 1: Update `.kerf-pre-session` container in `src/styles.css`**

Find `.kerf-pre-session` (grep: `grep -n "\.kerf-pre-session {" src/styles.css`). Inside that rule, ensure:

```css
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
```

(If any of these already exist, leave them; if not, add them.)

- [ ] **Step 2: Update `.kerf-pre-session-topline`**

Find the existing rule. Ensure it renders as a horizontal flex row with both items inline, no `justify-content: space-between`:

```css
.kerf-pre-session-topline {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  justify-content: center;
  margin-bottom: 24px;
}
```

- [ ] **Step 3: Update `.kerf-pre-title` and `.kerf-pre-subtitle`**

Find both rules. Ensure `text-align: center` and no `align-self: flex-start`:

```css
.kerf-pre-title {
  /* existing rules, but ensure: */
  text-align: center;
}

.kerf-pre-subtitle {
  /* existing rules, but ensure: */
  text-align: center;
}
```

- [ ] **Step 4: Update CTA + mode cards to stay centered**

The CTA button and mode cards need to stay on the centered axis but keep their own max-width. Ensure `.kerf-pre-cta-primary` and `.kerf-pre-modes` are `margin-left: auto; margin-right: auto;` and have their existing `max-width` (~640-720px per wireframe).

- [ ] **Step 5: Playwright visual verification**

With `fullPage: true`, screenshot `http://localhost:3000/practice` at 1280×800 and compare to `http://localhost:8765/practice-page-wireframe.html`. The pill + badge should be inline in a single centered row above a centered title and subtitle.

- [ ] **Step 6: Re-run `PreSessionStage.test.tsx`**

Run: `npx vitest run src/components/practice/PreSessionStage.test.tsx`
Expected: PASS. If any query breaks due to CSS-only changes, the test was too brittle — keep the impl centered and fix the test query instead.

- [ ] **Step 7: Commit**

```bash
git add src/components/practice/PreSessionStage.tsx src/styles.css
git commit -m "fix(practice): center pre-session hero to match wireframe

Pill + phase badge now sit inline in a single centered row above a
centered title + subtitle, replacing the corner-anchored layout. Matches
practice-page-wireframe.html pre-session state."
```

---

## Task 5: `<KeyboardSwitcherPill>` component + tests

**Files:**
- Create: `src/components/dashboard/KeyboardSwitcherPill.tsx`
- Create: `src/components/dashboard/KeyboardSwitcherPill.test.tsx`

**Architecture:**
- Controlled by a local `useState` (`open`).
- Trigger button (`⌨ viewing {displayName} ▼`) toggles the menu.
- Menu renders a list of profiles (props-driven), a divider, a `Manage all →` link.
- Selecting an inactive profile → call `onSwitchProfile(profileId)` prop (parent wires it to `switchActiveProfile` + `router.invalidate`).
- Active profile row is disabled (`aria-disabled`), rendered with a `● current` marker.
- Keyboard: Esc closes, ↑/↓ cycle focus within menu items, Enter activates, focus returns to trigger on close, click-outside closes.

- [ ] **Step 1: Write failing tests**

Create `src/components/dashboard/KeyboardSwitcherPill.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyboardSwitcherPill, type KeyboardSwitcherProfile } from "./KeyboardSwitcherPill";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
  createRootRoute,
  createRoute,
  Outlet,
} from "@tanstack/react-router";

function renderWithRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <>{ui}<Outlet /></> });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const keyboardsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/keyboards", component: () => <div>keyboards</div> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, keyboardsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  return render(<RouterProvider router={router} />);
}

const profiles: KeyboardSwitcherProfile[] = [
  { id: "p1", keyboardType: "lily58", isActive: true },
  { id: "p2", keyboardType: "sofle", isActive: false },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("KeyboardSwitcherPill", () => {
  it("renders the active profile name in the trigger", () => {
    renderWithRouter(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: /viewing lily58/i })).toBeInTheDocument();
  });

  it("opens the menu on click and lists profiles", async () => {
    renderWithRouter(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /viewing/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sofle/i })).toBeInTheDocument();
  });

  it("marks the active profile as current and non-interactive", async () => {
    renderWithRouter(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /viewing/i }));
    const activeItem = screen.getByText(/lily58/i, { selector: "[aria-disabled='true'] *, [aria-disabled='true']" });
    expect(activeItem).toBeInTheDocument();
  });

  it("calls onSwitchProfile with the selected profile id", async () => {
    const onSwitch = vi.fn();
    renderWithRouter(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={onSwitch} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /viewing/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: /sofle/i }));
    expect(onSwitch).toHaveBeenCalledWith("p2");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    renderWithRouter(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: /viewing/i });
    await userEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows a Manage all link to /keyboards", async () => {
    renderWithRouter(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /viewing/i }));
    const link = screen.getByRole("link", { name: /manage all/i });
    expect(link).toHaveAttribute("href", "/keyboards");
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/components/dashboard/KeyboardSwitcherPill.test.tsx`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Implement the component**

Create `src/components/dashboard/KeyboardSwitcherPill.tsx`:

```tsx
/**
 * Dashboard-only keyboard switcher pill. Displays the active profile
 * and opens a dropdown to switch profiles or jump to the full /keyboards
 * management page. Dedicated dashboard affordance (Task 3.5's
 * /keyboards page remains the source of truth for creating profiles).
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { KeyboardType } from "#/server/profile";

export type KeyboardSwitcherProfile = {
  id: string;
  keyboardType: KeyboardType;
  isActive: boolean;
};

type Props = {
  profiles: KeyboardSwitcherProfile[];
  onSwitchProfile: (profileId: string) => void;
};

export function KeyboardSwitcherPill({ profiles, onSwitchProfile }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const active = profiles.find((p) => p.isActive);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current || !triggerRef.current) return;
      const target = e.target as Node;
      if (!menuRef.current.contains(target) && !triggerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Keyboard: Esc closes + returns focus; arrow nav inside menu
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const items = Array.from(
          menuRef.current?.querySelectorAll<HTMLElement>(
            '[role="menuitem"]:not([aria-disabled="true"]), [data-menu-footer]',
          ) ?? [],
        );
        if (items.length === 0) return;
        const current = document.activeElement as HTMLElement | null;
        const idx = current ? items.indexOf(current) : -1;
        const next = e.key === "ArrowDown" ? (idx + 1) % items.length : (idx - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!active) return null;

  return (
    <div className="kerf-kb-switcher">
      <button
        ref={triggerRef}
        type="button"
        className="kerf-kb-switcher-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>⌨</span>
        <span>viewing</span>
        <span className="kerf-kb-switcher-active">{active.keyboardType}</span>
        <span aria-hidden>▼</span>
      </button>
      {open && (
        <div ref={menuRef} role="menu" className="kerf-kb-switcher-menu">
          {profiles.map((p) =>
            p.isActive ? (
              <div
                key={p.id}
                role="menuitem"
                aria-disabled="true"
                className="kerf-kb-switcher-item kerf-kb-switcher-item--current"
              >
                <span className="kerf-kb-switcher-item-dot" aria-hidden>
                  ●
                </span>
                <span>{p.keyboardType}</span>
                <span className="kerf-kb-switcher-item-suffix">current</span>
              </div>
            ) : (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                className="kerf-kb-switcher-item"
                onClick={() => {
                  onSwitchProfile(p.id);
                  setOpen(false);
                }}
              >
                <span className="kerf-kb-switcher-item-dot" aria-hidden>
                  ○
                </span>
                <span>{p.keyboardType}</span>
              </button>
            ),
          )}
          <div className="kerf-kb-switcher-divider" aria-hidden />
          <Link
            to="/keyboards"
            role="menuitem"
            data-menu-footer
            className="kerf-kb-switcher-manage"
          >
            Manage all →
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Add CSS**

In `src/styles.css`, append near the dashboard styles block (search: `/* dashboard` or similar section header, or simply append at EOF under a new section):

```css
/* Dashboard keyboard-switcher pill — Task: wireframe-fidelity drift fix */
.kerf-kb-switcher {
  position: relative;
  display: inline-block;
}

.kerf-kb-switcher-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--color-kerf-bg-surface);
  border: 1px solid var(--color-kerf-border-subtle);
  border-radius: 999px;
  color: var(--color-kerf-text-secondary);
  font-family: var(--font-mono);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}

.kerf-kb-switcher-trigger:hover,
.kerf-kb-switcher-trigger[aria-expanded="true"] {
  border-color: var(--color-kerf-border-default);
  color: var(--color-kerf-text-primary);
}

.kerf-kb-switcher-active {
  color: var(--color-kerf-text-primary);
  font-weight: 600;
}

.kerf-kb-switcher-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 220px;
  padding: 6px;
  background: var(--color-kerf-bg-surface);
  border: 1px solid var(--color-kerf-border-subtle);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  z-index: 20;
}

.kerf-kb-switcher-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--color-kerf-text-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.kerf-kb-switcher-item:hover:not([aria-disabled="true"]),
.kerf-kb-switcher-item:focus-visible {
  background: var(--color-kerf-bg-raised);
  outline: none;
}

.kerf-kb-switcher-item--current {
  color: var(--color-kerf-text-tertiary);
  cursor: default;
}

.kerf-kb-switcher-item-dot {
  color: var(--color-kerf-accent-amber);
  font-size: 10px;
}

.kerf-kb-switcher-item-suffix {
  margin-left: auto;
  font-size: 11px;
  color: var(--color-kerf-text-tertiary);
}

.kerf-kb-switcher-divider {
  height: 1px;
  margin: 6px 0;
  background: var(--color-kerf-border-subtle);
}

.kerf-kb-switcher-manage {
  display: block;
  padding: 8px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-kerf-text-secondary);
  text-decoration: none;
  border-radius: 6px;
}

.kerf-kb-switcher-manage:hover,
.kerf-kb-switcher-manage:focus-visible {
  background: var(--color-kerf-bg-raised);
  color: var(--color-kerf-text-primary);
  outline: none;
}
```

> If any of the referenced CSS variables (`--color-kerf-bg-raised`, `--color-kerf-border-default`) don't exist, swap for the nearest existing variable. Do not introduce new tokens — §B5 locks the design tokens for Phase A.

- [ ] **Step 5: Run tests — verify they pass**

Run: `npx vitest run src/components/dashboard/KeyboardSwitcherPill.test.tsx`
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/KeyboardSwitcherPill.tsx src/components/dashboard/KeyboardSwitcherPill.test.tsx src/styles.css
git commit -m "feat(dashboard): KeyboardSwitcherPill dropdown

New dashboard-scoped pill with profile-list dropdown, keyboard nav
(Esc / ↑ / ↓), focus return, and a Manage all → link to /keyboards.
Reuses Task 3.5's profile data; parent wires switching."
```

---

## Task 6: Dashboard integration

**Files:**
- Modify: `src/routes/dashboard.tsx`

**Decision (re-deferred from the file map):** keep the dashboard route loader minimal and fetch `listKeyboardProfiles` inline from a small hook/call within the dashboard component, rather than threading profile data through the existing hero-focused loader. Lower blast radius — the existing loader returns a specific shape consumed by seven components; adding one more field is fine, but the simpler move is a parallel fetch for a small piece of independent data.

- [ ] **Step 1: Add a second route loader call for profiles**

In `src/routes/dashboard.tsx`:

1. Add to the imports at the top:
   ```ts
   import { listKeyboardProfiles, switchActiveProfile, type ProfileListEntry } from "#/server/profile";
   import { KeyboardSwitcherPill, type KeyboardSwitcherProfile } from "#/components/dashboard/KeyboardSwitcherPill";
   ```

2. In the `loader` async return shape, add a `profiles: ProfileListEntry[]` field. Extend the `Promise.all` to include `listKeyboardProfiles()`:

   ```ts
   const [hero, activity, heatmap, weakness, trajectory, phaseSuggestion, weekly, temporal, profiles] =
     await Promise.all([
       getDashboardHeroStats(),
       getDashboardActivity(),
       getDashboardHeatmap(),
       getDashboardWeaknessRanking(),
       getDashboardTrajectory(),
       getDashboardPhaseSuggestion(),
       getDashboardWeeklyInsight(),
       getDashboardTemporalPatterns(),
       listKeyboardProfiles(),
     ]);
   return {
     hero,
     activity,
     heatmap,
     weakness,
     trajectory,
     phaseSuggestion,
     weekly,
     temporal,
     profiles,
   };
   ```

3. Update the loader return type at line ~41 to include `profiles: ProfileListEntry[]`.

- [ ] **Step 2: Map profiles to the switcher type and render in hero**

Inside the dashboard component's render, where the hero heading currently lives (search for `YOUR PROGRESS` or the `kerf-home-greeting-title` equivalent — typically near the top of the main component):

- Wrap the heading block and the switcher pill in a flex row (`display: flex; justify-content: space-between; align-items: baseline;`).
- Map `loaderData.profiles` to `KeyboardSwitcherProfile[]`:
  ```tsx
  const switcherProfiles: KeyboardSwitcherProfile[] = loaderData.profiles.map((p) => ({
    id: p.id,
    keyboardType: p.keyboardType,
    isActive: p.isActive,
  }));

  const router = useRouter(); // import from '@tanstack/react-router' if not already

  const handleSwitch = async (profileId: string) => {
    await switchActiveProfile({ data: { profileId } });
    await router.invalidate();
  };
  ```

  Then render:
  ```tsx
  <KeyboardSwitcherPill profiles={switcherProfiles} onSwitchProfile={handleSwitch} />
  ```

  Next to the `Dashboard` heading (in the same flex-row container).

- [ ] **Step 3: Add flex wrapper CSS**

In `src/styles.css`, ensure there's a wrapper class (e.g. `kerf-dashboard-hero-head`) that aligns heading-left + switcher-right. If using existing classes on the dashboard route, just add `display: flex; justify-content: space-between; align-items: baseline;` to that class.

- [ ] **Step 4: Visual verification**

Navigate to `http://localhost:3000/dashboard`. Verify the `⌨ viewing lily58 ▼` pill appears aligned to the right of the `Dashboard` heading. Click it — a dropdown menu shows the profile list, current profile marked with `● ... current`. Selecting a different profile should refetch the dashboard with new active profile.

- [ ] **Step 5: Run all tests**

Run: `npx vitest run`
Expected: all tests PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/dashboard.tsx src/styles.css
git commit -m "feat(dashboard): integrate KeyboardSwitcherPill into hero

Loader pulls listKeyboardProfiles in parallel; selecting a profile
calls switchActiveProfile and router.invalidate to refetch the
dashboard against the new active profile. Closes the last drift item
versus dashboard-wireframe.html."
```

---

## Task 7: Final Playwright visual verification

- [ ] **Step 1: Start/verify servers running**

Dev server on `:3000`, design server on `:8765`.

- [ ] **Step 2: Screenshot each page at 1280×800 and eyeball the diff**

```
/ (home)        vs http://localhost:8765/home-wireframe.html
/practice       vs http://localhost:8765/practice-page-wireframe.html
/dashboard      vs http://localhost:8765/dashboard-wireframe.html
```

Confirm all six drift items are closed:

- [ ] Home pill: `active lily58 switch →` with working link
- [ ] Home CTA: `⏎ enter →` inside pill
- [ ] Practice hero: centered pill + badge row + title + subtitle
- [ ] Practice pill: has `switch →`
- [ ] Phase badge: `TRANSITIONING` uppercase
- [ ] Dashboard: top-right `viewing {layout} ▼` pill with working dropdown

- [ ] **Step 3: Run full test suite + typecheck + lint**

```bash
npx vitest run
npm run typecheck
npm run lint
```

All three clean.

- [ ] **Step 4: `npm run build`**

Run: `npm run build`
Expected: production build succeeds.

---

## Task 8: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin fix/wireframe-fidelity-drift
```

- [ ] **Step 2: Open PR against `main`**

Title: `fix: close wireframe-fidelity drift before Task 4.3`

Body:
```
## Summary
- Closes 6 drift items identified in a pre-Task-4.3 wireframe audit
- Promotes `KeyboardContextPill`'s `switch →` from a placeholder to a working Link (Task 3.5 landed `/keyboards`)
- New `<KeyboardSwitcherPill>` dropdown on `/dashboard` for in-place profile switching
- Uppercases `.kerf-phase-badge`; centers `/practice` pre-session hero; adds `enter` label to home CTA keycap

## Drift closed
| Page | Item |
|------|------|
| `/` | Keyboard pill `switch →` + CTA `⏎ enter →` |
| `/practice` | Centered hero; pill `switch →`; UPPERCASE phase badge |
| `/dashboard` | Top-right `viewing {layout} ▼` switcher dropdown |

Deliberate spec-driven deviations (accuracy-first stat order, phase-suggestion banner, vim scroll footer, "coming soon" badge) are NOT touched — intentional.

## Test plan
- [x] Unit tests for `KeyboardContextPill` (switch link) and `KeyboardSwitcherPill` (menu + keyboard nav + focus return)
- [x] Full vitest pass
- [x] Playwright visual diff at 1280×800 for /, /practice, /dashboard
- [x] `npm run typecheck` + `npm run lint` + `npm run build` clean
```

- [ ] **Step 3: Report the PR URL**

Paste the URL back for review.

---

## Self-review checklist (post-plan, pre-execution)

- [x] Every spec section has at least one task (affordances → T1+T2; typography → T3; layout → T4; dropdown → T5+T6; verification → T7; PR → T8)
- [x] No TBDs / placeholders / "similar to Task N" references
- [x] Type consistency: `KeyboardSwitcherProfile` is declared in T5 and imported in T6 by the same name; `onSwitchProfile` callback shape matches between component and integration
- [x] Each step shows code when code is expected; each command has expected output
- [x] Commits are small, scoped, and message-aligned with the spec

## Risks to watch during execution

- **CSS class leakage** — `.kerf-phase-badge` uppercase applies globally. Verify dashboard `EngineInsight` badge still looks right.
- **Dashboard loader type drift** — adding `profiles` is additive, but TypeScript errors elsewhere could surface if a component tree destructures the loader return. Typecheck after T6.
- **Existing `PreSessionStage.test.tsx` fragility** — centering changes might break query selectors that assume DOM ordering. If a test fails, fix the query, not the impl.
- **CSS variable names** — if any of `--color-kerf-bg-raised`, `--color-kerf-border-default` don't exist in the design-system CSS, swap for the closest sibling.
