# Changelog

All notable changes to kerf are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `src/server/env.ts` — boot-time validation for `AUTH_SECRET`, `AUTH_URL`, and `DATABASE_URL`. Production now refuses to start if any is unset or empty rather than silently falling back to a dev default. Dev/test still falls back with a console warning so first-run setup is frictionless. ([#73](https://github.com/shariski/kerf/pull/73))
- Magic-link send rate limiting — 3 per IP per minute via Better Auth `customRules`, matching the convention for paid email-sending endpoints. OAuth bounces capped at 10/min/IP. ([#73](https://github.com/shariski/kerf/pull/73))
- README rewritten as product-facing (drops the dev `## Status` checklist and internal docs table; adds Contributing and Releases sections).
- This `CHANGELOG.md` file, established at the introduction of versioning policy.

### Changed

- CLAUDE.md §B11 repurposed: was "Checkpoint Task Status on Completion" (now-obsolete README ## Status checkbox flipping), now "Versioning and CHANGELOG". `package.json` `version` is the new source of truth; PRs add CHANGELOG entries inline.
- "Working Pattern Per Task" step 7 in CLAUDE.md updated to reference CHANGELOG instead of README Status.
- `package.json` gains an explicit `version` field (`0.1.0`).

## [0.1.0] - 2026-04-26

Initial pre-public-launch version. Captures the MVP feature set built across Phases 0 through 5.

### Added

- **Adaptive engine.** Phase-aware (`transitioning` / `refining`) and journey-aware (`conventional` / `columnar`) target selection. Client-side static word corpus + weighted random sampling. No LLM in the content path.
- **Onboarding flow.** Keyboard / dominant-hand / level / finger-assignment capture in 4 steps.
- **Practice modes.** Adaptive sessions, targeted-drill submode (manual target + 3 presets: inner-column, thumb-cluster, cross-hand-bigram, vertical-reach), hand-isolation filter.
- **Three-stage session UI.** Briefing → typing → post-session intent echo with per-key breakdown and soft next-target preview.
- **Visual keyboard SVG** (Sofle, Lily58) with target highlight, finger bars, and an imperative flash API for in-session feedback.
- **Dashboard** with hero stats (accuracy-featured) + split-keyboard metrics, 30-day activity log, heatmap overlay on the keyboard SVG, top-10 weakness ranking, accuracy/WPM trajectory charts, weekly insight narrative, hour-of-day / day-of-week temporal patterns, phase-transition suggestion banner, and an always-expanded "How is this calculated?" transparency panel.
- **Multi-keyboard profile support.** `/keyboards` page; transactional active-profile switching; per-profile stat scoping (Sofle and Lily58 don't merge).
- **Authentication via better-auth.** Magic-link, Google, and GitHub. Account-linking on verified email.
- **Session persistence.** Server-side `persistSession` with all-or-nothing transactions, client-generated UUIDs for idempotency, and UPSERT additive aggregation on per-user stats.
- **Network-failure resilience.** localStorage-backed retry queue (FIFO, capped at 10, dedup'd by sessionId), drained on mount and after each successful save.
- **Cross-tab detection** via `BroadcastChannel` with a quiet pre-session banner.
- **Static documentation pages.** `/how-it-works`, `/why-split-is-hard`, `/faq`, `/privacy`, `/terms`.
- **Settings page** with finger-assignment toggle.
- **Mobile gate** at viewports below 768px (desktop/tablet only for MVP).
- **Accessibility.** WCAG 2.1 AA via `@axe-core/playwright` sweep across 8 routes/states; global `:focus-visible` amber ring; skip-to-main-content link.

[Unreleased]: https://github.com/shariski/kerf/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/shariski/kerf/releases/tag/v0.1.0
