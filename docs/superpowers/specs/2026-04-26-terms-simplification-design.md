# Terms page simplification — design

**Date:** 2026-04-26
**Branch:** `feat/simplify-terms` (cut from `main`)
**Replaces:** the legal-template content currently in `src/routes/terms.tsx` (9 sections, `{{COMPANY_NAME}}` / `{{JURISDICTION}}` / `{{CONTACT_EMAIL}}` / `{{EFFECTIVE_DATE}}` placeholders)
**Status:** approved by user, ready for plan-writing

---

## 1. Context

`src/routes/terms.tsx` today is a 9-section legal-template Terms of Service with four placeholder tokens that need to be filled in before deploying to production. It was built (per the original `Task 4.5` documentation work) as a corporate-template ToS to be customized when kerf got a legal entity / jurisdiction.

The actual state of kerf today:
- Solo open-source project, no legal entity.
- Public GitHub repo at `github.com/shariski/kerf`, MIT-licensed (committed `LICENSE` file).
- No payments, no PII beyond email-for-magic-link, no third-party data sharing.
- Production domain: `typekerf.com`.

The user requested simplification with the framing: *"i don't need that complicated. just make it simple. i've also have the LICENSE in github, so it should be relevant."* The MIT LICENSE handles legal coverage of the source code; the page should focus on what users actually need to know about the **hosted service**.

## 2. Goals & non-goals

**Goals:**

- Cut the page from 9 sections to ~5 sections + a one-line lede.
- Remove all `{{PLACEHOLDER}}` tokens — the page should ship as final content, not a template.
- Reference the MIT LICENSE on GitHub for source-code legal coverage.
- Keep the bare essentials for a hosted service: as-is disclaimer, acceptable-use rules, account-deletion path, change-notice clause.
- Honor §B3 voice — match the warmth of the new `/contact` page, not the corporate-template feel of the old `/terms`.
- Drop the `isTemplate` `<DocPage>` prop (which renders an amber "this page is a template" banner — no longer applicable).

**Non-goals (deferred):**

- Full corporate ToS with legal entity, jurisdiction, formal limitation-of-liability, governing law. Solo OSS dev with MIT LICENSE on the code doesn't need this; MIT covers the source-code liability shield. For the hosted service, "as-is" + "acceptable use" + "account deletion" suffice.
- Privacy policy changes. `/privacy` is its own concern and out of scope for this work.
- Translating the page. English-only for Phase A.
- Versioned ToS history (e.g. `/terms/v1`, `/terms/v2`). YAGNI — solo project, traffic too low to justify.

## 3. Decisions made during brainstorming

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| **Q1** | Simplification level | B — lean ToS (~5 sections + lede), drop legal-template padding | Ultra-minimal (option A) is legally thin for a hosted service; placeholder-blank (option C) keeps the corporate-template feel. B keeps what actually matters without over-building per §B6. |
| **Voice** | Tone | Match `/contact` (calm, conversational, "things to please not do" instead of imperative "Don't") | Continues the friendlier voice the user landed on for `/contact`; consistent across the chrome's static pages. |
| **Voice** | First-person pronoun | Drop "we" where possible; use passive voice ("Accounts that violate ... can be suspended") instead of "we can suspend you" | Sidesteps the solo / team-size signaling the user explicitly removed from `/contact`. |
| **`/contact` reference** | Use `[contact](/contact)` link rather than embedding `mailto:hello@typekerf.com` directly in the ToS | DRY — `/contact` is the canonical engagement page, surfaces both email + GitHub issues. Note: this creates a soft dependency on PR #69 (contact-page) merging before or alongside this PR. Dead-link window during PR overlap is acceptable (user controls merge order). |

## 4. Architecture

**One file modified, no new files, no new components.**

```
src/routes/terms.tsx                 # MODIFY — replace entire body of TermsPage()
                                      and drop the template-comment block at top
```

No test file (matches existing convention — none of the 6 static DocPages have route tests).

No changes to `<DocPage>` itself — the `effectiveDate` and `isTemplate` props are existing API; we simply drop `isTemplate` and supply a real `effectiveDate` value.

## 5. Page content (locked, approved)

### Route file

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

### Voice audit (§B3)

| Banned thing | Present? |
|---|---|
| Exclamation marks | None |
| Hype words | None |
| Solo / team-size framing | None ("for how to get in touch", not "to reach me") |
| Imperative voice | Avoided — "things to please not do" softens the rules; "Accounts that violate" is passive |
| Soft response-time commitments | None |

### Dropped sections (with rationale)

| Section in current `/terms` | Treatment | Why |
|---|---|---|
| Who we are (`{{COMPANY_NAME}}` / `{{JURISDICTION}}`) | Dropped | Solo OSS, no entity. Lede paragraph anchors what kerf is. |
| The service | Kept, simplified | Same intent, fewer words. |
| Accounts (magic-link explanation) | Dropped | Belongs in `/how-it-works`, not ToS. |
| Acceptable use | Kept, simplified to 3 bullets | Same intent, no behavioral change. |
| Intellectual property | Dropped — replaced by "The code" linking to MIT LICENSE | LICENSE file is authoritative; ToS just points at it. |
| Disclaimer | Merged into "The service" ("provided as-is") | Same intent. |
| Limitation of liability | Dropped | MIT LICENSE handles source-code liability; the as-is disclaimer in "The service" covers the hosted side informally. |
| Termination | Merged into "Your account" | Same intent in passive voice. |
| Governing law | Dropped | No formal jurisdiction setup as a solo dev. |
| Changes | Kept, simplified | Same intent, fewer words. |
| Contact | Dropped | Redundant with new `/contact` page. |

**Net:** 9 sections → 5 sections + 1 lede paragraph. ~80 lines of JSX → ~40 lines.

## 6. Testing strategy

Following §B8.

**No test file added.** Matches existing convention: `/faq`, `/privacy`, `/terms`, `/how-it-works`, `/why-split-is-hard`, `/contact` (PR #69) all have no route tests because they are static markup wrapping `<DocPage>`. Only stateful routes have colocated tests.

**Manual verification (PR description checklist):**

1. `pnpm dev` → visit `/terms` → page renders with new content; no `{{PLACEHOLDER}}` strings visible; no amber "template" banner at the top.
2. Click MIT LICENSE link → opens `https://github.com/shariski/kerf/blob/main/LICENSE` in a new tab.
3. Click contact link → navigates to `/contact` (will 404 until PR #69 also merges; this is expected and noted in the PR description).
4. Footer link to `/terms` from any chromed page still works (no AppFooter changes here).

## 7. External-link security

Following the same pattern as `/contact` (spec §9 of the contact-page work):

- The MIT LICENSE link uses `target="_blank" rel="noopener noreferrer"` — defeats reverse-tabnabbing, strips Referer.
- The mailto link in the contact-redirect copy is via `/contact` page (not directly here).

## 8. Out-of-band cleanups (NOT included in this work)

Flagged for awareness, **not fixed by this spec**:

- **Pre-existing main branch issues** are out of scope per §A3 (typecheck noise, profile.test.ts nickname mismatch, tests/a11y.spec.ts dev-server dependency, etc.).
- **Uncommitted `pnpm-lock.yaml` change** — bumping `@tanstack/react-start` from `1.167.41` to `1.167.49` to fix a `Cannot read properties of undefined (reading 'method')` crash in the dev server (matches the symptom documented in CLAUDE.md §B13). Currently stashed; needs its own destination (separate `chore` PR or merge to main directly). NOT part of this PR.
- **`kerf.app` placeholders in `.env.example`, `DEPLOYMENT.md`, and the magic-link spec from PR #68** — production domain is `typekerf.com`. Tracked as a follow-up cleanup PR; not addressed here.

## 9. References

- Current page: `src/routes/terms.tsx`
- LICENSE file: `LICENSE` (repo root)
- Public LICENSE URL: `https://github.com/shariski/kerf/blob/main/LICENSE`
- DocPage component: `src/components/doc/DocPage.tsx` (props: `title`, `lede?`, `isTemplate?`, `effectiveDate?`)
- Sister `/contact` page (PR #69): `src/routes/contact.tsx` — same DocPage pattern, same external-link hygiene, same voice
- CLAUDE.md sections: §A2 (simplicity), §A3 (surgical changes), §B3 (copy), §B6 (Phase A scope), §B8 (testing), §B9 (deploy boundary)
