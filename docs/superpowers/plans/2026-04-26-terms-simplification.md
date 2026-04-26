# Terms page simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legal-template content of `/terms` with a lean ~5-section page that points at the MIT LICENSE on GitHub for source-code coverage and keeps only what users actually need to know about the hosted service.

**Architecture:** Single-file replacement of `src/routes/terms.tsx`. Reuses the existing `<DocPage>` primitive (drops the `isTemplate` prop since placeholders are gone; keeps `effectiveDate` as a real date). No new files, no new components, no new dependencies, no test (matches static-DocPage convention).

**Tech Stack:** React 19, TanStack Router (file-based routes), existing `<DocPage>` component, Biome, pnpm.

**Spec:** [`docs/superpowers/specs/2026-04-26-terms-simplification-design.md`](../specs/2026-04-26-terms-simplification-design.md)

**Branch:** `feat/simplify-terms` (already cut from `main` after PR #68 merged; spec already committed at `f9ad2d3`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/routes/terms.tsx` | REPLACE | Replace entire body of `TermsPage()`, drop placeholder-comment block at top, drop `isTemplate` prop, supply real `effectiveDate` |

**Total surface:** 1 file modified. Net diff: ~80 lines removed, ~40 lines added.

**Decomposition rationale:** A single-file edit at this scale is one task. Splitting into multiple tasks (e.g. "remove old content" then "add new content") would add ceremony without value. The locked spec §5 content goes in as one atomic replacement; verification follows as discrete steps.

---

## Task 1: Replace `/terms` content + verify

**Files:**
- Modify: `src/routes/terms.tsx` (entire file replaced)

- [ ] **Step 1: Replace the entire content of `src/routes/terms.tsx`**

Replace the file with EXACTLY this content:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <DocPage title="Terms" effectiveDate="2026-04-26">
      <p>
        kerf is open source — these terms cover what you can expect from the hosted service at
        typekerf.com.
      </p>

      <h2>The code</h2>
      <p>
        The kerf source code is licensed under the{" "}
        <a
          href="https://github.com/shariski/kerf/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
        >
          MIT License
        </a>{" "}
        (opens GitHub). You can read it, fork it, run your own copy — the LICENSE file has the
        full text.
      </p>

      <h2>The service</h2>
      <p>
        The hosted service at typekerf.com is provided as-is. No warranty about uptime, accuracy,
        how fast you'll type after using it, or anything else.
      </p>

      <h2>Acceptable use</h2>
      <p>A short list of things to please not do:</p>
      <ul>
        <li>Generate fake typing sessions or scrape the exercise corpus with automation.</li>
        <li>Access other accounts, exploit auth, or reverse-engineer server-side internals.</li>
        <li>Put unreasonable load on the infrastructure.</li>
      </ul>

      <h2>Your account</h2>
      <p>
        You can delete your account at any time — see <a href="/contact">contact</a> for how to
        get in touch. Accounts that violate these terms can be suspended, with notice when
        reasonable.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms materially change, the new version goes here and the effective date above
        updates. Continued use after a change means acceptance.
      </p>
    </DocPage>
  );
}
```

The 4-line `// TEMPLATE PLACEHOLDERS` comment block at the top of the current file goes away (the page is no longer a template).

- [ ] **Step 2: Verify no placeholder strings remain**

Run:

```bash
grep -E '\{\{[A-Z_]+\}\}' src/routes/terms.tsx | head -5 && echo "BAD: placeholder still present"
```

Expected: NO output (no placeholders, no "BAD" line). The grep returns nothing → the echo is short-circuited by `&&` failing.

If output appears: a `{{...}}` token is still in the file; remove it.

- [ ] **Step 3: Verify the `isTemplate` prop is gone**

Run:

```bash
grep -E 'isTemplate' src/routes/terms.tsx | head -3 && echo "BAD: isTemplate still set"
```

Expected: NO output (no `isTemplate` attribute, no "BAD" line).

If `isTemplate` appears: the page would still render the amber template-banner via DocPage; remove the prop.

- [ ] **Step 4: Verify expected anchors are present**

Run:

```bash
grep -c "shariski/kerf/blob/main/LICENSE" src/routes/terms.tsx
grep -c 'href="/contact"' src/routes/terms.tsx
grep -c "typekerf.com" src/routes/terms.tsx
```

Expected: each command outputs a non-zero count.

- `LICENSE` URL: 1 match (in the "The code" section)
- `/contact` href: 1 match (in the "Your account" section)
- `typekerf.com`: 2 matches (lede paragraph + "The service" section)

If any returns `0`: the corresponding section's link is missing; restore it from the spec.

- [ ] **Step 5: Verify the page typechecks cleanly**

Run:

```bash
pnpm typecheck 2>&1 | grep -E "src/routes/terms\.tsx" | head -5
echo "(empty output above = clean)"
```

Expected: empty output before the echo line.

If errors appear: most likely culprit is the `<DocPage>` props — verify `title`, `effectiveDate` are valid (per `src/components/doc/DocPage.tsx`'s `Props` type). The other DocPages (`/faq`, `/privacy`, `/contact`, etc.) are reference implementations.

- [ ] **Step 6: Format + lint the file**

Run:

```bash
./node_modules/.bin/biome format --write src/routes/terms.tsx
./node_modules/.bin/biome lint src/routes/terms.tsx
```

Expected: format applies (likely no-op since written from spec which is already formatted). Lint reports zero diagnostics.

- [ ] **Step 7: Manually smoke-test in dev**

```bash
pnpm dev > /tmp/kerf-dev.log 2>&1 &
DEV_PID=$!
sleep 8
PORT=$(grep -oE 'http://localhost:[0-9]+' /tmp/kerf-dev.log | head -1 | grep -oE '[0-9]+$')
echo "Dev server on port: ${PORT:-unknown}"
curl -sS "http://localhost:${PORT}/terms" -o /tmp/terms-html.txt -w "HTTP %{http_code} (%{size_download} bytes)\n"
echo "--- content checks ---"
grep -q "kerf is open source" /tmp/terms-html.txt && echo "OK: lede present"
grep -q "MIT License" /tmp/terms-html.txt && echo "OK: MIT License link present"
grep -q "Acceptable use" /tmp/terms-html.txt && echo "OK: Acceptable use heading present"
grep -q '\{\{' /tmp/terms-html.txt && echo "BAD: {{placeholder}} string visible in rendered HTML"
kill $DEV_PID 2>/dev/null
wait 2>/dev/null
echo "(dev server stopped)"
```

Expected:
- `HTTP 200`
- 3 "OK:" lines
- NO "BAD:" line

If `HTTP 500`: the dev server crashed (possibly the `Cannot read properties of undefined (reading 'method')` issue from the prior session — unrelated to this work; the lockfile fix is currently stashed). Re-run after restoring the lockfile fix from `git stash pop`, OR proceed without dev-server verification and rely on typecheck + lint as the correctness signal.

If "BAD: placeholder" appears: a `{{...}}` survived the replacement; revisit Step 1 and confirm the file content matches the spec.

- [ ] **Step 8: Commit**

```bash
git add src/routes/terms.tsx
git commit -m "$(cat <<'EOF'
feat(terms): simplify from 9-section legal template to 5-section page

Replaces the placeholder-heavy ToS template (was waiting on
{{COMPANY_NAME}}, {{JURISDICTION}}, {{CONTACT_EMAIL}},
{{EFFECTIVE_DATE}} fill-ins) with a lean 5-section page that:

  - Points at the MIT LICENSE on GitHub for source-code legal
    coverage
  - Disclaims warranty for the hosted service ("provided as-is")
  - Lists 3 acceptable-use rules in conversational tone ("things
    to please not do" rather than imperative "Don't")
  - Surfaces account-deletion path via /contact
  - Notes change-acceptance via continued use

Drops sections that don't apply to a solo OSS project: Who we are
(no entity), Accounts magic-link explainer (lives in /how-it-works),
Intellectual property (LICENSE is authoritative), Limitation of
liability (MIT covers code, "as-is" covers service), Termination
(merged into "Your account"), Governing law (no formal jurisdiction
setup), separate Contact section (redundant with /contact).

Drops the isTemplate DocPage prop (no more amber template-banner)
and supplies a real effectiveDate of 2026-04-26.

Voice matches the warmer /contact tone landed during the prior
brainstorm: passive voice for suspension language, conditional
phrasing instead of imperatives, no solo/team-size signaling.

Net surface: ~80 lines of JSX → ~40 lines.

Soft dependency: the /contact link 404s until PR #69 (contact-page)
also merges. User controls merge order; flagged in PR description.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Push + open PR

**Files:** none modified.

- [ ] **Step 1: Push the branch**

```bash
git push origin feat/simplify-terms 2>&1 | tail -3
```

Expected: branch pushed; second push (the spec was pushed in the prior step before plan-writing). Output ends with the local-branch-tracks-remote line.

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat: simplify /terms page (drop legal template, point at MIT LICENSE)" --body "$(cat <<'EOF'
## Summary

Cuts `/terms` from a 9-section legal-template ToS (with `{{COMPANY_NAME}}` / `{{JURISDICTION}}` / `{{CONTACT_EMAIL}}` / `{{EFFECTIVE_DATE}}` placeholders that needed filling in) down to a lean ~5-section page:

- **The code** — points at the [MIT LICENSE](https://github.com/shariski/kerf/blob/main/LICENSE) on GitHub for source-code coverage
- **The service** — "provided as-is" disclaimer for the hosted side at typekerf.com
- **Acceptable use** — three short rules in conversational tone
- **Your account** — deletion path via `/contact`, suspension language in passive voice
- **Changes** — terms-update notice clause

Drops sections that don't apply to a solo OSS project: Who we are (no entity), Accounts magic-link explainer (lives in `/how-it-works`), Intellectual property (LICENSE is authoritative), Limitation of liability (MIT covers code, "as-is" covers service), Termination (merged), Governing law (no formal jurisdiction setup), separate Contact section (redundant with `/contact`).

Drops the `isTemplate` `<DocPage>` prop (no more amber template-banner) and supplies a real `effectiveDate="2026-04-26"`.

## Spec

[`docs/superpowers/specs/2026-04-26-terms-simplification-design.md`](docs/superpowers/specs/2026-04-26-terms-simplification-design.md)

## Test plan

### Automated (passing)

- [x] `pnpm typecheck` — clean on `src/routes/terms.tsx`
- [x] `biome lint` + `format` — zero diagnostics on the file
- [x] No `{{...}}` placeholders remain (verified by grep)
- [x] All three expected anchors present (MIT LICENSE URL, `/contact` href, `typekerf.com` mentions)

### Manual (you, before merge)

- [ ] Visit `/terms` in dev — page renders new 5-section content; no amber "template" banner
- [ ] Click "MIT License" link → opens https://github.com/shariski/kerf/blob/main/LICENSE in a new tab
- [ ] Click "contact" link → navigates to `/contact` (will 404 until PR #69 merges — see soft dependency below)
- [ ] Footer link to `/terms` from any chromed page still works

## Soft dependency on PR #69

The `/contact` link in the "Your account" section requires PR #69 (contact-page) to also be merged. Three resolutions:

1. **Merge #69 first, then #70** — link works the whole time. Natural order.
2. **Merge #70 first** — short dead-link window. Acceptable for a low-traffic page when both PRs are ready.
3. **Edit before merge** — swap `<a href="/contact">contact</a>` for `<a href="mailto:hello@typekerf.com">hello@typekerf.com</a>` to remove the dependency. Spec §3 chose against this for DRY reasons; happy to apply if preferred.

## Out of scope

- Uncommitted `pnpm-lock.yaml` change (TanStack `react-start` version bump for the dev-server crash) — currently stashed, needs its own destination.
- `kerf.app` placeholders left in `.env.example`, `DEPLOYMENT.md`, and the prior magic-link spec from PR #68 — separate `chore: replace kerf.app placeholders` PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" 2>&1 | tail -3
```

Expected: PR URL printed.

---

## Done

Once Task 2 Step 2 completes, `feat/simplify-terms` is ready for review. The branch contains 2 commits (1 spec from earlier + 1 implementation) and modifies 1 file.
