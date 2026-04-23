# Handoff: small-fixes session (post-ADR-003)

I'm handing off a fresh Claude session in `kerf` to work through a backlog of small polish items and real bug fixes. Phase 5 (ADR-003 deliberate-practice architecture) is fully shipped; the big feature work is done. This session is about loose ends, not new features. Read this whole prompt before doing anything.

## Anchor

- **Repo**: `/Users/falah/Work/kerf` (branch `main`, worktrees under `.worktrees/`)
- **Canonical docs** (read when needed, not upfront):
  - `CLAUDE.md` — Parts A + B behavioral guidelines, including recent additions §B12 (lint/format discipline), §B13 (pnpm). Loaded automatically each session.
  - `README.md` `## Status` — ticked through Phase 5 / Task 5.8. Next on the roadmap is Phase 4 Task 4.6 (deployment artifacts) but **that is NOT this session's scope.**
  - `docs/00-design-evolution.md` ADR-003 — product intent for the deliberate-practice architecture that just shipped.
  - `docs/03-task-breakdown.md` — numbered task list; last updated 2026-04-23.
- **Package manager**: **pnpm** (see CLAUDE.md §B13). `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm typecheck`. NEVER `npm install`.
- **Baselines on `origin/main` (post-PR #59):**
  - Typecheck: clean
  - Tests: 769 passing + 1 pre-existing Playwright failure (`tests/a11y.spec.ts`)
  - Lint: 47 errors / 139 warnings / 27 infos
  - Format: clean
- **Current session status**: no work in progress. Fresh start from main.

## What shipped in the last session

ADR-003 implementation landed across 12 PRs (#48 through #59). All merged. The product now has the full three-stage session loop (briefing → active with ribbon + keyboard ring + in-text target-char coloring → post-session intent echo + per-key breakdown + next-target preview), engine journey weighting, session persistence with `session_targets` rows, Settings journey toggle, transparency reframe, and Biome lint/format tooling. PR #58 specifically added text-in-typing-area coloring for target-key chars, complementing the keyboard-SVG ivory ring from PR #56. PR #59 was a package-manager cleanup (npm → pnpm) that resolved a runtime crash caused by hybrid lockfiles.

Auto-memory (`/Users/falah/.claude/projects/-Users-falah-Work-kerf/memory/`) has two project memories worth reading before acting:
- `project_prelaunch_status.md` — kerf has no real users. "Migration/backfill/legacy-cohort" features are speculative over-engineering and should be challenged before building.
- `project_superpowers_gitignored.md` — `docs/superpowers/` is gitignored; never `git add` that path.

## What this session is about: the "small things"

Below is a prioritized list of known-issue candidates. **The user will add their own from recent smoke-testing before the session actually starts — check for an "Additional items from smoke test" section below, or ask.** Don't blaze through this list top to bottom; pick what matches the user's priority.

### 1. Confirm PR #58 text-coloring works visually (~5 min)

PR #58 added in-text coloring for target-key chars in the typing area. Implementation looks correct (tests pass, CSS rules present) but user hadn't visually confirmed at last check. The pnpm cleanup in PR #59 may have been masking this.

**Check**: `pnpm dev` → `/practice` → start an adaptive session. When the briefing shows target keys (e.g. W/S/X or a bigram like "yd"), hit Start. In the typing text, those target chars should render visibly brighter than surrounding chars (they get `var(--color-kerf-text-primary)` + `font-weight: 500`, versus upcoming default `var(--color-kerf-text-tertiary)` + weight 400 — #F2EAE0 vs #685D52 is a large delta).

If visible: tick this off, move on. If not: inspect `.kerf-typing-target` class via DevTools — either the class isn't being applied (prop not reaching component) or CSS specificity issue.

### 2. Playwright a11y test has been broken since Phase 4 (~20-60 min)

`tests/a11y.spec.ts` has been failing across every PR since late Phase 4 with:

> "You have two different versions of @playwright/test"

Classic symptom of duplicate dep resolution. The PR #59 pnpm cleanup plausibly fixed this (single coherent resolution from CAS), but no one has verified. Just run:

```bash
pnpm exec playwright install        # in case browsers need re-pull
pnpm run test:a11y
```

If it passes now: ticket closed, document in a small `chore: confirm a11y suite green` PR (no code change, maybe just bump a date comment or Playwright config tidy). If it still fails, investigate the version mismatch — probably `@playwright/test` is installed both directly and as a transitive of `@axe-core/playwright`. `pnpm why @playwright/test` will show the tree.

**Why this matters**: a11y regressions have been silent for weeks. Restoring this before any UX polish work means we catch new issues early.

### 3. Replace `frequencyInLanguage` stub from Task 17 (~30-45 min)

`src/routes/practice.tsx` and `src/routes/practice_.drill.tsx` both call `generateSession({ ..., frequencyInLanguage: () => 0.5 })` — a uniform-frequency stub with a TODO comment next to it. Grep for `frequencyInLanguage:` to find both callsites.

**What's needed**: a real lookup function that, given a char or bigram, returns its frequency in the user's corpus. The corpus is already loaded client-side via `useCorpus()` and each `CorpusWord` has a `freqRank` field, but there's no per-char/per-bigram aggregate.

**Options**:
- (a) Add a `buildFrequencyLookup(corpus): (unit: string) => number` pure function in `src/domain/corpus/` that precomputes char and bigram totals across the corpus at load time, returns a closure that reads from a Map. Memoize per corpus.
- (b) Skip for Phase A — the DELTA coefficient in `weaknessScore` dominates for practical weakness scoring, so the frequency term is mostly a tie-breaker. Bump the TODO to Phase B explicitly.

Brainstorm with the user before implementing. (a) is cleaner architecturally; (b) is honest about priorities for a pre-launch app with no data yet.

### 4. Lint baseline reduction (pick one chunk; ~30-60 min each)

Current baseline: 47 errors / 139 warnings / 27 infos. Broken down:

| Rule | Count | Severity | Approach |
|---|---|---|---|
| `style/noNonNullAssertion` | ~134 | warning | **Policy decision, not a sweep.** The codebase uses `!` assertions deliberately (post-guard safe access). Disabling the rule via `biome.json` is likely the right call rather than fixing 134 sites. ~5-min PR once user agrees. |
| `a11y/useSemanticElements` | 13 | error | Mostly `<div role="listitem">` → `<li>` etc. Largely mechanical. Each site needs a brief look for context but the transform is straightforward. |
| `a11y/useAriaPropsSupportedByRole` | 14 | error | `aria-*` props on wrong element role. Each one needs inspection — sometimes fix is a role change, sometimes is the prop. Mix of mechanical and judgment. |
| `correctness/useExhaustiveDependencies` | 7 | error | React hook deps. Each one is **judgment-heavy** — often a real bug hidden behind a silenced rule. Don't auto-fix; inspect each one and decide. |
| `suspicious/noArrayIndexKey` | 5 | error | `key={i}` in React lists. Each needs a stable key (usually an ID field from the item). Judgment-heavy. |
| `complexity/useLiteralKeys` | 22 | info | `obj["key"]` → `obj.key`. Pure-mechanical auto-fix. |
| other a11y | ~9 | error | Focus, tabindex, autofocus, click-events. Mixed mechanical + judgment. |

**Recommendation**: two small PRs, one config-level (the `noNonNullAssertion` disable decision) and one a11y sweep (the mechanical `useSemanticElements` bucket). Save the judgment-heavy ones (`useExhaustiveDependencies`, `noArrayIndexKey`) for dedicated attention — they might hide real bugs.

### 5. Additional items from smoke test

*(User: paste any visual bugs or UX issues you noticed during dev testing here before starting the new session. Examples: target ribbon wrapping awkwardly on narrow screens, briefing card misaligned after keyboard shortcut, stats panel showing wrong phase, etc. Be specific — "the ribbon overlaps the typing area at 900px width" is actionable; "the UI feels off" isn't.)*

- [ ] *(placeholder)*
- [ ] *(placeholder)*

## What this session should NOT do

- **Don't start Task 4.6 (deployment artifacts)** unless the user explicitly asks. It's on the roadmap but not in scope here.
- **Don't build Phase B features** — the plan explicitly defers curriculum, week-by-week milestones, LLM content gen, WebHID, more keyboards (§B6).
- **Don't auto-migrate `--lr-*` CSS vars to `--kerf-*`** — tracked tech debt (§B5), not to be auto-fixed.
- **Don't build "migration" UX** for hypothetical pre-existing users — pre-launch cohort is empty (see `project_prelaunch_status.md`).
- **Don't `npm install`** — pnpm only (§B13).
- **Don't touch production** — §B9. Claude's scope is generating artifacts; deploy is the developer's hand.

## How to execute

### Worktree per feature/fix

Even for small fixes, set up a dedicated worktree — don't pollute main:

```bash
cd /Users/falah/Work/kerf
git fetch --prune origin
git worktree add .worktrees/fix-<slug> -b fix/<slug> origin/main
cp .env .worktrees/fix-<slug>/.env
mkdir -p .worktrees/fix-<slug>/docs/superpowers/handoffs
cp docs/superpowers/handoffs/2026-04-23-small-fixes.md .worktrees/fix-<slug>/docs/superpowers/handoffs/  # carry the handoff in
cd .worktrees/fix-<slug>
pnpm install
pnpm typecheck && pnpm test
```

**Always `pnpm install`** in a fresh worktree — `node_modules` doesn't copy from the main tree. The `docs/superpowers/` dir is gitignored so handoff/plan files need to be copied manually.

### Quality gates per fix

Every PR must meet CLAUDE.md §B12:
- Typecheck: clean (`pnpm typecheck`)
- Tests: no regressions vs 769 baseline; pre-existing Playwright failure is not yours to fix unless that's the task you picked
- Format: clean (`./node_modules/.bin/biome format .` — direct binary dodges rtk proxy issues)
- Lint: delta vs `origin/main` baseline (47/139/27) must be ≤0. Net-positive additions need justification.
- Mechanical format fixes go in a **dedicated `chore:` commit**, registered in `.git-blame-ignore-revs` — never mixed with semantic changes.

### Small PRs preferred

Each item above is a standalone PR. Keep them small, one concern each. The handoff list isn't a sequence you execute linearly — it's a menu the user picks from. Land one, discuss, pick the next.

## Operational lessons from prior sessions (save you ~30 min of trial and error)

1. **pnpm is the package manager.** Don't run `npm install`. Don't let a subagent run it either. §B13 exists because this already burned a half-day of debugging.

2. **LSP diagnostics are often stale — trust `tsc --noEmit`, not the IDE.** When you switch worktrees or a subagent creates new files, the IDE's TypeScript indexer doesn't follow. You'll see "Cannot find module" errors OR "Property missing from type" errors OR route-type mismatches — any of these can be a cross-worktree staleness artifact. If `pnpm typecheck` passes at the CLI, trust the CLI. Re-verify only when the IDE error is shaped differently from the known stale patterns.

3. **`rtk` proxy truncates some pm-spawned outputs.** If `pnpm run lint` or `pnpm test` returns truncated output ending in "Linter process terminated abnormally (possibly out of memory)" or similar, that's rtk's token-optimizer mangling. Use direct binary invocation: `./node_modules/.bin/biome ...`, `./node_modules/.bin/vitest ...`. You can also use `rtk proxy pnpm run lint` to bypass the wrapping.

4. **`routeTree.gen.ts` is excluded from Biome.** The TanStack Router Vite plugin regenerates it on every `pnpm dev` / `pnpm build`, in single-quote no-semicolon style. Biome's `biome.json` ignores it so it never trips format-check. If you ever see it modified in `git status` after running dev, that's the plugin — either `git checkout -- src/routeTree.gen.ts` (it'll regenerate again) or leave it.

5. **`docs/superpowers/` is gitignored.** Plan files, handoffs, and specs there stay local. Never `git add` that path. If you want to preserve them across worktrees, copy manually.

6. **Subagent-driven development patterns** (from the prior handoff, still valid):
   - Pattern 1: reference plan by path + line range, don't paste verbatim
   - Pattern 2: skip spec review for pure-data / verbatim-copy tasks
   - Pattern 3: inline fixes for ≤3-line corrections; skip fix-subagent
   - Pattern 4: compact return format — max 25-35 lines per subagent report
   - Pattern 5: trust `tsc` over IDE stale-LSP diagnostics
   - Model tier: haiku for pure-domain TDD with full code blocks; sonnet for integration + pattern-matching adaptation
   - Always verify subagent reports independently (format/lint, not just typecheck + tests) — subagents frequently mis-identify lint sources or miss format drift

7. **`/ultrareview` is user-triggered.** If the user asks for a thorough multi-agent review of a branch, that's the slash command for it. Don't try to run it yourself.

## Conventional commit style

Matches the last 12 PRs' style:

```
<type>(<scope>): <one-line summary> (ADR/task ref if relevant)

<body explaining why, not what — 2-5 sentences>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

HEREDOC format in bash: `git commit -m "$(cat <<'EOF' ... EOF)"`. The `(1M context)` part of the Co-Authored-By trailer is preserved verbatim across commits — it identifies session origin, not current model.

## First action

**Don't start fixing yet. Instead:**

1. Read this whole doc + the two project memories (`project_prelaunch_status.md`, `project_superpowers_gitignored.md`).
2. One-line summary back to the user of what you've absorbed.
3. Verify state:
   - `pwd` → `/Users/falah/Work/kerf`
   - `git status` → clean, on `main`
   - `git log --oneline -5` → most recent should be PR #59's pnpm cleanup
   - `pnpm typecheck` → clean
   - `pnpm test` → 769 passing + 1 pre-existing Playwright failure (OR report if test:a11y passes now, which would tick off item #2 immediately)
   - `./node_modules/.bin/biome lint . --reporter=summary` → 47/139/27
4. Check item #5 above — does the user have specific smoke-test items to add? If yes, add them to the queue; if no (empty list), confirm with user which of items #1-4 to tackle first.
5. Once scoped: set up a worktree, pick the fix, ship a small PR.

If you pick an item, report your planned scope in one sentence before writing any code. §B10 "challenge and clarify" applies — small things still deserve a clarifying question if the scope feels ambiguous.

If something in this handoff contradicts `CLAUDE.md` or auto-memory, those win — they're the canonical behavioral source. This handoff is a session-pointer, not a behavior override.
