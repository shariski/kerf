# Contact page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/contact` static page with email + GitHub Issues routing, plus footer entries (`contact`, `github`) so users have a discoverable path to reach the developer or browse the source.

**Architecture:** New static route at `/contact` reusing the existing `<DocPage>` layout primitive. Two new entries appended to the existing `LINKS` array in `AppFooter`, with a `kind: "internal" | "external"` discriminator so the render code branches between TanStack `<Link>` (internal) and `<a target="_blank">` (external) cleanly. No new components, no new dependencies, no server changes.

**Tech Stack:** React 19, TanStack Router (file-based routes), Vitest + Testing Library, existing `<DocPage>` component, Biome (lint + format), pnpm.

**Spec:** [`docs/superpowers/specs/2026-04-26-contact-page-design.md`](../specs/2026-04-26-contact-page-design.md)

**Branch:** `feat/contact-page` (already cut from `main` after PR #68 merged; spec already committed at `befa617`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/nav/AppFooter.test.tsx` | MODIFY | Update existing 2 tests for 7 links instead of 5; add 3 new tests for the external `github` link's attrs + aria-label + separator count |
| `src/components/nav/AppFooter.tsx` | MODIFY | Add `kind` discriminator to `LINKS`; append `contact` (internal) + `github` (external) entries; render branches on `kind` |
| `src/routes/contact.tsx` | CREATE | Static page using `<DocPage title="Contact" lede="...">`. Four sections per spec §5. |
| `DEPLOYMENT.md` | MODIFY | Append `## Domain & Email forwarding (typekerf.com)` checklist section |

**Decomposition rationale:** The footer change is the only piece with logic (the kind-discriminator branch in render code). It gets TDD treatment with extended tests first. The `/contact` page is pure static markup wrapping an existing layout primitive — no test needed (matches the convention for the 5 existing static DocPages, none of which have route tests). The `DEPLOYMENT.md` edit is a docs append. Verification sweep at the end ensures nothing regresses across the full suite.

---

## Task 1: Extend AppFooter (TDD)

**Files:**
- Modify: `src/components/nav/AppFooter.test.tsx`
- Modify: `src/components/nav/AppFooter.tsx`

The footer currently has 5 internal text links. We're adding `contact` (internal, slotted between `faq` and `privacy`) and `github` (external, between `contact` and `privacy`) — final order: how-it-works · why-split-is-hard · faq · contact · github · privacy · terms. The render code gets a branch on `kind` so external links use `<a target="_blank" rel="noopener noreferrer" aria-label="… (opens in new tab)">` while internals stay as TanStack `<Link>`.

- [ ] **Step 1: Update + extend the test file**

Replace the entire content of `src/components/nav/AppFooter.test.tsx` with:

```typescript
/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Mock TanStack Router's <Link> as a plain <a>; preserves all props we
// care about asserting on (href, className, etc.). Mirrors the existing
// pattern.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { AppFooter } from "./AppFooter";

afterEach(() => cleanup());

describe("AppFooter", () => {
  it("renders as a <footer role=contentinfo>", () => {
    const { container } = render(<AppFooter />);
    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
  });

  it("links to all 5 internal doc routes plus /contact", () => {
    render(<AppFooter />);
    const hrefs = [
      "/how-it-works",
      "/why-split-is-hard",
      "/faq",
      "/contact",
      "/privacy",
      "/terms",
    ];
    for (const href of hrefs) {
      const link = screen.getAllByRole("link").find((el) => el.getAttribute("href") === href);
      expect(link, `missing footer link to ${href}`).toBeTruthy();
    }
  });

  it("renders the github external link with correct attrs + aria-label", () => {
    render(<AppFooter />);
    const github = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href") === "https://github.com/shariski/kerf");
    expect(github, "missing github external link").toBeTruthy();
    expect(github!.getAttribute("target")).toBe("_blank");
    const rel = github!.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
    expect(github!.getAttribute("aria-label")).toMatch(/opens in new tab/i);
  });

  it("renders exactly 7 links (5 doc + contact + github) and no other textual links", () => {
    render(<AppFooter />);
    expect(screen.getAllByRole("link")).toHaveLength(7);
  });

  it("renders 6 separators between 7 links", () => {
    const { container } = render(<AppFooter />);
    const separators = container.querySelectorAll(".kerf-app-footer-sep");
    expect(separators).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test src/components/nav/AppFooter.test.tsx
```

Expected: at least the new tests FAIL — `links to all 5 internal doc routes plus /contact` will be missing the `/contact` href; `renders the github external link...` will fail to find the github link; `renders exactly 7 links` will see only 5.

If the existing two tests pass, that's expected (they're variants of the new ones with the old assertion counts).

- [ ] **Step 3: Update `AppFooter.tsx`**

Replace the entire content of `src/components/nav/AppFooter.tsx` with:

```typescript
/**
 * Global footer — thin explainer + legal link strip, rendered in
 * __root.tsx below the main app content on every non-chromeless route.
 *
 * Intentionally minimal per CLAUDE.md §B3: no copyright, no newsletter,
 * no "built with love in ___". One row of dotted links, nothing more.
 *
 * Each LINKS entry has a `kind` discriminator — internal entries route
 * via TanStack <Link> (client-side nav), external entries open in a
 * new tab with rel=noopener noreferrer (defeats reverse-tabnabbing +
 * strips Referer). The discriminator is explicit > implicit (per
 * CLAUDE.md §A1) — easier to reason about than detecting external
 * links via to.startsWith("http").
 */

import { Link } from "@tanstack/react-router";

const LINKS = [
  { kind: "internal", to: "/how-it-works", label: "how it works" },
  { kind: "internal", to: "/why-split-is-hard", label: "why split is hard" },
  { kind: "internal", to: "/faq", label: "faq" },
  { kind: "internal", to: "/contact", label: "contact" },
  { kind: "external", to: "https://github.com/shariski/kerf", label: "github" },
  { kind: "internal", to: "/privacy", label: "privacy" },
  { kind: "internal", to: "/terms", label: "terms" },
] as const;

export function AppFooter() {
  return (
    <footer className="kerf-app-footer" role="contentinfo">
      <div className="kerf-app-footer-row">
        {LINKS.map((link, i) => (
          <span key={link.to} className="kerf-app-footer-cell">
            {link.kind === "internal" ? (
              <Link to={link.to} className="kerf-app-footer-link">
                {link.label}
              </Link>
            ) : (
              <a
                href={link.to}
                className="kerf-app-footer-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} (opens in new tab)`}
              >
                {link.label}
              </a>
            )}
            {i < LINKS.length - 1 && (
              <span className="kerf-app-footer-sep" aria-hidden>
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm test src/components/nav/AppFooter.test.tsx
```

Expected: PASS — all 5 tests green.

If a test fails:
- "links to all 5 internal doc routes plus /contact" failing → check the LINKS array has the exact `to` strings expected by the test
- "renders the github external link..." failing → verify target/rel/aria-label attrs in the render code
- "renders 6 separators" failing → confirm the separator condition is `i < LINKS.length - 1` (with 7 links, that yields 6 separators)

- [ ] **Step 5: Format + lint the changed files**

Run:

```bash
./node_modules/.bin/biome format --write src/components/nav/AppFooter.ts src/components/nav/AppFooter.tsx src/components/nav/AppFooter.test.tsx
./node_modules/.bin/biome lint src/components/nav/AppFooter.tsx src/components/nav/AppFooter.test.tsx
```

Expected: format applies (likely no-op or minor reformat). Lint reports zero diagnostics on these two files.

(`AppFooter.ts` doesn't exist; the format command lists it just so a typo never silently misses a file — biome ignores nonexistent paths.)

- [ ] **Step 6: Commit**

```bash
git add src/components/nav/AppFooter.tsx src/components/nav/AppFooter.test.tsx
git commit -m "$(cat <<'EOF'
feat(footer): add contact + github links with kind discriminator

Extends LINKS from 5 entries to 7: appends 'contact' (internal,
slotted between faq and privacy) and 'github' (external, between
contact and privacy). Final order groups engagement paths between
info and legal: how-it-works · why-split-is-hard · faq · contact ·
github · privacy · terms.

The new `kind: "internal" | "external"` discriminator lets the
render code branch cleanly between TanStack <Link> (client-side
navigation) and <a target="_blank" rel="noopener noreferrer">
(external, with aria-label="... (opens in new tab)" for screen
readers). Discriminator-on-data is explicit > implicit per
CLAUDE.md §A1 — clearer than detecting external links via
to.startsWith("http").

Test coverage: existing 2 tests updated to reflect the new link
count + /contact href; 3 new tests assert the github link's
external attrs (target/rel/aria-label) and the separator count
(6 separators between 7 links). 5 tests total, all green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `/contact` page

**Files:**
- Create: `src/routes/contact.tsx`

This is a static route that wraps `<DocPage>` with the locked spec §5 content. No test file (matches convention — the 5 existing static DocPages have no route tests; only stateful routes like `onboarding.test.tsx` and `settings.test.tsx` do).

- [ ] **Step 1: Create the route file**

Create `src/routes/contact.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  return (
    <DocPage
      title="Contact"
      lede="There are a couple of ways to get in touch — depends on what's on your mind."
    >
      <h2>Found a bug? Have a feature idea?</h2>
      <p>
        If you've found a bug or thought of something kerf should do, GitHub Issues is a good
        home for it. Things filed there are easier to track, easier for others to follow, and
        easier to circle back to once they're fixed or shipped.
      </p>
      <p>
        →{" "}
        <a
          href="https://github.com/shariski/kerf/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          Report a bug or suggest a feature
        </a>{" "}
        (opens GitHub)
      </p>

      <h2>General questions or feedback</h2>
      <p>
        Anything else? Send a note to{" "}
        <a href="mailto:hello@typekerf.com">hello@typekerf.com</a> — questions, thoughts,
        things that don't quite fit the GitHub format.
      </p>

      <h2>The code</h2>
      <p>
        kerf's source is open under the MIT License — feel free to poke around, read the
        docs, or see what's coming next.
      </p>
      <p>
        →{" "}
        <a
          href="https://github.com/shariski/kerf"
          target="_blank"
          rel="noopener noreferrer"
        >
          github.com/shariski/kerf
        </a>{" "}
        (opens GitHub)
      </p>
    </DocPage>
  );
}
```

- [ ] **Step 2: Verify the route compiles + types are clean**

TanStack Router's file-based routing auto-generates `src/routeTree.gen.ts` based on the files in `src/routes/`. To regenerate it for the new route:

```bash
pnpm dev &
sleep 3
kill %1 2>/dev/null || true
```

(Starting the dev server briefly causes the router plugin to write the updated `routeTree.gen.ts`. Alternative: there may be a dedicated codegen command — check `package.json` scripts for `routes`, `gen`, or `codegen` and use that if present.)

Then run typecheck on the new file:

```bash
pnpm typecheck 2>&1 | grep -E "src/routes/contact\.tsx" | head -5
```

Expected: no output (no typecheck errors for the new file).

If typecheck shows errors specific to `contact.tsx`, common causes:
- Missing import: confirm `createFileRoute` and `DocPage` import paths are exact (the spec uses `#/components/doc/DocPage` — verify this alias resolves in the project's `tsconfig.json` paths config; should already be configured since other routes use it)
- `routeTree.gen.ts` not regenerated: re-run the dev-server-then-kill dance above

- [ ] **Step 3: Manually smoke-test the page in dev**

```bash
pnpm dev
```

Open `http://localhost:3000/contact` in your browser. Verify:
- Page loads with "Contact" heading
- Lede text reads "There are a couple of ways to get in touch — depends on what's on your mind."
- Three sections render with the headings: "Found a bug? Have a feature idea?", "General questions or feedback", "The code"
- Email link in the second section says `hello@typekerf.com` and is rendered as a clickable link
- Both GitHub links (issues + repo) are clickable

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Format + lint**

```bash
./node_modules/.bin/biome format --write src/routes/contact.tsx
./node_modules/.bin/biome lint src/routes/contact.tsx
```

Expected: format applies. Lint reports zero diagnostics.

- [ ] **Step 5: Commit**

`routeTree.gen.ts` is auto-generated and may have updated to register the new route — include it in the commit if it changed.

```bash
git add src/routes/contact.tsx src/routeTree.gen.ts
git commit -m "$(cat <<'EOF'
feat(contact): add /contact static page

Sixth DocPage in the chrome — wraps the existing <DocPage> primitive
with three sections per spec §5: GitHub Issues for bugs/features,
hello@typekerf.com for general questions, repo link for source code
browsing. All copy passes the §B3 voice audit (no exclamation marks,
no hype words, no solo/team-size framing, conversational not
imperative).

External links use rel=noopener noreferrer per spec §9 (defeats
reverse-tabnabbing, strips Referer header).

No route test added — matches convention for the 5 existing static
DocPages (faq, privacy, terms, how-it-works, why-split-is-hard);
only stateful routes (onboarding, settings) have colocated tests.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Update `DEPLOYMENT.md`

**Files:**
- Modify: `DEPLOYMENT.md`

Append a `## Domain & Email forwarding (typekerf.com)` section after the existing `## Email (Resend)` section.

- [ ] **Step 1: Append the new section**

Open `DEPLOYMENT.md`. After the last line of the existing file, append:

```markdown

## Domain & Email forwarding (typekerf.com)

- [ ] Set up DNS for `typekerf.com` to point at the production VPS.
- [ ] Configure email forwarding for `hello@typekerf.com` → your personal inbox.
  Cloudflare Email Routing (free, requires Cloudflare-managed DNS) and ImprovMX
  (free tier) are both reasonable choices. The `/contact` page surfaces only
  `hello@`; consider also setting up `support@typekerf.com` as an alias to the
  same inbox so users who guess that pattern don't dead-end.
- [ ] Smoke test after DNS lands: `mail hello@typekerf.com` from any external
  address; confirm arrival in your inbox.
```

(Make sure there's a blank line between the existing last line and the new `## Domain & Email forwarding (typekerf.com)` heading — markdown needs the blank line for the heading to render correctly.)

- [ ] **Step 2: Verify the file is well-formed**

```bash
tail -15 DEPLOYMENT.md
```

Expected: the new section appears at the end with three checkbox items, each readable.

- [ ] **Step 3: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "$(cat <<'EOF'
docs(deploy): add typekerf.com DNS + email-forwarding checklist

Adds the developer-scope (per CLAUDE.md §B9) actions needed before
the /contact page's hello@typekerf.com address dead-ends. Recommends
Cloudflare Email Routing or ImprovMX (both free) for forwarding to
the developer's personal inbox; suggests adding support@ as an alias
for users who guess that pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Final verification sweep + push

**Files:** none modified. End-of-slice §B12 check + push.

- [ ] **Step 1: Verify no new lint/format diagnostics on touched files**

```bash
./node_modules/.bin/biome lint src/components/nav/AppFooter.tsx src/components/nav/AppFooter.test.tsx src/routes/contact.tsx --reporter=summary 2>&1 | tail -5
```

Expected: zero errors and zero warnings on these specific paths.

```bash
./node_modules/.bin/biome format src/components/nav/AppFooter.tsx src/components/nav/AppFooter.test.tsx src/routes/contact.tsx 2>&1 | tail -3
```

Expected: `Checked N files. No fixes applied.`

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: AppFooter tests pass (5 of them); all other tests pass at the same count as on `main`.

If pre-existing tests fail (e.g. the typecheck-noise list documented in the prior PR's spec §12 — `journey.test.ts`, `motionPatterns.test.ts`, `drillLibrary.test.ts`, `keyboards.tsx`, `KeyboardThumbnail.tsx`, `profile.test.ts`'s `nickname` mismatch, `tests/a11y.spec.ts` — those are out of scope for this PR. Confirm none of YOUR new files appear in failure output.

- [ ] **Step 3: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep -E "src/routes/contact\.tsx|src/components/nav/AppFooter" | head -10
```

Expected: empty output (no typecheck errors in the files this PR touches).

If your new files DO appear:
- For `contact.tsx`: confirm `routeTree.gen.ts` was regenerated and committed (Task 2 Step 2/5)
- For `AppFooter.tsx`: confirm the `kind` discriminator's union literal types are inferred correctly (the `as const` assertion at the end of `LINKS` is what makes the discriminator narrow correctly)

- [ ] **Step 4: Verify git history is clean**

```bash
git log --oneline main..HEAD
git status
```

Expected: 4 new commits on `feat/contact-page` (in addition to the 1 pre-existing spec commit `befa617`):

1. `feat(footer): add contact + github links with kind discriminator`
2. `feat(contact): add /contact static page`
3. `docs(deploy): add typekerf.com DNS + email-forwarding checklist`
4. (no fourth commit needed — this verification task itself doesn't produce a commit)

`git status` should show only the unrelated `public/favicon-512.png` untracked (carried over from the prior session, not part of this work).

- [ ] **Step 5: Manual smoke test (developer)**

Final correctness check before opening the PR.

```bash
pnpm dev
```

Open the browser and verify each of these:

1. **`/contact`** — page renders with "Contact" heading, lede, three sections, all four external/email links visible.
2. **Click `mailto:hello@typekerf.com`** — opens default mail client with To: pre-filled.
3. **Click "Report a bug or suggest a feature"** — opens https://github.com/shariski/kerf/issues/new in a new tab; original kerf tab unchanged.
4. **Click "github.com/shariski/kerf"** — opens repo root in a new tab.
5. **From `/dashboard` (or any chromed page), look at the footer** — should see 7 links separated by `·`: how it works · why split is hard · faq · contact · github · privacy · terms.
6. **Click footer "contact"** — navigates to `/contact` (no full page reload — TanStack Router handles it).
7. **Click footer "github"** — opens https://github.com/shariski/kerf in a new tab; original tab unchanged.

Stop the dev server (Ctrl+C).

- [ ] **Step 6: Push and open the PR**

```bash
git push origin feat/contact-page
```

Then:

```bash
gh pr create --title "feat: add /contact page + footer entries (contact + github)" --body "$(cat <<'EOF'
## Summary

- New `/contact` static page (sixth DocPage) — three sections: GitHub Issues for bug reports + feature requests, `hello@typekerf.com` for general questions, repo link for source-code browsing.
- Two new footer entries — `contact` (internal) and `github` (external, opens in new tab with `rel=noopener noreferrer`). Final order: how it works · why split is hard · faq · contact · github · privacy · terms.
- `DEPLOYMENT.md` extended with the developer-scope DNS + email-forwarding checklist for `hello@typekerf.com` (per CLAUDE.md §B9).

## Spec

[`docs/superpowers/specs/2026-04-26-contact-page-design.md`](docs/superpowers/specs/2026-04-26-contact-page-design.md)

## Test plan

### Automated (passing)

- [x] `pnpm test src/components/nav/AppFooter.test.tsx` — 5 tests (extended from 3)
- [x] `pnpm typecheck` — clean on `src/routes/contact.tsx` and `src/components/nav/AppFooter.tsx`
- [x] `biome lint` + `format` — zero diagnostics on touched files

### Manual (you, before merge)

- [ ] Visit `/contact` in dev — page loads, all sections visible
- [ ] Click `mailto:` — opens default mail client with `hello@typekerf.com` pre-filled
- [ ] Click "Report a bug" → lands on GitHub new-issue form in a new tab
- [ ] Click "github.com/shariski/kerf" → lands on repo root in a new tab
- [ ] Footer (any page): click `contact` → navigates to `/contact`
- [ ] Footer (any page): click `github` → opens repo in a new tab

### Pre-deploy (developer scope per `DEPLOYMENT.md`)

- [ ] Set up `hello@typekerf.com` email forwarding (Cloudflare Email Routing or ImprovMX — both free)

## Out of scope

- The `kerf.app` placeholders left in `.env.example`, `DEPLOYMENT.md`, and the prior magic-link spec (PR #68) — production domain is `typekerf.com`, but fixing those references belongs in a separate `chore: replace kerf.app placeholders` PR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL when done.

---

## Done

Once Task 4 Step 6 completes, `feat/contact-page` is ready for review. The branch contains 4 new commits (1 spec from earlier + 3 implementation) and modifies/adds 4 files.
