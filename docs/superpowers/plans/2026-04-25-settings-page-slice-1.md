# Settings page (slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full 5-section settings page at 1:1 visual fidelity with `design/settings-wireframe.html`, merge today's Finger Assignment edit into the Preferences section, wire the AppNav cog to `/settings`, and treat every not-yet-wired control as visually-rendered + non-interactive with a `coming soon` hover hint.

**Architecture:** Route `/settings` (TanStack Start file route) loads a single aggregated `SettingsData` payload via a new `getAccountSummary` server function. The page is a `SettingsLayout` (sticky sidebar + content grid) composed of 5 section components, each built from a small set of reusable primitives (`FieldRow`, `PillGroup`, `ToggleSwitch`, `InlineEditField`, `ThemeCard`). Only Finger Assignment is interactive in this slice; everything else is rendered + disabled.

**Tech Stack:** TanStack Start (file routes, `createServerFn`), Drizzle ORM (Postgres), better-auth (session reads only — no new auth surface), React 19, Tailwind 4 (`kerf-*` token classes), Vitest + @testing-library/react (jsdom), Biome 2.

**Source spec:** `docs/superpowers/specs/2026-04-25-settings-page-design.md`

---

## File map

**Created:**
- `src/server/account.ts` — `getAccountSummary` server fn + `SettingsData` type
- `src/components/settings/FieldRow.tsx`
- `src/components/settings/FieldRow.test.tsx`
- `src/components/settings/PillGroup.tsx`
- `src/components/settings/ToggleSwitch.tsx`
- `src/components/settings/InlineEditField.tsx` (exports `COMING_SOON_HINT`)
- `src/components/settings/InlineEditField.test.tsx`
- `src/components/settings/ThemeCard.tsx`
- `src/components/settings/SettingsLayout.tsx`
- `src/components/settings/sections/AccountSection.tsx`
- `src/components/settings/sections/AccountSection.test.tsx`
- `src/components/settings/sections/PreferencesSection.tsx`
- `src/components/settings/sections/ThemeSection.tsx`
- `src/components/settings/sections/DataSection.tsx`
- `src/components/settings/sections/DangerZoneSection.tsx`
- `src/routes/settings.test.tsx`

**Modified:**
- `src/routes/settings.tsx` — full rewrite (loader switches from `getActiveProfile` to `getAccountSummary`, page swaps to layout + sections)
- `src/components/nav/AppNav.tsx` — replace cog `<span>` with `<Link to="/settings">`
- `README.md` — add ticked `## Status` line for this slice

**Verify exists (no edit):**
- `src/server/db/index.ts` exports `db` (default Drizzle client) — used by all server fns

---

## Task ordering & dependencies

```
Task 1  → server: getAccountSummary
Task 2  → primitive: FieldRow (TDD per spec)
Task 3  → primitive: PillGroup
Task 4  → primitive: ToggleSwitch
Task 5  → primitive: InlineEditField + COMING_SOON_HINT (TDD per spec)
Task 6  → primitive: ThemeCard
Task 7  → section:   AccountSection (TDD per spec)
Task 8  → section:   PreferencesSection (FA edit lives here)
Task 9  → section:   ThemeSection
Task 10 → section:   DataSection
Task 11 → section:   DangerZoneSection
Task 12 → layout:    SettingsLayout
Task 13 → route:     settings.tsx rewrite (loader + layout + sections)
Task 14 → route:     settings.test.tsx integration test (TDD light — write tests, fix any gaps)
Task 15 → nav:       AppNav cog → /settings link
Task 16 → docs:      README ## Status checkpoint
Task 17 → quality:   format + lint sweep, fix drift
```

Tasks 2–6 (primitives) are independent of each other. Tasks 7–11 (sections) depend on the primitives they use but are independent of each other. Tasks 13–14 depend on everything else.

---

## Conventions to follow (do not skip)

- **Test file convention** (see `src/components/MobileGate.test.tsx`):
  - First line: `/** @vitest-environment jsdom */`
  - Imports: `vitest` for `afterEach, describe, expect, it`, `@testing-library/react` for `cleanup, render, screen`
  - Always: `afterEach(() => cleanup());`
- **Path alias:** `#/` → `./src/` (e.g., `#/lib/require-auth`, `#/domain/adaptive/journey`)
- **Date serialization:** server fns return `Date` as ISO strings (`.toISOString()`) — see `listKeyboardProfiles` in `src/server/profile.ts:325`
- **Color tokens:** prefer Tailwind classes (`text-kerf-text-primary`, `bg-kerf-bg-surface`, `border-kerf-border-subtle`, `bg-kerf-amber-base`). Use `var(--lr-*)` only when a Tailwind class doesn't exist — and never auto-migrate `--lr-*` to `--kerf-*` (CLAUDE.md §B5 known tech debt).
- **Inline styles:** acceptable for `padding`, `fontSize`, `gridTemplateColumns`, `gap`, etc. that aren't easily expressed as Tailwind utilities. Mirror the style of the current `src/routes/settings.tsx`.
- **Format/lint per task:** run `./node_modules/.bin/biome format --write <changed-files>` before each commit; verify `./node_modules/.bin/biome lint <changed-files>` clean. (CLAUDE.md §B12 — direct binary invocation avoids `pnpm` proxy truncation.)
- **Package manager:** pnpm only. Never `npm install`. Never commit `package-lock.json`.
- **Commit messages:** present-tense, type-scope-summary (match `git log --oneline` style — e.g., `feat(settings): add FieldRow primitive`).
- **No comments in code** unless the WHY is non-obvious (system prompt rule).

---

## Task 1: `getAccountSummary` server function

**Files:**
- Create: `src/server/account.ts`

**Why:** The route loader needs a single typed payload (`SettingsData`) that includes user account info, total session count, the active keyboard profile, and the per-keyboard profile list with session counts. Existing `getActiveProfile`, `listKeyboardProfiles`, and `getCompletedSessionCountOnActiveProfile` could be composed at the route level, but that's three round-trips and three loader awaits. One aggregating server function is cleaner and matches the spec.

- [ ] **Step 1: Verify `db` is exported from `src/server/db/index.ts`**

Run: `grep -n "export" src/server/db/index.ts`
Expected: a line like `export { db } from "./client";` (or similar). If the file exports something else, adapt the import in step 2.

- [ ] **Step 2: Create `src/server/account.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import { keyboardProfiles, sessions, users } from "./db/schema";
import type { JourneyCode } from "#/domain/adaptive/journey";
import { toJourneyCode } from "#/domain/adaptive/journey";

export type SettingsData = {
  account: {
    email: string;
    displayName: string | null;
    createdAt: string;
  };
  totalSessions: number;
  activeProfile: {
    id: string;
    keyboardType: string;
    fingerAssignment: JourneyCode;
  };
  profiles: Array<{
    id: string;
    keyboardType: string;
    sessionCount: number;
    isActive: boolean;
  }>;
};

export const getAccountSummary = createServerFn({ method: "GET" }).handler(
  async (): Promise<SettingsData> => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    const userId = session.user.id;

    const [userRow] = await db
      .select({
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userRow) throw redirect({ to: "/login" });

    const profileRows = await db
      .select()
      .from(keyboardProfiles)
      .where(eq(keyboardProfiles.userId, userId));

    if (profileRows.length === 0) throw redirect({ to: "/onboarding" });

    const active = profileRows.find((p) => p.isActive);
    if (!active) throw redirect({ to: "/onboarding" });

    const perProfileCounts = await db
      .select({
        profileId: sessions.keyboardProfileId,
        n: count(),
      })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), isNotNull(sessions.keyboardProfileId)))
      .groupBy(sessions.keyboardProfileId);

    const countMap = new Map<string, number>();
    for (const row of perProfileCounts) {
      if (row.profileId) countMap.set(row.profileId, Number(row.n));
    }
    const totalSessions = perProfileCounts.reduce((sum, r) => sum + Number(r.n), 0);

    return {
      account: {
        email: userRow.email,
        displayName: userRow.name ?? null,
        createdAt: userRow.createdAt.toISOString(),
      },
      totalSessions,
      activeProfile: {
        id: active.id,
        keyboardType: active.keyboardType,
        fingerAssignment: toJourneyCode(active.fingerAssignment),
      },
      profiles: profileRows
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((p) => ({
          id: p.id,
          keyboardType: p.keyboardType,
          sessionCount: countMap.get(p.id) ?? 0,
          isActive: p.isActive,
        })),
    };
  },
);
```

- [ ] **Step 3: Verify it typechecks**

Run: `pnpm typecheck`
Expected: no errors related to `src/server/account.ts`. (Pre-existing errors in `journey.test.ts`, `motionPatterns.test.ts`, `drillLibrary*.test.ts`, `exerciseGenerator.test.ts` are unrelated to this slice — leave them.)

If `db` import path differs from `./db`, adjust to whatever `src/server/db/index.ts` actually exports. If `keyboardProfiles` columns differ from what the query assumes, run `grep -n "keyboardProfiles =" src/server/db/schema.ts` to re-check.

- [ ] **Step 4: Format + lint**

Run: `./node_modules/.bin/biome format --write src/server/account.ts && ./node_modules/.bin/biome lint src/server/account.ts`
Expected: no diagnostics.

- [ ] **Step 5: Commit**

```bash
git add src/server/account.ts
git commit -m "$(cat <<'EOF'
feat(server): add getAccountSummary aggregating server fn

Returns account info, total session count, active profile, and per-keyboard
session counts in a single round-trip. Used by the new settings page loader
to avoid composing three separate server fns at the route level.

EOF
)"
```

---

## Task 2: `FieldRow` primitive (TDD)

**Files:**
- Create: `src/components/settings/FieldRow.tsx`
- Create: `src/components/settings/FieldRow.test.tsx`

**Why:** The wireframe puts every settings row in the same `200px 1fr` grid (label-left, control-right) with a bottom border that's suppressed on the last row of a section. Centralizing this avoids re-declaring the layout in 11 places.

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/FieldRow.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FieldRow } from "./FieldRow";

afterEach(() => cleanup());

describe("FieldRow", () => {
  it("renders the label name", () => {
    render(
      <FieldRow labelName="Email address">
        <span>control</span>
      </FieldRow>,
    );
    expect(screen.getByText("Email address")).toBeTruthy();
  });

  it("renders the optional label hint when provided", () => {
    render(
      <FieldRow labelName="Email address" labelHint="used for sign-in">
        <span>control</span>
      </FieldRow>,
    );
    expect(screen.getByText("used for sign-in")).toBeTruthy();
  });

  it("does not render a hint slot when labelHint is omitted", () => {
    render(
      <FieldRow labelName="Account created">
        <span>control</span>
      </FieldRow>,
    );
    expect(screen.queryByText(/used for/)).toBeNull();
  });

  it("renders its children in the control slot", () => {
    render(
      <FieldRow labelName="Mode">
        <span data-testid="control-child">pills go here</span>
      </FieldRow>,
    );
    expect(screen.getByTestId("control-child")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/settings/FieldRow.test.tsx`
Expected: FAIL with `Cannot find module './FieldRow'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/settings/FieldRow.tsx`:

```tsx
import type { ReactNode } from "react";

type FieldRowProps = {
  labelName: string;
  labelHint?: string;
  children: ReactNode;
};

export function FieldRow({ labelName, labelHint, children }: FieldRowProps) {
  return (
    <div
      className="grid items-center border-b border-kerf-border-subtle last:border-b-0"
      style={{
        gridTemplateColumns: "200px 1fr",
        gap: "24px",
        padding: "16px 0",
      }}
    >
      <div className="flex flex-col" style={{ gap: "2px" }}>
        <span
          className="text-kerf-text-primary"
          style={{ fontSize: "13px", fontWeight: 500 }}
        >
          {labelName}
        </span>
        {labelHint ? (
          <span
            className="text-kerf-text-tertiary"
            style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}
          >
            {labelHint}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between" style={{ gap: "12px" }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/settings/FieldRow.test.tsx`
Expected: 4 tests PASS.

- [ ] **Step 5: Format + lint + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/FieldRow.tsx src/components/settings/FieldRow.test.tsx
./node_modules/.bin/biome lint src/components/settings/FieldRow.tsx src/components/settings/FieldRow.test.tsx
git add src/components/settings/FieldRow.tsx src/components/settings/FieldRow.test.tsx
git commit -m "feat(settings): add FieldRow primitive"
```

---

## Task 3: `PillGroup` primitive

**Files:**
- Create: `src/components/settings/PillGroup.tsx`

**Why:** Used by the Finger Assignment edit (interactive) and three Preferences fields (disabled). One generic component covers both. Tested via `PreferencesSection` and the route integration test, so no dedicated unit test in this slice (per spec §9).

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/PillGroup.tsx`:

```tsx
import type { ReactNode } from "react";

type PillGroupProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
};

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: PillGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className="flex border border-kerf-border-subtle bg-kerf-bg-surface"
      style={{ gap: "4px", borderRadius: "6px", padding: "2px" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange?.(opt.value);
            }}
            className={
              active
                ? "bg-kerf-amber-base text-kerf-text-inverse"
                : "text-kerf-text-secondary hover:text-kerf-text-primary"
            }
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: active ? 600 : 400,
              border: "none",
              background: active ? undefined : "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              fontFamily: "var(--font-sans)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/PillGroup.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/PillGroup.tsx
git add src/components/settings/PillGroup.tsx
git commit -m "feat(settings): add PillGroup primitive"
```

---

## Task 4: `ToggleSwitch` primitive

**Files:**
- Create: `src/components/settings/ToggleSwitch.tsx`

**Why:** Used by Reduce-motion (disabled in slice 1) and Sound-effects (also disabled, v2). One generic component supports both wired and disabled use.

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/ToggleSwitch.tsx`:

```tsx
type ToggleSwitchProps = {
  on: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  ariaLabel: string;
};

export function ToggleSwitch({
  on,
  onToggle,
  disabled = false,
  ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onToggle?.();
      }}
      className={
        on
          ? "border-kerf-amber-base bg-kerf-amber-base"
          : "border-kerf-border-default bg-kerf-bg-elevated"
      }
      style={{
        position: "relative",
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        borderWidth: "1px",
        borderStyle: "solid",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        padding: 0,
        transition: "all 150ms",
      }}
    >
      <span
        aria-hidden="true"
        className={on ? "bg-kerf-text-inverse" : "bg-kerf-text-secondary"}
        style={{
          position: "absolute",
          top: "2px",
          left: on ? "18px" : "2px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          transition: "all 150ms",
          display: "block",
        }}
      />
    </button>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/ToggleSwitch.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/ToggleSwitch.tsx
git add src/components/settings/ToggleSwitch.tsx
git commit -m "feat(settings): add ToggleSwitch primitive"
```

---

## Task 5: `InlineEditField` primitive (TDD)

**Files:**
- Create: `src/components/settings/InlineEditField.tsx`
- Create: `src/components/settings/InlineEditField.test.tsx`

**Why:** Account section uses 2 of these (email, display name). Both are disabled in slice 1 — they show real data plus a `coming soon` hover hint where the wireframe shows `✎ click to edit`. The COMING_SOON_HINT constant is exported so other call-sites (Data section, Danger zone) reference one source of truth.

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/InlineEditField.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InlineEditField, COMING_SOON_HINT } from "./InlineEditField";

afterEach(() => cleanup());

describe("InlineEditField", () => {
  it("renders the value when present", () => {
    render(<InlineEditField value="user@example.com" ariaLabel="Email" />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("renders the default empty label when value is null", () => {
    render(<InlineEditField value={null} ariaLabel="Display name" />);
    expect(screen.getByText("— not set")).toBeTruthy();
  });

  it("renders a custom empty label when provided", () => {
    render(<InlineEditField value={null} emptyLabel="(blank)" ariaLabel="Bio" />);
    expect(screen.getByText("(blank)")).toBeTruthy();
  });

  it("is marked aria-disabled and shows the coming-soon hint", () => {
    render(<InlineEditField value="x" ariaLabel="Field" />);
    const group = screen.getByRole("group", { name: "Field" });
    expect(group.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByText(COMING_SOON_HINT).length).toBeGreaterThan(0);
  });

  it("exports COMING_SOON_HINT as a stable string", () => {
    expect(typeof COMING_SOON_HINT).toBe("string");
    expect(COMING_SOON_HINT.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/settings/InlineEditField.test.tsx`
Expected: FAIL with `Cannot find module './InlineEditField'`.

- [ ] **Step 3: Write the implementation**

Create `src/components/settings/InlineEditField.tsx`:

```tsx
type InlineEditFieldProps = {
  value: string | null;
  emptyLabel?: string;
  ariaLabel: string;
};

export const COMING_SOON_HINT = "coming soon";

export function InlineEditField({
  value,
  emptyLabel = "— not set",
  ariaLabel,
}: InlineEditFieldProps) {
  const isEmpty = value === null || value === "";
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-disabled="true"
      title={COMING_SOON_HINT}
      className="group flex items-center"
      style={{
        gap: "8px",
        flex: 1,
        padding: "8px 12px",
        border: "1px solid transparent",
        borderRadius: "4px",
        cursor: "not-allowed",
      }}
    >
      <span
        className={isEmpty ? "text-kerf-text-secondary" : "text-kerf-text-primary"}
        style={{ fontSize: "14px", flex: 1 }}
      >
        {isEmpty ? emptyLabel : value}
      </span>
      <span
        className="text-kerf-text-tertiary opacity-0 group-hover:opacity-100"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          transition: "opacity 100ms",
        }}
      >
        {COMING_SOON_HINT}
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/settings/InlineEditField.test.tsx`
Expected: 5 tests PASS.

- [ ] **Step 5: Format + lint + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/InlineEditField.tsx src/components/settings/InlineEditField.test.tsx
./node_modules/.bin/biome lint src/components/settings/InlineEditField.tsx src/components/settings/InlineEditField.test.tsx
git add src/components/settings/InlineEditField.tsx src/components/settings/InlineEditField.test.tsx
git commit -m "feat(settings): add InlineEditField primitive (read-only mode)"
```

---

## Task 6: `ThemeCard` primitive

**Files:**
- Create: `src/components/settings/ThemeCard.tsx`

**Why:** Renders the dark/light cards in the Theme section. Both are non-interactive in slice 1 (dark is current; light is `v2`). One component, two variants.

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/ThemeCard.tsx`:

```tsx
type ThemeCardProps = {
  label: string;
  badge: "active" | "v2";
  variant: "dark" | "light";
};

export function ThemeCard({ label, badge, variant }: ThemeCardProps) {
  const isActive = badge === "active";
  const barBg = variant === "dark" ? "var(--lr-bg-surface)" : "#E5E0D5";
  const previewBg = variant === "dark" ? undefined : "#F5F2ED";
  return (
    <div
      aria-disabled={isActive ? undefined : "true"}
      className={
        "border-2 " +
        (isActive ? "border-kerf-amber-base" : "border-kerf-border-subtle opacity-40")
      }
      style={{
        borderRadius: "8px",
        overflow: "hidden",
        cursor: isActive ? "default" : "not-allowed",
      }}
    >
      <div
        aria-hidden="true"
        className={variant === "dark" ? "bg-kerf-bg-base" : ""}
        style={{
          aspectRatio: "16 / 9",
          display: "flex",
          flexDirection: "column",
          padding: "12px",
          gap: "8px",
          background: previewBg,
        }}
      >
        <div style={{ height: "6px", width: "60%", background: barBg, borderRadius: "2px" }} />
        <div style={{ height: "6px", width: "48%", background: barBg, borderRadius: "2px" }} />
        <div
          className="bg-kerf-amber-base"
          style={{ height: "16px", width: "40%", borderRadius: "2px" }}
        />
        <div style={{ height: "6px", width: "27%", background: barBg, borderRadius: "2px" }} />
      </div>
      <div
        className="flex items-center justify-between border-t border-kerf-border-subtle"
        style={{ padding: "10px 12px", fontSize: "12px", fontWeight: 600 }}
      >
        {label}
        <span
          className={
            isActive
              ? "bg-kerf-amber-base text-kerf-text-inverse"
              : "bg-kerf-bg-elevated text-kerf-text-tertiary"
          }
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "9px",
            padding: "2px 6px",
            borderRadius: "2px",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            fontWeight: 700,
          }}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/ThemeCard.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/ThemeCard.tsx
git add src/components/settings/ThemeCard.tsx
git commit -m "feat(settings): add ThemeCard primitive"
```

---

## Task 7: `AccountSection` (TDD)

**Files:**
- Create: `src/components/settings/sections/AccountSection.tsx`
- Create: `src/components/settings/sections/AccountSection.test.tsx`

**Why:** Renders email, display name, and account-created in three FieldRows. The created-date row also formats `totalSessions`. Spec §9 calls for a dedicated test that pins both the formatting and the `— not set` fallback.

- [ ] **Step 1: Write the failing test**

Create `src/components/settings/sections/AccountSection.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AccountSection } from "./AccountSection";

afterEach(() => cleanup());

describe("AccountSection", () => {
  const baseAccount = {
    email: "user@example.com",
    displayName: null,
    createdAt: new Date("2026-03-12T10:00:00Z").toISOString(),
  };

  it("renders the email", () => {
    render(<AccountSection account={baseAccount} totalSessions={0} />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("renders '— not set' when displayName is null", () => {
    render(<AccountSection account={baseAccount} totalSessions={0} />);
    expect(screen.getByText("— not set")).toBeTruthy();
  });

  it("renders the displayName when provided", () => {
    render(
      <AccountSection
        account={{ ...baseAccount, displayName: "Avery" }}
        totalSessions={0}
      />,
    );
    expect(screen.getByText("Avery")).toBeTruthy();
  });

  it("formats the created-at date and pluralizes session count", () => {
    render(<AccountSection account={baseAccount} totalSessions={47} />);
    expect(screen.getByText(/March 12, 2026/)).toBeTruthy();
    expect(screen.getByText(/47 sessions logged/)).toBeTruthy();
  });

  it("uses singular 'session' when count is 1", () => {
    render(<AccountSection account={baseAccount} totalSessions={1} />);
    expect(screen.getByText(/1 session logged/)).toBeTruthy();
    expect(screen.queryByText(/sessions/)).toBeNull();
  });

  it("uses 0 sessions wording for empty accounts", () => {
    render(<AccountSection account={baseAccount} totalSessions={0} />);
    expect(screen.getByText(/0 sessions logged/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/settings/sections/AccountSection.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/settings/sections/AccountSection.tsx`:

```tsx
import { FieldRow } from "../FieldRow";
import { InlineEditField } from "../InlineEditField";

type AccountSectionProps = {
  account: {
    email: string;
    displayName: string | null;
    createdAt: string;
  };
  totalSessions: number;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

function formatCreatedAt(iso: string, totalSessions: number): string {
  const date = DATE_FORMATTER.format(new Date(iso));
  const noun = totalSessions === 1 ? "session" : "sessions";
  return `${date} · ${totalSessions} ${noun} logged`;
}

export function AccountSection({ account, totalSessions }: AccountSectionProps) {
  return (
    <section
      id="account"
      aria-labelledby="account-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="account-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Account
        </h2>
        <p
          className="text-kerf-text-secondary"
          style={{ fontSize: "13px" }}
        >
          Your identity and how we reach you.
        </p>
      </header>

      <FieldRow labelName="Email address" labelHint="used for sign-in">
        <InlineEditField value={account.email} ariaLabel="Email address" />
      </FieldRow>

      <FieldRow labelName="Display name" labelHint="optional · shown in greetings">
        <InlineEditField value={account.displayName} ariaLabel="Display name" />
      </FieldRow>

      <FieldRow labelName="Account created" labelHint="read-only">
        <span
          className="text-kerf-text-secondary"
          style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
        >
          {formatCreatedAt(account.createdAt, totalSessions)}
        </span>
      </FieldRow>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/settings/sections/AccountSection.test.tsx`
Expected: 6 tests PASS.

- [ ] **Step 5: Format + lint + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/sections/AccountSection.tsx src/components/settings/sections/AccountSection.test.tsx
./node_modules/.bin/biome lint src/components/settings/sections/AccountSection.tsx src/components/settings/sections/AccountSection.test.tsx
git add src/components/settings/sections/AccountSection.tsx src/components/settings/sections/AccountSection.test.tsx
git commit -m "feat(settings): add AccountSection with date+session-count format"
```

---

## Task 8: `PreferencesSection` (Finger Assignment edit lives here)

**Files:**
- Create: `src/components/settings/sections/PreferencesSection.tsx`

**Why:** This is the only section with an interactive control in slice 1 — Finger Assignment. The pill click triggers `updateFingerAssignment`, then `router.invalidate()` so the loader re-runs. Other 4 fields render at full visual fidelity but disabled. No dedicated unit test in this file (covered by the route integration test in Task 14).

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/sections/PreferencesSection.tsx`:

```tsx
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { JourneyCode } from "#/domain/adaptive/journey";
import { updateFingerAssignment } from "#/server/profile";
import { FieldRow } from "../FieldRow";
import { PillGroup } from "../PillGroup";
import { ToggleSwitch } from "../ToggleSwitch";

type PreferencesSectionProps = {
  activeProfile: {
    keyboardType: string;
    fingerAssignment: JourneyCode;
  };
};

const FA_OPTIONS = [
  { value: "conventional" as const, label: "Conventional" },
  { value: "columnar" as const, label: "Columnar" },
  { value: "unsure" as const, label: "Unsure" },
] as const;

const MODE_OPTIONS = [
  { value: "adaptive" as const, label: "Adaptive" },
  { value: "drill" as const, label: "Drill" },
  { value: "ask" as const, label: "Ask each time" },
] as const;

const KB_VISIBILITY_OPTIONS = [
  { value: "visible" as const, label: "Visible" },
  { value: "hidden" as const, label: "Hidden" },
] as const;

export function PreferencesSection({ activeProfile }: PreferencesSectionProps) {
  const router = useRouter();
  const [savingFA, setSavingFA] = useState(false);
  const [faError, setFAError] = useState<string | null>(null);

  const handleFAChange = async (next: JourneyCode) => {
    if (next === activeProfile.fingerAssignment || savingFA) return;
    setSavingFA(true);
    setFAError(null);
    try {
      await updateFingerAssignment({ data: { journey: next } });
      await router.invalidate();
    } catch (err) {
      setFAError(err instanceof Error ? err.message : "Could not save — try again.");
    } finally {
      setSavingFA(false);
    }
  };

  return (
    <section
      id="preferences"
      aria-labelledby="preferences-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="preferences-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Preferences
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          How practice sessions behave by default.
        </p>
      </header>

      <FieldRow
        labelName="Finger assignment"
        labelHint={`for active profile · ${activeProfile.keyboardType}`}
      >
        <div className="flex items-center" style={{ gap: "12px" }}>
          <PillGroup
            options={FA_OPTIONS}
            value={activeProfile.fingerAssignment}
            onChange={handleFAChange}
            disabled={savingFA}
            ariaLabel="Finger assignment"
          />
          {faError ? (
            <span
              role="alert"
              className="text-kerf-text-primary"
              style={{ fontSize: "12px" }}
            >
              {faError}
            </span>
          ) : null}
        </div>
      </FieldRow>

      <FieldRow
        labelName="Default practice mode"
        labelHint="what loads when opening /practice"
      >
        <PillGroup
          options={MODE_OPTIONS}
          value="adaptive"
          disabled
          ariaLabel="Default practice mode"
        />
      </FieldRow>

      <FieldRow
        labelName="Visual keyboard default"
        labelHint="per-session override via Ctrl+K"
      >
        <PillGroup
          options={KB_VISIBILITY_OPTIONS}
          value="visible"
          disabled
          ariaLabel="Visual keyboard default"
        />
      </FieldRow>

      <FieldRow
        labelName="Reduce motion"
        labelHint="disable animations & flashing feedback"
      >
        <div className="flex items-center" style={{ gap: "12px" }}>
          <span
            className="text-kerf-text-tertiary"
            style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}
          >
            off
          </span>
          <ToggleSwitch on={false} disabled ariaLabel="Reduce motion" />
        </div>
      </FieldRow>

      <FieldRow labelName="Sound effects" labelHint="subtle click on keypress">
        <div className="flex items-center" style={{ gap: "12px" }}>
          <span
            className="text-kerf-text-tertiary"
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontStyle: "italic",
            }}
          >
            coming in v2
          </span>
          <ToggleSwitch on={false} disabled ariaLabel="Sound effects" />
        </div>
      </FieldRow>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/sections/PreferencesSection.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/sections/PreferencesSection.tsx
git add src/components/settings/sections/PreferencesSection.tsx
git commit -m "feat(settings): add PreferencesSection (FA edit + 4 disabled fields)"
```

---

## Task 9: `ThemeSection`

**Files:**
- Create: `src/components/settings/sections/ThemeSection.tsx`

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/sections/ThemeSection.tsx`:

```tsx
import { ThemeCard } from "../ThemeCard";

export function ThemeSection() {
  return (
    <section
      id="theme"
      aria-labelledby="theme-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="theme-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Theme
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          Dark mode is the primary experience. Light mode is planned for v2.
        </p>
      </header>

      <div
        className="grid"
        style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "12px" }}
      >
        <ThemeCard label="Dark (default)" badge="active" variant="dark" />
        <ThemeCard label="Light" badge="v2" variant="light" />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/sections/ThemeSection.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/sections/ThemeSection.tsx
git add src/components/settings/sections/ThemeSection.tsx
git commit -m "feat(settings): add ThemeSection (dark active, light v2)"
```

---

## Task 10: `DataSection`

**Files:**
- Create: `src/components/settings/sections/DataSection.tsx`

**Why:** Renders the Export button (disabled) and a per-keyboard reset list pulled from the loader's `profiles` array. Each row is a real keyboard profile with its session count; reset buttons are disabled.

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/sections/DataSection.tsx`:

```tsx
import { COMING_SOON_HINT } from "../InlineEditField";
import { FieldRow } from "../FieldRow";

type DataSectionProps = {
  profiles: ReadonlyArray<{
    id: string;
    keyboardType: string;
    sessionCount: number;
    isActive: boolean;
  }>;
};

function DisabledActionButton({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title={COMING_SOON_HINT}
      className={
        danger
          ? "text-kerf-error border"
          : "text-kerf-text-primary border border-kerf-border-default"
      }
      style={{
        background: "transparent",
        padding: "8px 16px",
        borderRadius: "4px",
        fontSize: "13px",
        fontWeight: 500,
        cursor: "not-allowed",
        opacity: 0.5,
        fontFamily: "var(--font-sans)",
        borderColor: danger ? "rgba(239, 68, 68, 0.3)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

export function DataSection({ profiles }: DataSectionProps) {
  return (
    <section
      id="data"
      aria-labelledby="data-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="data-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Data
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          Export your data, or reset stats for a specific keyboard profile.
        </p>
      </header>

      <FieldRow labelName="Export all data" labelHint="JSON · all keyboards, all sessions">
        <DisabledActionButton>Download JSON</DisabledActionButton>
      </FieldRow>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "12px",
          padding: "16px 0",
        }}
      >
        <div className="flex flex-col" style={{ gap: "2px" }}>
          <span
            className="text-kerf-text-primary"
            style={{ fontSize: "13px", fontWeight: 500 }}
          >
            Reset stats by keyboard
          </span>
          <span
            className="text-kerf-text-tertiary"
            style={{ fontSize: "11px", fontFamily: "var(--font-mono)" }}
          >
            clears sessions & weakness data · does not delete keyboard profile
          </span>
        </div>
        <div className="flex flex-col" style={{ gap: "8px", width: "100%" }}>
          {profiles.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border border-kerf-border-subtle bg-kerf-bg-surface"
              style={{ padding: "12px 16px", borderRadius: "6px" }}
            >
              <div className="flex items-center" style={{ gap: "12px" }}>
                <div
                  aria-hidden="true"
                  className="border border-kerf-border-default bg-kerf-bg-elevated text-kerf-text-tertiary"
                  style={{
                    width: "32px",
                    height: "20px",
                    borderRadius: "3px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: "9px",
                  }}
                >
                  ⊞⊞
                </div>
                <span
                  className="text-kerf-text-primary"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  {p.keyboardType}
                </span>
                <span
                  className="text-kerf-text-tertiary"
                  style={{ fontSize: "11px", marginLeft: "8px" }}
                >
                  {p.sessionCount} {p.sessionCount === 1 ? "session" : "sessions"}
                  {p.isActive ? " · active" : ""}
                </span>
              </div>
              <DisabledActionButton danger>Reset stats</DisabledActionButton>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/sections/DataSection.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/sections/DataSection.tsx
git add src/components/settings/sections/DataSection.tsx
git commit -m "feat(settings): add DataSection (export + per-keyboard reset list, all disabled)"
```

---

## Task 11: `DangerZoneSection`

**Files:**
- Create: `src/components/settings/sections/DangerZoneSection.tsx`

**Why:** Single danger row, button disabled, hover hint promises the eventual flow without claiming it works yet. No modal built (per spec §6 Danger zone — modal lands with the verification flow PR).

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/sections/DangerZoneSection.tsx`:

```tsx
const DELETE_HINT = "coming soon — verified-by-email flow";

export function DangerZoneSection() {
  return (
    <section
      id="danger"
      aria-labelledby="danger-heading"
      style={{ padding: "32px 0" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="danger-heading"
          className="text-kerf-error"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Danger zone
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          Permanent actions. Proceed with care.
        </p>
      </header>

      <div
        style={{
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "8px",
          padding: "24px",
          background: "rgba(239, 68, 68, 0.03)",
        }}
      >
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: "1fr auto", gap: "16px" }}
        >
          <div>
            <div
              className="text-kerf-text-primary"
              style={{ fontSize: "13px", fontWeight: 500, marginBottom: "2px" }}
            >
              Delete account
            </div>
            <div
              className="text-kerf-text-secondary"
              style={{ fontSize: "12px", lineHeight: 1.5 }}
            >
              Permanently deletes your account, all keyboard profiles, stats, and session
              history. This cannot be undone.
            </div>
          </div>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={DELETE_HINT}
            className="text-kerf-error"
            style={{
              background: "transparent",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              padding: "8px 16px",
              borderRadius: "4px",
              fontSize: "13px",
              fontWeight: 500,
              cursor: "not-allowed",
              opacity: 0.6,
              fontFamily: "var(--font-sans)",
            }}
          >
            Delete account
          </button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/sections/DangerZoneSection.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/sections/DangerZoneSection.tsx
git add src/components/settings/sections/DangerZoneSection.tsx
git commit -m "feat(settings): add DangerZoneSection (disabled delete row, no modal)"
```

---

## Task 12: `SettingsLayout`

**Files:**
- Create: `src/components/settings/SettingsLayout.tsx`

**Why:** Holds the page-level grid (`200px 1fr`), the sticky sidebar with anchor links, and the active-section state. Sections are rendered as children — the layout doesn't know what they contain. Sidebar smooth-scroll respects `prefers-reduced-motion`.

- [ ] **Step 1: Write the implementation**

Create `src/components/settings/SettingsLayout.tsx`:

```tsx
import type { ReactNode } from "react";
import { useState } from "react";

type SidebarLink = {
  id: string;
  label: string;
  danger?: boolean;
};

const SIDEBAR_LINKS: ReadonlyArray<SidebarLink> = [
  { id: "account", label: "Account" },
  { id: "preferences", label: "Preferences" },
  { id: "theme", label: "Theme" },
  { id: "data", label: "Data" },
  { id: "danger", label: "Danger zone", danger: true },
];

type SettingsLayoutProps = {
  children: ReactNode;
};

export function SettingsLayout({ children }: SettingsLayoutProps) {
  const [activeId, setActiveId] = useState<string>("account");

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    setActiveId(id);
    const target = typeof document !== "undefined" ? document.getElementById(id) : null;
    if (!target) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  };

  return (
    <main
      id="main-content"
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "32px",
        display: "grid",
        gridTemplateColumns: "200px 1fr",
        gap: "48px",
      }}
    >
      <aside style={{ position: "sticky", top: "128px", alignSelf: "start" }}>
        <h1
          className="text-kerf-text-primary"
          style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}
        >
          Settings
        </h1>
        <p
          className="text-kerf-text-tertiary"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: "24px",
          }}
        >
          preferences & account
        </p>
        <nav
          aria-label="Settings sections"
          className="flex flex-col"
          style={{ gap: "2px" }}
        >
          {SIDEBAR_LINKS.map((link) => {
            const isActive = link.id === activeId;
            return (
              <a
                key={link.id}
                href={`#${link.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={(e) => handleClick(e, link.id)}
                className={
                  "block " +
                  (link.danger
                    ? "text-kerf-error"
                    : isActive
                      ? "text-kerf-amber-base bg-kerf-amber-faint"
                      : "text-kerf-text-secondary hover:text-kerf-text-primary hover:bg-kerf-bg-surface")
                }
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  borderLeft: isActive && !link.danger
                    ? "2px solid var(--lr-amber-base)"
                    : "2px solid transparent",
                  fontWeight: isActive ? 500 : 400,
                  textDecoration: "none",
                  transition: "all 150ms",
                }}
              >
                {link.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <div style={{ minWidth: 0 }}>{children}</div>
    </main>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/settings/SettingsLayout.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/settings/SettingsLayout.tsx
git add src/components/settings/SettingsLayout.tsx
git commit -m "feat(settings): add SettingsLayout (sticky sidebar + content grid)"
```

---

## Task 13: Rewrite `src/routes/settings.tsx`

**Files:**
- Modify: `src/routes/settings.tsx` (full rewrite)

**Why:** Swap the loader from `getActiveProfile` to `getAccountSummary`, swap the page body to `SettingsLayout` + 5 sections. Keep the auth guard. Keep the redirect to `/onboarding` when there's no active profile (now handled inside `getAccountSummary`).

- [ ] **Step 1: Replace the file contents**

Overwrite `src/routes/settings.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import { getAccountSummary, type SettingsData } from "#/server/account";
import { AppFooter } from "#/components/nav/AppFooter";
import { SettingsLayout } from "#/components/settings/SettingsLayout";
import { AccountSection } from "#/components/settings/sections/AccountSection";
import { PreferencesSection } from "#/components/settings/sections/PreferencesSection";
import { ThemeSection } from "#/components/settings/sections/ThemeSection";
import { DataSection } from "#/components/settings/sections/DataSection";
import { DangerZoneSection } from "#/components/settings/sections/DangerZoneSection";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<SettingsData> => getAccountSummary(),
  component: SettingsPage,
});

function SettingsPage() {
  const data = Route.useLoaderData();
  return (
    <>
      <SettingsLayout>
        <AccountSection account={data.account} totalSessions={data.totalSessions} />
        <PreferencesSection activeProfile={data.activeProfile} />
        <ThemeSection />
        <DataSection profiles={data.profiles} />
        <DangerZoneSection />
      </SettingsLayout>
      <AppFooter />
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/routes/settings.tsx`
Expected: clean.

- [ ] **Step 3: Format + commit**

```bash
./node_modules/.bin/biome format --write src/routes/settings.tsx
git add src/routes/settings.tsx
git commit -m "feat(settings): rewrite /settings route to use new layout + sections"
```

---

## Task 14: Route integration test `settings.test.tsx`

**Files:**
- Create: `src/routes/settings.test.tsx`

**Why:** Spec §9 calls for a route-level test that pins the 5 sections render, account email reflects the loader, FA pill shows the active profile, and clicking a different FA pill calls `updateFingerAssignment` with the right payload. Because `createFileRoute` is hard to render in isolation, the test imports the page component directly and stubs the loader hook + the server fn.

- [ ] **Step 1: Write the failing test**

Create `src/routes/settings.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router",
  );
  return {
    ...actual,
    useRouter: () => ({ invalidate: vi.fn().mockResolvedValue(undefined) }),
  };
});

const updateFingerAssignmentMock = vi.fn().mockResolvedValue(undefined);
vi.mock("#/server/profile", () => ({
  updateFingerAssignment: (input: unknown) => updateFingerAssignmentMock(input),
}));

import { SettingsLayout } from "#/components/settings/SettingsLayout";
import { AccountSection } from "#/components/settings/sections/AccountSection";
import { PreferencesSection } from "#/components/settings/sections/PreferencesSection";
import { ThemeSection } from "#/components/settings/sections/ThemeSection";
import { DataSection } from "#/components/settings/sections/DataSection";
import { DangerZoneSection } from "#/components/settings/sections/DangerZoneSection";
import type { SettingsData } from "#/server/account";

afterEach(() => {
  cleanup();
  updateFingerAssignmentMock.mockClear();
});

const fixture: SettingsData = {
  account: {
    email: "user@example.com",
    displayName: null,
    createdAt: new Date("2026-03-12T10:00:00Z").toISOString(),
  },
  totalSessions: 47,
  activeProfile: {
    id: "p1",
    keyboardType: "lily58",
    fingerAssignment: "conventional",
  },
  profiles: [
    { id: "p1", keyboardType: "lily58", sessionCount: 28, isActive: true },
    { id: "p2", keyboardType: "sofle", sessionCount: 19, isActive: false },
  ],
};

function SettingsPageForTest({ data }: { data: SettingsData }) {
  return (
    <SettingsLayout>
      <AccountSection account={data.account} totalSessions={data.totalSessions} />
      <PreferencesSection activeProfile={data.activeProfile} />
      <ThemeSection />
      <DataSection profiles={data.profiles} />
      <DangerZoneSection />
    </SettingsLayout>
  );
}

describe("SettingsPage", () => {
  it("renders all 5 section headings", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Data" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Danger zone" })).toBeTruthy();
  });

  it("shows the loader email in the Account section", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("shows the active-profile FA pill checked", () => {
    render(<SettingsPageForTest data={fixture} />);
    const group = screen.getByRole("radiogroup", { name: "Finger assignment" });
    const pills = group.querySelectorAll('[role="radio"]');
    expect(pills.length).toBe(3);
    const conventional = group.querySelector('[role="radio"][aria-checked="true"]');
    expect(conventional?.textContent).toBe("Conventional");
  });

  it("includes the active-profile keyboard type in the FA hint", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("for active profile · lily58")).toBeTruthy();
  });

  it("calls updateFingerAssignment when a different pill is clicked", async () => {
    render(<SettingsPageForTest data={fixture} />);
    const group = screen.getByRole("radiogroup", { name: "Finger assignment" });
    const columnar = Array.from(group.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === "Columnar",
    ) as HTMLButtonElement;
    fireEvent.click(columnar);
    await waitFor(() => {
      expect(updateFingerAssignmentMock).toHaveBeenCalledTimes(1);
      expect(updateFingerAssignmentMock).toHaveBeenCalledWith({
        data: { journey: "columnar" },
      });
    });
  });

  it("does not call updateFingerAssignment when the already-active pill is clicked", () => {
    render(<SettingsPageForTest data={fixture} />);
    const group = screen.getByRole("radiogroup", { name: "Finger assignment" });
    const conventional = Array.from(group.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === "Conventional",
    ) as HTMLButtonElement;
    fireEvent.click(conventional);
    expect(updateFingerAssignmentMock).not.toHaveBeenCalled();
  });

  it("renders one row per keyboard profile in Data section", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("lily58")).toBeTruthy();
    expect(screen.getByText("sofle")).toBeTruthy();
    expect(screen.getByText(/28 sessions · active/)).toBeTruthy();
    expect(screen.getByText(/19 sessions/)).toBeTruthy();
  });

  it("marks the sidebar nav with aria-label", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
  });

  it("Account anchor is the default-active sidebar link", () => {
    render(<SettingsPageForTest data={fixture} />);
    const accountLink = screen.getByRole("link", { name: "Account" });
    expect(accountLink.getAttribute("aria-current")).toBe("location");
  });

  it("clicking a sidebar link sets aria-current on that link", () => {
    render(<SettingsPageForTest data={fixture} />);
    const themeLink = screen.getByRole("link", { name: "Theme" });
    fireEvent.click(themeLink);
    expect(themeLink.getAttribute("aria-current")).toBe("location");
  });

  it("Theme cards: Dark active, Light v2-disabled", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("Dark (default)")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
  });

  it("Danger zone delete button is disabled", () => {
    render(<SettingsPageForTest data={fixture} />);
    const btn = screen.getByRole("button", { name: "Delete account" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });
});
```

- [ ] **Step 2: Run test to verify it passes (or surfaces real bugs)**

Run: `pnpm test -- src/routes/settings.test.tsx`
Expected: all 12 tests PASS. If any fail, the failure is a real bug in the section components from earlier tasks — fix the component, not the test.

- [ ] **Step 3: Format + lint + commit**

```bash
./node_modules/.bin/biome format --write src/routes/settings.test.tsx
./node_modules/.bin/biome lint src/routes/settings.test.tsx
git add src/routes/settings.test.tsx
git commit -m "test(settings): integration test for /settings (sections + FA edit)"
```

---

## Task 15: Wire `AppNav` cog → `/settings`

**Files:**
- Modify: `src/components/nav/AppNav.tsx`

**Why:** The cog at `kerf-nav-cog` is currently a disabled `<button>` with `aria-label="Settings (coming soon)"` and `title="Settings dropdown lands in Phase 3"`. Per spec §10, replace with a `<Link to="/settings">` and clean up the deferred-state attributes. `Link` is already imported (line 1 of the file).

- [ ] **Step 1: Apply the surgical edit**

In `src/components/nav/AppNav.tsx`, replace the existing cog button:

```tsx
<button
  type="button"
  className="kerf-nav-cog"
  aria-label="Settings (coming soon)"
  disabled
  title="Settings dropdown lands in Phase 3"
>
  ⚙
</button>
```

…with:

```tsx
<Link to="/settings" className="kerf-nav-cog" aria-label="Settings">
  ⚙
</Link>
```

Then update the file-header doc comment (currently lines 14–15: `Avatar + settings cog are visual-only for now (Phase 3 wires the user menu dropdown per IA §5).`) to read:

```
Avatar is visual-only for now (Phase 3 wires the user menu dropdown
per IA §5). Settings cog navigates to /settings.
```

- [ ] **Step 2: Verify typecheck + lint**

Run: `pnpm typecheck && ./node_modules/.bin/biome lint src/components/nav/AppNav.tsx`
Expected: clean. (`Link` is already imported on line 1.)

- [ ] **Step 3: Sanity-check existing AppNav tests**

Run: `pnpm test -- src/components/nav/`
Expected: all PASS. If a test asserts the cog is `disabled` or has `title="Settings dropdown lands in Phase 3"`, update it to assert the cog is a link to `/settings`. (At time of writing, only `AppFooter.test.tsx` exists in `nav/`; the cog is untested.)

- [ ] **Step 4: Format + commit**

```bash
./node_modules/.bin/biome format --write src/components/nav/AppNav.tsx
git add src/components/nav/AppNav.tsx
git commit -m "feat(nav): wire cog icon to /settings"
```

---

## Task 16: README ## Status checkpoint

**Files:**
- Modify: `README.md`

**Why:** CLAUDE.md §B11 — the slice's checkbox lands in the same PR that ships the work.

- [ ] **Step 1: Locate the `## Status` section**

Run: `grep -n "^##" README.md`
Expected: a `## Status` heading. Note its line number and scan the lines below for the phase / area where this slice belongs (likely Phase 4 / "UI" / "Polish" — adapt to whatever exists).

- [ ] **Step 2: Add the ticked entry**

Add this line under the appropriate phase, in the same style as adjacent entries:

```
- [x] Settings page (slice 1 — wireframe shell + Finger Assignment merge)
```

If the existing entries use a different phrasing convention (e.g., task numbers like `Task 4.7`), match that. If unsure which phase the line belongs in, place it under whichever phase contains other route/page entries.

If the file has a `Last updated:` header at the top, bump it to `2026-04-25`.

- [ ] **Step 3: Verify lint** (markdown isn't biome-managed, but a quick eyeball confirms no obvious markdown breakage)

Open `README.md` and confirm the `## Status` section still parses (no broken indentation, no half-edited list).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): tick settings page slice 1 in Status checklist"
```

---

## Task 17: Format + lint sweep, fix drift

**Why:** CLAUDE.md §B12 — every slice must end with `biome format` clean and `biome lint` net-non-positive vs `origin/main`. Catch any drift before opening the PR.

- [ ] **Step 1: Capture pre-slice lint baseline**

Run: `git fetch origin main && ./node_modules/.bin/biome lint . --reporter=summary 2>&1 | tail -3`
Note the diagnostic counts.

Then on `origin/main`: `git stash && git checkout origin/main -- . 2>/dev/null; ./node_modules/.bin/biome lint . --reporter=summary 2>&1 | tail -3; git checkout HEAD -- .; git stash pop 2>/dev/null || true`

(Or simpler: trust that the baseline matches `origin/main`'s state at the time you branched, and just confirm new diagnostics are zero.)

- [ ] **Step 2: Format-check the whole repo**

Run: `./node_modules/.bin/biome format .`
Expected: no diff. If any file in the repo (touched by this slice or pre-existing drift in adjacent files you accidentally re-saved) needs formatting, run:

```bash
./node_modules/.bin/biome format --write .
```

- [ ] **Step 3: If formatting changed any files, commit them as a dedicated mechanical commit**

```bash
git status
# If clean, skip to Step 4.
# If there are format-only changes:
git add -A
git commit -m "chore: biome format sweep"
git rev-parse HEAD >> .git-blame-ignore-revs
git add .git-blame-ignore-revs
git commit -m "chore: register format sweep in .git-blame-ignore-revs"
```

(Per §B12 — separate format commits from semantic ones.)

- [ ] **Step 4: Run full test suite**

Run: `pnpm test`
Expected: all settings-related tests pass. Pre-existing failures in `journey.test.ts`, `motionPatterns.test.ts`, `drillLibrary*.test.ts`, `exerciseGenerator.test.ts` are NOT this slice's responsibility — confirm they predate the branch with `git log -- src/domain/adaptive/journey.test.ts | head` (if they're recent and unrelated, leave them; if they appear caused by something in this slice, fix them).

- [ ] **Step 5: Run typecheck end-to-end**

Run: `pnpm typecheck`
Expected: no new errors introduced by this slice.

- [ ] **Step 6: Manual smoke (optional but recommended for UI work)**

Run: `pnpm dev` (background or new terminal), open `http://localhost:3000/settings`, verify visually:
- [ ] All 5 sections render in the right order
- [ ] Sidebar links smooth-scroll to their sections
- [ ] FA pill click saves and the new pill stays selected after page refresh
- [ ] Disabled controls show `coming soon` on hover
- [ ] Cog in app nav navigates to /settings

If any visual regression vs `design/settings-wireframe.html`, fix and commit before opening the PR.

---

## Self-review checklist (run before opening PR)

- [ ] Spec §1–§13 each map to at least one task above
- [ ] No placeholder text in any committed file (`grep -rn "TODO\|TBD" src/components/settings src/routes/settings.tsx src/server/account.ts`)
- [ ] Every section component renders the correct heading and copy from the wireframe
- [ ] Every disabled control has `aria-disabled="true"`
- [ ] FA save flow round-trips through the existing `updateFingerAssignment` server fn
- [ ] AppNav cog is a real navigation link, not a span
- [ ] README ## Status reflects this slice
- [ ] `biome format` clean, `biome lint` no new diagnostics
- [ ] All slice tests pass (`FieldRow`, `InlineEditField`, `AccountSection`, `settings.test.tsx`)

## Out of scope reminders

Do NOT in this slice:
- Build the delete modal
- Wire any control besides Finger Assignment
- Add a `user_preferences` table or schema migration
- Touch `--lr-*` CSS variable names
- Implement light theme or sound effects
- Convert any pre-existing unrelated tests
