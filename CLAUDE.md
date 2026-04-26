# CLAUDE.md

Behavioral guidelines for Claude Code when working on the **kerf** project.

This file merges two layers:

- **Part A** — universal LLM coding principles (from Andrej Karpathy's observations, via forrestchang/andrej-karpathy-skills)
- **Part B** — project-specific rules for kerf (adaptive typing platform for split keyboards)

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks (typos, obvious one-liners), use judgment — not every change needs the full rigor.

---

# PART A — Universal Principles

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**Part A working indicators:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes.

---

# PART B — Project-Specific Rules for kerf

## B1. Architecture Boundaries

The project follows the layered architecture from `docs/02-architecture.md`:

```
src/
├── domain/       # Pure TS, no framework deps — the adaptive engine lives here
├── ui/           # React components, Zustand stores, hooks
├── api/          # Typed fetch wrapper
└── server/       # Tanstack Start / Next.js routes + Drizzle ORM
```

**Rules:**

- Domain logic **must not import** from `ui/`, `api/`, or `server/`. Pure functions only.
- Domain logic must be testable in isolation without mocking React, Zustand, or network calls.
- UI components can import from domain freely.
- Server routes stay thin — business logic belongs in domain.

If a task tempts you to put domain logic in a React component or a server route, stop and ask.

## B2. Transition-Phase and Journey Awareness

The adaptive engine branches on two axes: **phase** (`transitioning` | `refining`) and **journey** (`conventional` | `columnar`). Every engine-derived output (exercise content, weakness score, target selection, copy tone, metric interpretation) may behave differently per phase and per journey. See `docs/02-architecture.md` §4.1, §4.2 (Target Selection), and §4.7.

**Rules:**

- Functions that compute weakness score, target selection, exercise content, or user-facing insights must accept `phase: TransitionPhase` and (where journey-relevant) `journey: JourneyCode` as parameters.
- Do not hardcode coefficients, bonuses, or thresholds. Use the `COEFFICIENTS[phase]` and `JOURNEY_BONUSES[journey]` map patterns from §4.1.
- When unsure which (phase, journey) combination a piece of logic should behave under, ask.

## B3. Accuracy-First Copy Guidelines

All user-facing strings (buttons, labels, summaries, error messages, insights, toasts) must honor accuracy-first values from `docs/01-product-spec.md` §6.2:

- Lead with accuracy in stat hierarchy. Never put speed first.
- Frame "speed up + accuracy drop" as concern, not win. Example: "Your speed ticked up, but accuracy slipped. Slowing down will pay off" — NOT "62 WPM! New personal best!"
- Frame "speed down + accuracy up" as the right trajectory. Example: "Slower, tighter, stronger. This is how muscle memory forms."
- No hyped language. Banned words/phrases: "amazing!", "crushing it!", "nailed it!", "incredible!", multiple exclamation marks.
- **No session pass/fail verdicts.** The platform surfaces target performance numbers; the user evaluates themselves. No badges, no scores, no "target met / missed" copy, no celebratory animations on high accuracy, no concerning language on low accuracy. Low accuracy is data, not failure. See `docs/00-design-evolution.md` ADR-003 §4.
- Tone: quietly affirming, not cheerleading. Like a calm mentor, not a hype coach.
- When user hasn't improved, say so honestly. Do not sugarcoat.
- Phase-aware framing: transitioning phase uses "building muscle memory" language; refining phase uses "polishing flow" language.

When you generate any string that appears in UI, **self-check against this list before submitting**. If a string feels hyped, rewrite it.

## B4. Accessibility-First Defaults

- Respect `prefers-reduced-motion` — disable or shorten animations when active.
- All keyboard shortcuts documented (see `docs/06-design-summary.md` §Keyboard Shortcuts and vim-kiblat iteration topic).
- Color contrast must pass WCAG AA on dark-espresso background (`#181410`).
- Screen reader labels on all interactive elements. Icons without labels are not acceptable.

## B5. Design System Discipline

The design system in `docs/04-design-system.md` is locked for Phase A. Do not introduce new design tokens or deviate from existing ones.

**Specifically:**

- CSS variable prefix is `--lr-*` (legacy from "Leftype-Rightype"). **Do not auto-migrate** to `--kerf-*` unless explicitly asked. This is tracked tech debt, not an improvement opportunity.
- Typography: Inter (UI) + JetBrains Mono (typing content + numeric) + Fraunces (brand wordmark only, SOFT 100, lowercase). Never introduce a fourth typeface.
- Dark mode is primary. Light mode is V2 only — do not build theme switching infrastructure unless explicitly scoped.
- Amber accent (`#F59E0B`) used sparingly. If you're about to paint something amber, ask whether it's earned.
- See `docs/04-design-system.md` §12 for full anti-pattern list.

## B6. Phase A Scope Discipline

The MVP is split into Phase A (launch) and Phase B (gated on beta validation). See `docs/01-product-spec.md` §5 and §7.

**Rules:**

- Do not implement Phase B features (structured curriculum, week-by-week milestones) during Phase A work.
- Do not implement "Tier 2" or "Tier 3" deferrals unless explicitly asked. Common ones: LLM-based content generation, Real Sentence Mode, WebHID, more keyboards beyond Sofle and Lily58.
- Out-of-scope features should not get "just a tiny bit of prep work" — they stay fully out.
- If a task tempts you toward scope creep, name it and ask.

## B7. Content Strategy: Word-Picker, Not LLM

Phase A content generation uses a static word corpus + weighted random sampling (see `docs/02-architecture.md` §4.2). **Do not suggest LLM-based content generation** as a solution during Phase A. This is a deliberate V2 deferral, not an oversight.

**Related rules:**

- Corpus is bundled as static JSON, client-side loaded. Do not move corpus to server.
- Exercise generation must run client-side. No server-side generation of practice content.
- If a task seems to require LLM content generation, push back and ask whether the word-picker approach can solve it.

## B8. Testing Conventions

The engine is the highest-priority testing target.

**Rules:**

- Domain logic (`src/domain/**`) requires exhaustive unit tests. Every pure function gets at least happy-path + edge case coverage.
- Use seeded random for deterministic tests. Never write flaky probabilistic tests.
- Test file colocation: `weaknessScore.ts` + `weaknessScore.test.ts` side by side.
- Fixture data should represent realistic user states (transitioning phase baseline is different from refining — test both).
- UI components get snapshot + interaction tests. Prioritize `KeyboardSVG` and `TypingArea` since those carry the user experience.
- E2E is skipped for MVP. Manual testing of the main flow (signup → onboarding → session → dashboard) is sufficient.

When in doubt about test coverage, write the test.

## B9. Claude Code + Developer Scope Boundary

From `docs/03-task-breakdown.md`, every infrastructure task splits into:

- **Claude Code scope**: generates source code, configs, local artifacts. Everything is committed to repo.
- **Developer scope**: executes anything touching production VPS, external services (email, DNS, TLS), secrets, or deployment.

**Rules:**

- Claude Code must **not** SSH to VPS or run deployment commands.
- Claude Code must **not** request or handle production secrets.
- Generate deployment artifacts (Dockerfile, docker-compose.prod.yml, DEPLOYMENT.md) — do not execute deployment.
- If a task requires touching production, stop and hand off with a clear checklist.

## B10. Challenge and Clarify Over Autopilot

The developer (solo, part-time) has already pushed back against multiple over-engineering suggestions during planning. This is a feature, not a bug. Lean into it:

- When asked to "build X", pause and check: is there a simpler version that validates the idea first?
- If specs contradict each other, surface the contradiction before implementing.
- If a previous doc (`01-*.md`, `02-*.md`, etc.) says one thing and the current request implies another, ask which is authoritative.
- Prefer asking one clarifying question over generating speculative code.

## B11. Versioning and CHANGELOG

kerf follows [Semantic Versioning](https://semver.org/) and tracks notable changes in `CHANGELOG.md` per the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) convention. Releases are git-tagged as `vX.Y.Z`.

**Rules:**

- `package.json` `version` is the single source of truth.
- Notable changes go in `CHANGELOG.md` under `## [Unreleased]` **as part of the PR that ships them**, not in a follow-up commit. Subsections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- At release time: move `[Unreleased]` entries under a new `## [X.Y.Z] - YYYY-MM-DD` heading, bump `package.json` `version`, commit, then tag (`git tag vX.Y.Z && git push origin vX.Y.Z`).
- Pre-1.0 (`0.x.y`): pre-public-launch. UX, data, and APIs may change without notice.
- `1.0.0`: first public launch.
- Post-1.0: MAJOR for breaking changes (rare for a SaaS — reserve for user-data shape changes), MINOR for new features or notable additions, PATCH for fixes and copy/UI tweaks.
- Trivial chores (typo fixes, whitespace, dependency bumps that don't affect behavior) do not need a CHANGELOG entry. Use judgment — if a future user would want to know about it, log it.
- If unsure whether a change is notable, **ask**. Better to over-include than to retroactively backfill.

**Why this exists:** the changelog is the release-notes draft and audit trail. Without it, "what shipped in 1.2.0" requires re-reading commit messages and PR descriptions — fine for the dev who lived through it, opaque for everyone else. Keeping the entry inline with the PR (not as a follow-up commit) avoids the same lying-checklist problem the prior version of §B11 (`README ## Status` checkbox flipping) was trying to prevent before that section was retired.

## B12. Lint + Format Discipline

The repo enforces style via [Biome](https://biomejs.dev) (`biome.json`). The point of this section: **don't let AI sessions accumulate unchecked style drift.** In multi-session AI development, quirks compound silently; enforcing the check at every slice keeps the visible diff small and the history reviewable.

**Rules:**

- Every slice must end with `biome format` clean before the PR opens. Run `./node_modules/.bin/biome format .` (or `pnpm format:check`) to check, `pnpm format` to apply. If any touched file drifts, apply the fix in a **dedicated mechanical commit** (`chore: ...`) — do NOT mix format and semantic changes in one commit.
- Register mechanical format commits in `.git-blame-ignore-revs` so `git blame` skips them.
- Every slice must leave `biome lint` diagnostic counts at-or-below the pre-slice `origin/main` baseline. Measure before (`./node_modules/.bin/biome lint . --reporter=summary | tail -3`) and after. Net-positive additions of errors or warnings need rule-tuning or code-fix justification — not "we'll fix it later."
- Prefer direct binary invocation: `./node_modules/.bin/biome lint .` and `./node_modules/.bin/biome format .` (or `pnpm exec biome ...`). The `rtk` proxy some sessions run may truncate pm-spawned Biome output with a spurious "terminated abnormally" message. Direct paths bypass this.
- Suppression (`// biome-ignore ...`) is a last resort and needs a one-line reason comment. Fixing the code is the default.
- Subagent implementer prompts must require the subagent to report format/lint status in their summary, so the controller can verify pre-PR — not just typecheck + tests.

**Why this exists:** a missed format sweep in one PR becomes a multi-file reflow in the next PR, which obscures the real logic change. The check is sub-second; skipping it is a false economy. See PR #54 commit `a0694d2` for a cautionary-tale cleanup where drift from two prior PRs had to be retrofitted.

## B13. Package Manager: pnpm

The repo uses **pnpm** as its package manager. `pnpm-lock.yaml` is committed; `package-lock.json` is gitignored and must never be committed.

**Rules:**

- Install deps: `pnpm install` (CI: `pnpm install --frozen-lockfile`).
- Run scripts: `pnpm <script>` — e.g. `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`. (`pnpm run <script>` also works.)
- **Never run `npm install` in this repo.** It generates a `package-lock.json` that silently drifts against `pnpm-lock.yaml` and, if installed alongside a prior pnpm install, produces a hybrid `node_modules` where Vite resolves mixed versions of framework internals at runtime.
- If `git status` ever shows an untracked `package-lock.json` on your working tree, delete it. It should never be committed.
- Direct binary invocation (e.g. `./node_modules/.bin/biome ...`) works regardless of package manager. Prefer it in subagent prompts to dodge pm-proxy truncation.

**Why this exists:** The repo was originally pnpm (see `package.json`'s `"pnpm": {"onlyBuiltDependencies": [...]}` block), but during ADR-003 implementation several Claude sessions defaulted to `npm install` and silently committed `package-lock.json` alongside the existing `pnpm-lock.yaml`. On a machine that alternated between `pnpm install` (for dev) and `npm install` (via session scripts), `node_modules` ended up with mixed resolutions — different versions of `@tanstack/start-server-core` coexisted, and runtime crashed with `Cannot read properties of undefined (reading 'method')` in the server-function handler. Pinning to pnpm + gitignoring `package-lock.json` prevents the mode where both lockfiles silently drift. See PR #59 for the cleanup.

---

## Working Pattern Per Task

1. Read the relevant doc sections (named in the task).
2. State a brief plan with verification checks.
3. Write tests first where applicable.
4. Implement the minimum to pass tests.
5. Run `biome format --write` on touched files and confirm `biome lint` delta vs main is ≈0 — see §B12.
6. Report diff, test results, lint + format status, and any assumptions you made.
7. Add a CHANGELOG entry under `## [Unreleased]` if the change is notable — see §B11.
8. Wait for developer review before moving to next task.

---

## Known Tech Debt (Don't Auto-Fix)

These are intentional deferrals. Mention if encountered, do not "helpfully" fix:

- CSS variable prefix `--lr-*` (should eventually be `--kerf-*`)
- Folder/repo name still uses old project name
- Docs markdown files (`docs/01-*.md` through `docs/06-*.md`) still reference "Leftype-Rightype" in bodies
- Design system §10 logo spec describes old wordmark
- All of `design/*-wireframe.html` have been migrated to `kerf` wordmark; docs have not

Migration of these is tracked, not forgotten. Ask before touching.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
|------|----------|
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
