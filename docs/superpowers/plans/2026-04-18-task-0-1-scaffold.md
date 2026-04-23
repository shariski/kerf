# Task 0.1: kerf Project Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap a Tanstack Start project in the existing kerf git repo, wired with kerf's design tokens, self-hosted font declarations, and a hello world page that proves the full stack resolves.

**Architecture:** CLI-scaffolded Tanstack Start (Vite + Tanstack Router + Nitro) with Tailwind v4 CSS-first `@theme` config. All 40+ design tokens live in a single `@theme` block in the global stylesheet. The hello world page is the root route only — no other routes, no domain logic.

**Tech Stack:** Tanstack Start · React · TypeScript strict · Tailwind CSS v4 · Inter · JetBrains Mono · Fraunces (variable)

**Working directory:** `/Users/falah/Work/kerf` (this is the git repo root — docs/ and design/ already exist here)

---

### Task 1: Probe CLI availability and scaffold the project

**Files:**
- Create: all Tanstack Start project files (at repo root or moved there from subdir)

The existing repo root already has `docs/` and `design/`. The scaffold should live at the repo root, not in a nested `kerf/kerf/` subdirectory. Steps below handle both CLI variants and directory placement.

- [ ] **Step 1.1: Check which CLI is available**

Run from `/Users/falah/Work/kerf/`:
```bash
npx --yes @tanstack/cli@latest --version 2>&1
```
Expected: a version number like `1.x.x`.

If that fails, try:
```bash
npx --yes create-tsrouter-app@latest --version 2>&1
```

Note which one succeeds — you need it for Step 1.2.

- [ ] **Step 1.2: Scaffold to a temp directory**

Pick whichever CLI worked in Step 1.1.

**Option A — @tanstack/cli:**
```bash
cd /tmp && npx @tanstack/cli@latest create kerf-scaffold
```
When prompted:
- Name: `kerf-scaffold` (temporary — we rename later)
- Framework: React
- Tailwind: **yes** (critical — select this add-on)
- Router mode: file-based
- Other add-ons: none

**Option B — create-tsrouter-app (fallback):**
```bash
cd /tmp && npx create-tsrouter-app@latest kerf-scaffold --template react --tailwind --file-router
```

After scaffold completes:
```bash
ls /tmp/kerf-scaffold/
```
Expected: `package.json`, `tsconfig.json`, one of `app/` or `src/`, `public/`, config files.

- [ ] **Step 1.3: Map the scaffold's actual structure**

```bash
ls /tmp/kerf-scaffold/
find /tmp/kerf-scaffold -name "*.css" | sort
find /tmp/kerf-scaffold -name "index.tsx" -o -name "__root.tsx" | sort
```

Note the answers to:
1. Is the routes directory `app/routes/` or `src/routes/`? (determines all downstream paths)
2. Where is the global stylesheet? (e.g., `app/styles/app.css` or `src/styles.css`)
3. Is Tailwind wired via `@import "tailwindcss"` in the CSS, or via a plugin in vite config?

These paths inform every subsequent task. Write them down before continuing.

- [ ] **Step 1.4: Move scaffold files into the kerf repo root**

```bash
cd /tmp/kerf-scaffold
cp -r . /Users/falah/Work/kerf/
cd /Users/falah/Work/kerf
ls
```

Expected: `docs/`, `design/`, `package.json`, `tsconfig.json`, `app/` (or `src/`), `public/`, config files all present.

If the CLI already created a nested `kerf/` directory (some CLIs do this), move its contents up:
```bash
# Only if a nested kerf/ dir was created:
cp -rn kerf/. .
rm -rf kerf/
```

- [ ] **Step 1.5: First boot verification**

```bash
cd /Users/falah/Work/kerf
npm install
npm run dev &
```

Wait ~10 seconds, then open `http://localhost:3000` in a browser. Expected: the scaffolder's default hello world page renders (any content — just proving the dev server works).

Kill the dev server: `kill %1`

- [ ] **Step 1.6: Commit the raw scaffold**

```bash
cd /Users/falah/Work/kerf
git add .
git commit -m "chore: scaffold tanstack start project (Task 0.1)"
```

---

### Task 2: Add kerf color tokens to the Tailwind theme

**Files:**
- Modify: `app/styles/app.css` **or** `src/styles.css` (whichever Step 1.3 identified)

In Tailwind v4, tokens are registered via `@theme {}` in CSS. `--color-kerf-*` properties automatically become `bg-kerf-*`, `text-kerf-*`, `border-kerf-*` utility classes.

- [ ] **Step 2.1: Open the global stylesheet and find the Tailwind import**

Read the global stylesheet. It should contain `@import "tailwindcss";` or `@tailwind base; @tailwind components; @tailwind utilities;`.

If the scaffolder used a JS-based Tailwind config (v3-style `tailwind.config.ts`), note this — it means Tailwind v4 wasn't used and the approach differs. Surface this discrepancy before continuing (per Task 0.1 instructions).

- [ ] **Step 2.2: Add the full kerf `@theme` block**

Add this block after the Tailwind import line in the global stylesheet. If a `@theme {}` block already exists, merge into it rather than creating a duplicate.

```css
@theme {
  /* ── Background layers ── */
  --color-kerf-bg-base:     #181410;
  --color-kerf-bg-surface:  #221C17;
  --color-kerf-bg-elevated: #2A2320;
  --color-kerf-bg-overlay:  #322A26;

  /* ── Text ── */
  --color-kerf-text-primary:   #F2EAE0;
  --color-kerf-text-secondary: #9A8E80;
  --color-kerf-text-tertiary:  #685D52;
  --color-kerf-text-inverse:   #181410;

  /* ── Borders ── */
  --color-kerf-border-subtle:  #2F2820;
  --color-kerf-border-default: #3A3128;
  --color-kerf-border-strong:  #4A3F35;

  /* ── Amber accent ── */
  --color-kerf-amber-base:    #F59E0B;
  --color-kerf-amber-hover:   #FBBF24;
  --color-kerf-amber-pressed: #D97706;
  --color-kerf-amber-subtle:  rgba(245, 158, 11, 0.15);
  --color-kerf-amber-faint:   rgba(245, 158, 11, 0.08);

  /* ── Semantic: success ── */
  --color-kerf-success-base:   #22C55E;
  --color-kerf-success-subtle: rgba(34, 197, 94, 0.15);

  /* ── Semantic: error ── */
  --color-kerf-error-base:   #EF4444;
  --color-kerf-error-subtle: rgba(239, 68, 68, 0.15);

  /* ── Semantic: warning ── */
  --color-kerf-warning-base:   #EAB308;
  --color-kerf-warning-subtle: rgba(234, 179, 8, 0.15);

  /* ── Semantic: info ── */
  --color-kerf-info-base:   #3B82F6;
  --color-kerf-info-subtle: rgba(59, 130, 246, 0.15);

  /* ── Finger colors: left hand (earth tones) ── */
  --color-kerf-finger-l-pinky:  #C2410C;
  --color-kerf-finger-l-ring:   #A16207;
  --color-kerf-finger-l-middle: #65A30D;
  --color-kerf-finger-l-index:  #15803D;

  /* ── Finger colors: right hand (sky tones) ── */
  --color-kerf-finger-r-index:  #0E7490;
  --color-kerf-finger-r-middle: #1D4ED8;
  --color-kerf-finger-r-ring:   #6D28D9;
  --color-kerf-finger-r-pinky:  #A21CAF;

  /* ── Finger colors: thumbs ── */
  --color-kerf-finger-thumb: #6B7280;

  /* ── Heatmap ramp ── */
  --color-kerf-heat-0: transparent;
  --color-kerf-heat-1: rgba(245, 158, 11, 0.15);
  --color-kerf-heat-2: rgba(245, 158, 11, 0.35);
  --color-kerf-heat-3: rgba(239, 68, 68, 0.45);
  --color-kerf-heat-4: rgba(239, 68, 68, 0.75);

  /* ── Typography ── */
  --font-sans:  "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:  "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  --font-brand: "Fraunces", Georgia, serif;
}
```

- [ ] **Step 2.3: Set Inter as the default body font**

Add after the `@theme` block:
```css
html, body {
  font-family: var(--font-sans);
  background-color: var(--color-kerf-bg-base);
  color: var(--color-kerf-text-primary);
}
```

- [ ] **Step 2.4: Boot and spot-check token resolution**

```bash
npm run dev &
```

Open browser DevTools on `http://localhost:3000`. In Elements → Computed, confirm `--color-kerf-bg-base` resolves to `#181410`. The page background should be dark espresso.

Kill dev server: `kill %1`

- [ ] **Step 2.5: Commit tokens**

```bash
git add .
git commit -m "feat(design): add kerf color tokens to tailwind theme"
```

---

### Task 3: Add font-face declarations

**Files:**
- Modify: same global stylesheet as Task 2
- Create: `public/fonts/.gitkeep` (placeholder; actual woff2 files are downloaded separately)

- [ ] **Step 3.1: Create the fonts placeholder directory**

```bash
mkdir -p public/fonts
touch public/fonts/.gitkeep
```

Add a comment file so future sessions know what belongs here:

Create `public/fonts/README.md`:
```
# Font files

This directory holds self-hosted variable font files.

Required files (download from their respective sources):
- Inter-Variable.woff2     → https://rsms.me/inter/ or Google Fonts
- JetBrainsMono-Variable.woff2 → https://www.jetbrains.com/lp/mono/
- Fraunces-Variable.woff2  → https://github.com/undercasetype/Fraunces

Place .woff2 files here and they will be served from /fonts/*.
All three @font-face declarations are already in the global stylesheet.
```

- [ ] **Step 3.2: Add @font-face declarations to the global stylesheet**

Add this block BEFORE the `@theme` block in the global stylesheet (font faces must load before theme references them):

```css
/* TODO: Place the actual .woff2 files in public/fonts/ before deploying.
   Until then, fonts fall back to system stacks declared in @theme.
   See public/fonts/README.md for download sources. */

@font-face {
  font-family: "Inter";
  src: url("/fonts/Inter-Variable.woff2") format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "JetBrains Mono";
  src: url("/fonts/JetBrainsMono-Variable.woff2") format("woff2-variations");
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: "Fraunces";
  /* Fraunces is a variable font with axes: wght, opsz, SOFT, WONK */
  src: url("/fonts/Fraunces-Variable.woff2") format("woff2-variations");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
  /* Variable axes supported: opsz (9–144), SOFT (0–100), WONK (0–1) */
}
```

- [ ] **Step 3.3: Commit font setup**

```bash
git add .
git commit -m "feat(design): add font-face declarations for Inter, JetBrains Mono, Fraunces"
```

---

### Task 4: Build the kerf hello world page

**Files:**
- Modify: `app/routes/index.tsx` **or** `src/routes/index.tsx` (whichever Step 1.3 identified)

The root route renders the kerf wordmark (`kerf.` with amber period) on dark espresso background. Nothing else.

- [ ] **Step 4.1: Replace root route with kerf hello world**

Replace the entire contents of the root route file with:

```tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="min-h-screen bg-kerf-bg-base flex items-center justify-center flex-col gap-3">
      {/* Wordmark: Fraunces 700, opsz 144, SOFT 100, 48px */}
      <h1
        className="text-kerf-text-primary tracking-tight select-none"
        style={{
          fontFamily: "var(--font-brand)",
          fontWeight: 700,
          fontSize: "48px",
          lineHeight: 1.1,
          fontVariationSettings: '"opsz" 144, "SOFT" 100',
          letterSpacing: "-0.02em",
        }}
      >
        kerf
        <span className="text-kerf-amber-base">.</span>
      </h1>

      {/* Sanity caption: JetBrains Mono, tertiary text */}
      <p
        className="text-kerf-text-tertiary"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          letterSpacing: "0.04em",
        }}
      >
        v0 · tanstack start scaffolding ok
      </p>
    </main>
  );
}
```

- [ ] **Step 4.2: Boot and verify visually**

```bash
npm run dev &
```

Open `http://localhost:3000`. Confirm:
- [ ] Page background is dark espresso (near-black, warm tone — `#181410`)
- [ ] The word `kerf` is visible in a serif font (Fraunces if woff2 present, fallback serif if not)
- [ ] The trailing `.` is amber (`#F59E0B`)
- [ ] The caption `v0 · tanstack start scaffolding ok` is visible in small muted text below

Kill dev server: `kill %1`

- [ ] **Step 4.3: Commit hello world**

```bash
git add .
git commit -m "feat(home): render kerf wordmark on root route"
```

---

### Task 5: Harden TypeScript config

**Files:**
- Modify: `tsconfig.json`

- [ ] **Step 5.1: Read current tsconfig.json**

Read the scaffolder's `tsconfig.json`. It likely has `strict: true` already. We need to add `noUncheckedIndexedAccess` and verify module resolution settings.

- [ ] **Step 5.2: Merge required compiler options**

Ensure `compilerOptions` contains at minimum (merge with existing, do not replace wholesale):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "jsx": "react-jsx",
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "skipLibCheck": true
  }
}
```

**Critical**: do NOT add `verbatimModuleSyntax: true` — per Tanstack Start docs this causes server/client bundle leakage.

If the scaffolder set `moduleResolution: "Node"` or `"Node16"`, change it to `"Bundler"`.

- [ ] **Step 5.3: Run typecheck**

```bash
npm run typecheck 2>&1 | head -40
```

Expected: `0 errors`. If errors appear, fix them before continuing. Common issues:
- Missing `@types/react` — run `npm install -D @types/react @types/react-dom`
- `noUncheckedIndexedAccess` causing new errors in scaffolded code — fix those specific accesses with non-null assertions or guards

---

### Task 6: Update package.json scripts and engines field

**Files:**
- Modify: `package.json`

- [ ] **Step 6.1: Read current package.json scripts**

Read `package.json`. The scaffolder typically provides `dev`, `build`, `start`. Note what's there.

- [ ] **Step 6.2: Add missing scripts and engines field**

Ensure the following are present (merge with existing; do not remove scaffolder's scripts):

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=22"
  }
}
```

If `lint` is missing (some scaffolders call it `lint:check` or `check`), add an alias:
```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx"
  }
}
```
(Adapt the command to whatever linter the scaffolder installed — check `devDependencies` for `eslint`, `biome`, or `oxlint`.)

- [ ] **Step 6.3: Verify lint and typecheck pass**

```bash
npm run typecheck
npm run lint
```

Expected: both exit with code 0. Fix any lint errors before committing. Common lint errors from fresh scaffolds: unused imports in scaffolded files, missing `key` props in lists, etc.

---

### Task 7: Verify .gitignore

**Files:**
- Modify: `.gitignore` (if entries are missing)

- [ ] **Step 7.1: Read .gitignore and identify gaps**

Read `.gitignore`. Verify these entries are present:

```
node_modules/
.env
.env.*
!.env.example
dist/
.output/
.nitro/
.tanstack/
.DS_Store
Thumbs.db
.idea/
```

Note: `.env.example` must NOT be gitignored (it's safe to commit as a template).

- [ ] **Step 7.2: Add any missing entries**

If any entries from Step 7.1 are missing, add them. Particularly check for `.output/` and `.nitro/` — these are Nitro build artifacts that scaffolders sometimes miss.

---

### Task 8: Write kerf-specific README

**Files:**
- Overwrite: `README.md`

- [ ] **Step 8.1: Replace README with kerf content**

Overwrite `README.md` with exactly this content (update port if dev server uses something other than 3000):

```markdown
# kerf

Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first.

kerf is a typing platform specifically designed for people migrating from row-staggered QWERTY to split columnar keyboards (Sofle and Lily58 in MVP). It treats split keyboard adoption as a distinct learning journey with its own pain points, not as a generic "learn to type faster" program.

## Stack

See `docs/01-product-spec.md §9` for the full rationale. Quick list:

- **Framework**: Tanstack Start (Vite + Tanstack Router + Nitro)
- **Language**: TypeScript (strict)
- **UI**: React + Tailwind CSS v4
- **State**: Zustand
- **ORM**: Drizzle + PostgreSQL 16
- **Auth**: better-auth (magic link + GitHub + Google OAuth)
- **Email**: Resend (prod) / console log (local)

## Prerequisites

- **Node.js** 22 LTS (`node --version` should show `v22.x.x`)
- **Docker** (for Task 0.2 local database setup)

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000

Other scripts:
```bash
npm run build       # production build
npm run start       # production preview
npm run typecheck   # tsc --noEmit
npm run lint        # linter
```

## Documentation

| File | Description |
|------|-------------|
| `docs/01-product-spec.md` | Product positioning, core values, feature list, tech stack |
| `docs/02-architecture.md` | Data model, adaptive engine algorithm, module layout |
| `docs/03-task-breakdown.md` | Phase-by-phase task list for Claude Code sessions |
| `docs/04-design-system.md` | Color tokens, typography, spacing, component specs |
| `docs/05-information-architecture.md` | 7-route IA, navigation patterns |
| `docs/06-design-summary.md` | Single source of truth for locked design decisions |

## Status

- [x] Phase 0 / Task 0.1: Tanstack Start scaffold + design tokens + hello world
- [ ] Phase 0 / Task 0.2: Local database setup (Drizzle + PostgreSQL)
- [ ] Phase 0 / Task 0.3: Auth infrastructure (better-auth)
- [ ] Phase 1: Adaptive engine domain logic
```

- [ ] **Step 8.2: Commit README**

```bash
git add README.md
git commit -m "docs: write kerf-specific README"
```

---

### Task 9: Final acceptance verification

No new files. Verifying all acceptance criteria from the task spec.

- [ ] **Step 9.1: Clean install and dev server**

```bash
rm -rf node_modules
npm install
npm run dev &
```

Open `http://localhost:3000`. Walk through the visual checklist:
- [ ] Page background is dark espresso (`#181410`)
- [ ] `kerf` wordmark renders in serif (Fraunces or system serif fallback)
- [ ] Trailing `.` is amber
- [ ] Caption `v0 · tanstack start scaffolding ok` is visible in small muted text
- [ ] No console errors in browser DevTools

Kill dev server: `kill %1`

- [ ] **Step 9.2: Typecheck**

```bash
npm run typecheck
```
Expected: `0 errors`. If errors exist, fix them now.

- [ ] **Step 9.3: Lint**

```bash
npm run lint
```
Expected: exit code 0. Fix any errors.

- [ ] **Step 9.4: Check .gitignore is working**

```bash
git status
```
Expected: no `node_modules/`, no `.env`, no `.output/` listed as untracked.

- [ ] **Step 9.5: Divergence notes (if any)**

If the CLI produced a folder structure that differs from `docs/02-architecture.md §5` (e.g., uses `app/` instead of `src/`), create `NOTES.md` at repo root noting the divergence:

```markdown
# Implementation Notes

## Task 0.1 — Scaffold divergences from docs/02-architecture.md

- Routes directory: `app/routes/` (docs show `src/routes/`)
- Global stylesheet: `app/styles/app.css` (docs show `src/styles.css`)
- [add any others]

These will be reconciled in a future task if needed, or docs will be updated.
```

Commit if NOTES.md was created:
```bash
git add NOTES.md && git commit -m "docs: note scaffold structure divergences from architecture spec"
```

- [ ] **Step 9.6: Final status check**

```bash
git log --oneline -6
git status
```

Expected git log (approximately):
```
... docs: write kerf-specific README
... feat(home): render kerf wordmark on root route
... feat(design): add font-face declarations for Inter, JetBrains Mono, Fraunces
... feat(design): add kerf color tokens to tailwind theme
... chore: scaffold tanstack start project (Task 0.1)
... (prior commits from docs/design work)
```

Expected status: clean (nothing to commit).

---

## Self-review against spec

### Spec coverage check

| Requirement | Task |
|-------------|------|
| Tanstack Start scaffold via CLI | Task 1 |
| `npm install` works | Task 1.5 |
| `npm run dev` → localhost renders | Task 4.2 |
| Dark espresso background | Task 2.3 + Task 4.1 |
| kerf wordmark in Fraunces | Task 4.1 |
| Amber trailing period | Task 4.1 |
| All color tokens in `@theme` | Task 2.2 |
| `@font-face` for Inter, JBMono, Fraunces | Task 3.2 |
| `font-display: swap` on all faces | Task 3.2 ✓ |
| Fraunces supports `opsz` + `SOFT` axes | Task 3.2 ✓ (`font-variation-settings` in 4.1) |
| Placeholder paths + TODO comment | Task 3.1–3.2 |
| Fonts registered in `@theme` (`--font-*`) | Task 2.2 |
| `tsconfig.json` strict + `noUncheckedIndexedAccess` | Task 5.2 |
| No `verbatimModuleSyntax` | Task 5.2 ✓ |
| `moduleResolution: "Bundler"` | Task 5.2 |
| `typecheck` script | Task 6.2 |
| `engines.node: ">=22"` | Task 6.2 |
| `.gitignore` covers Nitro artifacts | Task 7 |
| `README.md` with kerf content | Task 8 |
| No extra routes beyond `/` | All tasks — scope guard |
| No DB, auth, domain logic | All tasks — scope guard |

### Placeholder scan

No TBD or placeholder content in code steps. All CSS values are exact hex/rgba from `docs/04-design-system.md §2`. Font paths match the placeholder convention in the task spec.

### Type consistency

- `createFileRoute("/")` — standard Tanstack Router API, consistent with scaffolded router config
- `fontVariationSettings` — inline style prop (React), not a class — avoids Tailwind v4 friction with variable font axes
- `var(--font-brand)` — matches `--font-brand` defined in Task 2.2 `@theme` block
- `text-kerf-amber-base` — maps to `--color-kerf-amber-base` registered in Task 2.2
