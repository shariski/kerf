# kerf

**Structured transition program for QWERTY-to-split keyboards. Adaptive engine. Accuracy first.**

kerf is a typing platform built specifically for people migrating from row-staggered QWERTY to split columnar keyboards. It treats the transition as a distinct learning journey — with its own pain points around inner columns, thumb clusters, and cross-hand reaches — not as a generic "learn to type faster" program.

→ **Try it at [typekerf.com](https://typekerf.com)**

---

## What's different

Most typing trainers reward speed. kerf rewards accuracy. The trade-off is deliberate.

- **Accuracy first in every metric.** A faster session with one extra error isn't a personal best. The platform never celebrates a speed bump that came with an accuracy slip — slowing down to keep accuracy up *is* the win.
- **No pass/fail verdicts.** Sessions surface the numbers and a quiet, honest read of where you are. No badges, no scores, no "target met / missed" copy. Low accuracy is data, not failure.
- **Two-phase model.** When you're new to a split keyboard, the engine focuses on building motor patterns. Once those are stable, it shifts to refining flow. The same data is interpreted differently in each phase.
- **Columnar-aware.** If you're using a columnar finger assignment (one finger per column, no row-stagger drift), the engine tracks columnar-stability signals that conventional typing trainers ignore.

The tone is quietly affirming, not cheerleading — like a calm mentor, not a hype coach. When you haven't improved, kerf will say so honestly.

## Supported keyboards

- Sofle
- Lily58

More may follow once the early cohort validates the approach. Adding a keyboard is a design + data pass, not a code rewrite.

## How it works

The adaptive engine runs entirely client-side. There's no LLM picking your words. A static word corpus + weighted random sampling builds each exercise around a target the engine identifies as your current weakest column, bigram, or character — weighted by recency, journey (conventional or columnar), and how far the signal sits from a phase-aware baseline.

Sessions persist server-side so dashboards stay coherent across devices. Stats are scoped per keyboard profile — your Sofle data and your Lily58 data don't merge.

For the user-facing version of this, see [How it works](https://typekerf.com/how-it-works) and [Why split is hard](https://typekerf.com/why-split-is-hard) on the live site.

## Local development

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d
cp .env.example .env       # then fill in AUTH_SECRET (run `openssl rand -base64 32`)
pnpm db:migrate
pnpm dev
```

Open <http://localhost:3000>.

Other scripts: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm format`. Requires Node ≥22 and Docker for the local Postgres.

For architecture and adaptive-engine internals, see the design docs in `docs/`.

## Contributing

Discussions, bug reports, and small PRs are welcome — please open an issue first for anything substantial so we can talk shape before code lands.

The repo's working conventions live in [CLAUDE.md](./CLAUDE.md). The file was originally written for Claude Code sessions, but the architecture rules, accuracy-first copy guidelines, design system discipline, and lint/format expectations apply to any contributor. Worth a skim before your first PR.

## Releases

kerf follows [Semantic Versioning](https://semver.org/) and tracks notable changes in [CHANGELOG.md](./CHANGELOG.md) per the [Keep a Changelog](https://keepachangelog.com/) convention.

- Pre-1.0 (`0.x.y`): pre-public-launch. UX, data shapes, and APIs may change without notice.
- `1.0.0` will mark the first public launch.
- Post-1.0: MAJOR for breaking changes, MINOR for new features, PATCH for fixes and copy/UI tweaks.

Releases are git-tagged as `vX.Y.Z`.

## License

[MIT](./LICENSE).
