# Settings page — slice 1 design

**Date:** 2026-04-25
**Branch:** `feat/adaptive-engine-tunings` (slice opens a new branch from this)
**Wireframe:** `design/settings-wireframe.html`
**Replaces (in part):** `src/routes/settings.tsx` (current temporary single-section page)
**Status:** approved by user, ready for plan-writing

---

## 1. Context

`src/routes/settings.tsx` today renders a single section — **Finger assignment** — added during the ADR-003 journey-disambiguation work. It exists at `/settings`, has no sidebar, no other sections, and no nav-cog wiring (the cog in `AppNav` is visual-only, with a comment noting "wires the user [page] in Phase 3").

The full settings IA is now designed in `design/settings-wireframe.html`: 5 sections — Account, Preferences, Theme, Data, Danger zone — anchored sidebar, sticky page nav, inline edit fields, pill toggles, theme cards, and a delete-account modal with magic-link verification.

This slice ships the **shell** of that wireframe at 1:1 visual fidelity, plus the existing **Finger Assignment** functionality merged into the Preferences section. Controls without a working backend in this slice are rendered at full visual fidelity but are non-interactive. No new server endpoints, no schema migration.

## 2. Goals & non-goals

**Goals (slice 1):**

- Stand up the full 5-section settings layout matching `settings-wireframe.html` 1:1.
- Merge the existing Finger Assignment edit into the Preferences section (top of section, with active-profile hint).
- Wire the `AppNav` cog icon to `/settings`.
- Surface real data wherever it already exists (email, account-created date, account-wide session count, keyboard profile list).
- Treat every not-yet-wired interactive control honestly (disabled + `coming soon` hover hint), so we never have buttons that look real and silently no-op.

**Non-goals (deferred to future slices):**

- Email change / display name change endpoints (PR2).
- Persisted user preferences for default practice mode, visual KB default, reduce motion (PR3 — needs a new `user_preferences` table or `users` extension).
- JSON data export (PR4).
- Per-keyboard reset stats (PR5).
- Delete-account flow including the modal, `DELETE`-typing confirmation, and magic-link verification (PR6).
- Light theme, sound effects (already labeled `v2` in wireframe).

These are sequenced suggestions, not commitments — each gets its own design + plan when scheduled.

## 3. Decisions made during brainstorming

| Decision | Choice | Why |
|----------|--------|-----|
| Slicing | Wireframe shell + only what's already wired | Honors §A2 "no half-finished implementations" while still letting reviewers see the full IA |
| Finger Assignment placement | Top row of Preferences, hint `for active profile · {kbType}` | Sits naturally with other practice-behavior settings; no IA churn vs. the wireframe |
| Unwired control treatment | Render at full visual fidelity, disable interactivity, `coming soon` hover hint replaces `✎ click to edit` | Preserves 1:1 fidelity AND honesty about what works; same idiom the wireframe already uses for Sound effects |
| Sidebar active highlight | `useState`-based, set on link click, no scroll-spy | Wireframe doesn't have scroll-spy; adding it later is non-breaking |
| Delete modal | Not built in slice 1 | Modal is substantial (warning list, DELETE input, magic-link wiring) — only worth building when its backing is built |

## 4. Architecture

### File layout

```
src/routes/settings.tsx                              # rewritten end-to-end
src/components/settings/SettingsLayout.tsx           # sidebar + content scaffold
src/components/settings/FieldRow.tsx                 # label-left / control-right primitive
src/components/settings/InlineEditField.tsx          # click-to-edit (read-only mode in slice 1)
src/components/settings/PillGroup.tsx                # pill selector primitive
src/components/settings/ToggleSwitch.tsx             # toggle primitive
src/components/settings/ThemeCard.tsx                # theme card
src/components/settings/sections/AccountSection.tsx
src/components/settings/sections/PreferencesSection.tsx
src/components/settings/sections/ThemeSection.tsx
src/components/settings/sections/DataSection.tsx
src/components/settings/sections/DangerZoneSection.tsx
src/server/account.ts                                # new: getAccountSummary
src/components/nav/AppNav.tsx                        # surgical: wire cog → /settings
```

Section components are 40–80 lines each. `FieldRow` carries the wireframe's `200px 1fr` label/control grid so each section reads top-to-bottom without re-declaring layout. `SettingsLayout` is the only place the page-level grid (`200px 1fr` with sticky sidebar) lives.

### Boundaries (per CLAUDE.md §B1)

- All new code lives under `src/components/settings/**`, `src/routes/settings.tsx`, and `src/server/account.ts`.
- No domain logic added in this slice. The only engine-related interaction is the existing `updateFingerAssignment` server function called from the Preferences section.
- The new `src/server/account.ts` is a thin server module — no business logic, just an aggregating read.

### Page composition

```
SettingsPage (route)
└── SettingsLayout
    ├── <aside> sidebar
    │     "Settings" / "preferences & account"
    │     Account · Preferences · Theme · Data · Danger zone
    └── <div> content
          AccountSection         → 3 FieldRows  (email, display name, account created)
          PreferencesSection     → 5 FieldRows  (FA, default mode, KB visibility, reduce motion, sound)
          ThemeSection           → 2 ThemeCards (dark, light)
          DataSection            → 1 FieldRow (export) + ProfileResetList
          DangerZoneSection      → 1 disabled danger row
```

## 5. Data flow

### Loader

Single-trip server fetch via a new `getAccountSummary()` server function:

```ts
type SettingsData = {
  account: {
    email: string;
    displayName: string | null;
    createdAt: Date;
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
```

`getAccountSummary` reads the auth session, then issues one user query, one keyboardProfiles + sessions count join, and returns the aggregate. If no active profile, the route redirects to `/onboarding` (same guard the current temp page uses).

### Local state

- `editingFA: boolean`, `faChoice: JourneyCode`, `savingFA: boolean`, `faError: string | null` — scoped to `PreferencesSection`, mirrors the pattern in today's `settings.tsx`.
- `activeSectionId: string` — sidebar highlight, set on link click. Default to `'account'` on mount.

### Server contract

- **Reused (no change):** `updateFingerAssignment({ data: { journey } })` from `src/server/profile.ts`.
- **Reused (no change):** `getAuthSession`, `getActiveProfile`.
- **New:** `getAccountSummary()` in `src/server/account.ts` — single function, no inputs (uses session).

No new endpoints for change-email, change-name, delete, export, reset.

## 6. Section-by-section behavior

### Account
| Field | Source | Slice 1 behavior |
|-------|--------|------------------|
| Email | `users.email` | Display value, hover hint = `coming soon` |
| Display name | `users.name` (nullable) | Display value or `— not set` (muted), hover hint = `coming soon` |
| Account created | `users.createdAt` + `totalSessions` | Read-only display: `March 12, 2026 · 47 sessions logged` |

### Preferences
| Field | Slice 1 behavior |
|-------|------------------|
| **Finger assignment** (NEW position #1) | Pill group `Conventional · Columnar · Unsure`, active reflects `keyboardProfiles.fingerAssignment` of active profile, hint = `for active profile · {kbType}`. Click pill → save → `router.invalidate()`. Same edit/save pattern as today's settings page, compressed into pill style. |
| Default practice mode | Pill group `Adaptive · Drill · Ask each time`, "Adaptive" highlighted (current de facto default), pills disabled. |
| Visual keyboard default | Pill group `Visible · Hidden`, "Visible" highlighted, disabled. |
| Reduce motion | Toggle in off position, disabled. (Note: site already respects `prefers-reduced-motion` per §B4 — this toggle is a future explicit override.) |
| Sound effects | As wireframe — `coming in v2` text + 0.4-opacity disabled toggle. |

### Theme
| Card | Slice 1 behavior |
|------|------------------|
| Dark | `active` border, "active" badge. Not clickable. |
| Light | `disabled` styling, `v2` badge. Not clickable. |

### Data
| Item | Slice 1 behavior |
|------|------------------|
| Export all data | Button visible, disabled, hover hint = `coming soon`. |
| Reset stats by keyboard | Real list pulled from `keyboardProfiles` (icon + `keyboardType` + `sessionCount` + `· active` if `isActive`), each row has a disabled `Reset stats` button. |

### Danger zone
- Single row: "Delete account" with the wireframe's description copy. Disabled button, hover hint = `coming soon — verified-by-email flow`.
- **No modal built.** The modal lives in PR6 alongside the magic-link deletion flow.

## 7. Copy & tone

All copy from the wireframe is used verbatim — it already complies with §B3 (no hype, no exclamations, no scores).

Two new strings introduced in slice 1:

- `for active profile · {kbType}` — Finger Assignment hint.
- `coming soon` — disabled-control hover hint, used in 7 places. Extracted as a single `COMING_SOON_HINT` constant in `src/components/settings/InlineEditField.tsx` (or a small `src/components/settings/copy.ts` if more placeholder strings show up).

The Danger zone button keeps a longer hint: `coming soon — verified-by-email flow` — to make the eventual UX visible without claiming it now.

## 8. Accessibility

- `<nav aria-label="Settings sections">` wraps the sidebar links.
- Sidebar links use `aria-current="location"` on the active anchor.
- All disabled controls have `aria-disabled="true"` (preferred to `disabled` on non-button elements).
- All interactive icons have visible accessible names — no icon-only buttons.
- Danger button retains a focus indicator even in its disabled state so keyboard users can locate it.
- Sidebar smooth scroll uses `behavior: prefers-reduced-motion ? 'auto' : 'smooth'`.
- Color contrast verified against existing tokens — no new tokens introduced (per §B5, `--lr-*` prefix retained as known tech debt).

## 9. Testing

| Test file | Coverage |
|-----------|----------|
| `src/routes/settings.test.tsx` | Renders all 5 sections; account email reflects loader; FA pill reflects active profile; FA edit calls `updateFingerAssignment` with expected payload; sidebar link click sets `aria-current`. |
| `src/components/settings/FieldRow.test.tsx` | Smoke render — label + control slot. |
| `src/components/settings/InlineEditField.test.tsx` | Read-only mode renders value; disabled mode shows `coming soon` hint on hover; no edit affordance when disabled. |
| `src/components/settings/sections/AccountSection.test.tsx` | Formats `createdAt` + `totalSessions` correctly; renders `— not set` when displayName is null. |

No e2e per §B8. Manual QA for the main flow.

## 10. AppNav surgical change

`src/components/nav/AppNav.tsx` line 59 currently renders `className="kerf-nav-cog"` as a non-interactive `<span>` (per the comment on line 14: "Avatar + settings cog are visual-only for now (Phase 3 wires the user…)").

Change: replace the cog `<span>` with a `<Link to="/settings" aria-label="Settings">`, keep the same `kerf-nav-cog` class. Update the line-9 / line-14 comments to reflect that the cog now navigates. Keep the avatar visual-only (it's not in scope here).

## 11. README ## Status checklist

This slice is not currently tracked in `README.md ## Status` (per quick scan — verify before PR). Add a line under the appropriate phase:

```
- [x] Settings page (slice 1 — wireframe shell + Finger Assignment merge)
```

…and tick it as part of the same PR (per §B11).

## 12. Format & lint

Per §B12 — `pnpm format` clean, `pnpm lint` delta vs main ≈ 0 before PR. New components conform to existing patterns (Tailwind classes + scoped inline styles where the wireframe specifies non-tokenizable values, matching the current `settings.tsx` style).

Per §B13 — pnpm only. No `npm install`. No `package-lock.json` on the working tree.

## 13. Out of scope for slice 1 (sequenced suggestions, not commitments)

| Slice | Theme | Notes |
|-------|-------|-------|
| PR2 | Account editing | Better-auth email-change flow + name-change endpoint. Wires the existing `InlineEditField` component to its editable mode. |
| PR3 | Preferences persistence | New `user_preferences` table or extend `users`. Wires default practice mode, visual KB default, reduce motion. |
| PR4 | Data export | Server endpoint that streams user data as JSON. Wires the Export button. |
| PR5 | Per-keyboard reset stats | Server endpoint that deletes from `character_stats`, `bigram_stats`, `sessions` for one profile. Wires the reset buttons. |
| PR6 | Delete account | Better-auth delete-user flow with magic-link verification. Builds the delete modal, wires the danger button. |
| v2 | Light theme, sound effects | Already labeled `v2` in wireframe. |

---

## Open questions for the implementation plan

None blocking. The implementation plan should:

1. Confirm the section component split before writing them (3-section + 2-section vs 5-files vs 1-file).
2. Decide whether `COMING_SOON_HINT` lives in `InlineEditField.tsx` or a shared `copy.ts` based on how many call-sites land outside `InlineEditField`.
3. Verify `getAccountSummary` query plan (one query or two) once it's written.
