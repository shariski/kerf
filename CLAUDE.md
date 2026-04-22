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

## B2. Transition-Phase Awareness

The adaptive engine has two phases: `transitioning` and `refining`. Every engine-derived output (exercise content, weakness score, copy tone, metric interpretation) may behave differently per phase. See `docs/02-architecture.md` §4.1 and §4.6.

**Rules:**

- Functions that compute weakness score, exercise content, or user-facing insights must accept `phase: TransitionPhase` as a parameter.
- Do not hardcode coefficients or thresholds. Use the `COEFFICIENTS[phase]` pattern from §4.1.
- When unsure which phase a piece of logic should behave under, ask.

## B3. Accuracy-First Copy Guidelines

All user-facing strings (buttons, labels, summaries, error messages, insights, toasts) must honor accuracy-first values from `docs/01-product-spec.md` §6.2:

- Lead with accuracy in stat hierarchy. Never put speed first.
- Frame "speed up + accuracy drop" as concern, not win. Example: "Your speed ticked up, but accuracy slipped. Slowing down will pay off" — NOT "62 WPM! New personal best!"
- Frame "speed down + accuracy up" as the right trajectory. Example: "Slower, tighter, stronger. This is how muscle memory forms."
- No hyped language. Banned words/phrases: "amazing!", "crushing it!", "nailed it!", "incredible!", multiple exclamation marks.
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

## B11. Checkpoint Task Status on Completion

The `## Status` checklist in `README.md` is the single fastest way for a new Claude Code session (or a returning developer) to orient. Keep it synchronized with reality.

**Rules:**

- When a task tracked in `README.md` `## Status` is merged to `main`, flip its `[ ]` to `[x]`. If the merge completes an entire phase (e.g. all Phase 0 tasks done), flip the phase-level line too.
- Include the checklist update **in the PR that completes the task**, not in a follow-up commit. The checkpoint must land with the work so git history stays coherent.
- The checklist tracks **tasks**, not commits. Incidental chores (tooling, `.gitignore`, lockfile commits, unrelated bugfixes) do not get their own entry and must not be added.
- If you complete a task explicitly numbered in `docs/03-task-breakdown.md`, bump its `Last updated: YYYY-MM-DD` header to today's date (use `currentDate` from session context).
- If unsure whether the current work fully completes a tracked task (e.g. a multi-PR task where this is PR 1 of 3), **ask** — do not pre-tick.

**Why this exists:** a stale checklist is worse than no checklist — it silently lies about state. Without this rule, every future session pays the cost of re-inferring what's done from `git log`, branch names, and commit messages, and risks redoing completed work.

---

## Working Pattern Per Task

1. Read the relevant doc sections (named in the task).
2. State a brief plan with verification checks.
3. Write tests first where applicable.
4. Implement the minimum to pass tests.
5. Report diff, test results, and any assumptions you made.
6. If the task is tracked in `README.md` `## Status`, flip its checkbox as part of the PR — see §B11.
7. Wait for developer review before moving to next task.

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
