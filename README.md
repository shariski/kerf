# kerf

Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first.

kerf is a typing platform specifically designed for people migrating from row-staggered QWERTY to split columnar keyboards (Sofle and Lily58 in MVP). It treats split keyboard adoption as a distinct learning journey with its own pain points, not as a generic "learn to type faster" program.

## Stack

See `docs/01-product-spec.md §9` for the full rationale. Quick list:

- **Framework**: Tanstack Start (Vite + Tanstack Router + Nitro)
- **Language**: TypeScript (strict)
- **UI**: React + Tailwind CSS v4
- **State**: Zustand (Phase 1+)
- **ORM**: Drizzle + PostgreSQL 16 (Task 0.2+)
- **Auth**: better-auth (Task 0.3+)
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

- [x] Phase 0 / Task 0.1: Tanstack Start scaffold + design tokens + hello world page
- [x] Phase 0 / Task 0.2: Local database setup (Drizzle + PostgreSQL)
- [x] Phase 0 / Task 0.3: Auth infrastructure (better-auth)
- [x] Phase 1: Adaptive engine domain logic
- [x] Phase 2 / Task 2.1: Onboarding flow
- [x] Phase 2 / Task 2.2: Visual Keyboard SVG (SofleSVG / Lily58SVG with target highlight, finger bars, imperative flash API)
- [ ] Phase 2 / Task 2.3: Typing area component (error visualization)
- [ ] Phase 2 / Task 2.4: Practice page integration with pause state
- [ ] Phase 2 / Task 2.5: Post-session inline summary with error review
- [ ] Phase 2 / Task 2.6: Drill mode submode
- [ ] Phase 2 / Task 2.7: Hand isolation filter
