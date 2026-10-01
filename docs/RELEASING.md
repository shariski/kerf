# Production releases

`package.json` is the single source for the human-readable app version. The footer displays only that version, for example `v0.2.1`. Each production image is tagged with the first 12 characters of the Git commit SHA that built it; use the image tag or GitHub Actions history when diagnosing an exact deployment.

## Choose the next version

kerf is a public beta until a deliberate `1.0.0` stable-product milestone. Use `0.MINOR.PATCH` now:

| Change | Bump | Example |
| --- | --- | --- |
| New feature or meaningful user-flow change | Minor | `0.2.0` → `0.3.0` |
| Bug fix, performance improvement, small UI or copy change | Patch | `0.2.0` → `0.2.1` |
| Markdown documentation only | None | No production deploy |

After `1.0.0`, use MAJOR for breaking changes, MINOR for additions, and PATCH for fixes. Do not use a version twice for two different production commits. If several PRs are open, rebase the later one and choose the next unused version before merging it.

## Agent and contributor checklist

1. Start from current `origin/main`. Check the latest `package.json` version and [CHANGELOG.md](../CHANGELOG.md).
2. During work, record notable changes under `## [Unreleased]` using `Added`, `Changed`, `Fixed`, or another Keep a Changelog category. Use user-facing language where possible.
3. Before a non-documentation PR merges, bump `package.json` and move the notes into a new `## [X.Y.Z] - YYYY-MM-DD` section. Keep an empty `## [Unreleased]` above it. Update the comparison links at the bottom of the changelog. Use the expected deploy date; correct it before merging if the date changes.
4. Run `git fetch origin main`, then `node scripts/release.mjs check --base origin/main`, plus the normal build, test, lint, and format checks. The PR workflow repeats the release check. A documentation-only PR can skip the version bump and release check.
5. Merge only after review. A push to `main` builds an image tagged with the 12-character SHA, deploys it, and then publishes a `vX.Y.Z` GitHub Release from the matching changelog section. A failed deploy creates no release tag. Re-running the workflow for the same commit reuses its version.
6. Confirm the production footer shows the expected version. For rollback, use the known-good image SHA described in [DEPLOYMENT.md](../DEPLOYMENT.md#rolling-back-a-release). A rollback restores an older version; do not retag it as a new release.

The first tagged public-beta baseline is `v0.2.0`. Earlier deployed changes are included in that changelog section rather than being assigned invented historical version numbers. The old `0.1.0` changelog entry links to the commit that introduced it because no `v0.1.0` tag was created. The current release date and latest version must always match `package.json` and the newest dated changelog section.
