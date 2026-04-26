# Contact page — design

**Date:** 2026-04-26
**Branch:** `feat/contact-page` (cut from `main` after PR #68 merged)
**Replaces:** nothing — net-new route + footer expansion
**Tracks:** no numbered task in `docs/03-task-breakdown.md` — user-driven addition surfaced after the magic-link email work shipped (PR #68 merged 2026-04-26 08:37 UTC)
**Status:** approved by user, ready for plan-writing

---

## 1. Context

kerf currently has no public contact path. Five footer-linked DocPages exist (`/how-it-works`, `/why-split-is-hard`, `/faq`, `/privacy`, `/terms`) — none of them surface an email, a GitHub repo link, or any way for a user to ping the developer. The `AppFooter` component renders the existing five links from a single `LINKS` array; the comment at the top of the file explicitly notes the footer is "intentionally minimal per CLAUDE.md §B3: no copyright, no newsletter, no 'built with love in ___'. One row of dotted links, nothing more."

The repo (`github.com/shariski/kerf`) is public as of 2026-04-26 (the user flipped visibility during this brainstorm). Issues are enabled; Discussions are not. The repo ships under MIT License (verified — `LICENSE` is 1.1K, MIT preamble).

The production app domain is `typekerf.com` (the user clarified during brainstorming — the prior magic-link work used `kerf.app` as a placeholder, which is a follow-up cleanup tracked in §11).

This spec adds:
1. A new `/contact` static page (sixth DocPage) with two engagement paths: GitHub Issues for bugs/features, email (`hello@typekerf.com`) for everything else.
2. Two new footer entries: `contact` (internal) and `github` (external, opens new tab).

## 2. Goals & non-goals

**Goals:**

- Provide a single discoverable destination for users who want to reach the developer.
- Route bug reports and feature requests to GitHub Issues (public, trackable, searchable, others can follow along).
- Surface the GitHub repo from the chrome (footer) so the open-source nature is visible from any page.
- Use the existing `<DocPage>` layout primitive — no new layout components.
- Honor §B3 voice: warm but reserved, conversational rather than directive, no exclamation marks, no over-promising on response times.

**Non-goals (deferred):**

- Contact form. Q1 chose the static-info-page scope; a `<form>` would add a server endpoint, validation, captcha-or-honeypot question, and rate limiting — all to deliver something a `mailto:` already does for 99% of users. Per §A2 / §B6.
- A "team" or "about" page. Solo-dev framing was explicitly dropped per user direction during brainstorming — the kerf brand should not telegraph its size.
- Response-time SLAs ("we reply within 24 hours" etc.). Soft commitments that can land worse than no commitment when missed. Dropped per user direction.
- A GitHub Discussions link or Discussions-based routing. Discussions are disabled on the repo; not enabling them as part of this work.
- A Discord / Twitter / X / status-page link. None of those exist for kerf yet; YAGNI per §B6.
- An icon for the GitHub footer link (any visual chrome beyond text). Would break the §B5 "footer is text-only by design" discipline; user agreed.
- A `contact.test.tsx` route test. The 5 existing static DocPages (`/faq`, `/privacy`, `/terms`, `/how-it-works`, `/why-split-is-hard`) have no test files — only stateful routes (`onboarding.test.tsx`, `settings.test.tsx`) do. Matching that convention.
- Updating the `/contact` page to mention `kerf.app`. Production domain is `typekerf.com`. The prior magic-link spec/code references to `kerf.app` are a known follow-up cleanup, not addressed here (§A3 surgical changes).

## 3. Decisions made during brainstorming

| # | Decision | Choice | Why |
|---|----------|--------|-----|
| **Q1** | Channel scope | B — static info page with GitHub-first routing | Bugs/features are easier to track + reference on GitHub; email is for everything else. Form (option C) is overkill per §A2. |
| **Q2** | Footer integration | B — both `contact` AND `github` text links in footer (7 total) | GitHub link signals openness/transparency to a tech audience; one-click "see the code" path from anywhere. Adding both in the existing dotted-row pattern preserves §B5 discipline. |
| **Q3** | Repo visibility | A — make repo public, design for public-state | User flipped repo visibility during brainstorm (was private, now public). Issues remain enabled. Discussions stay disabled. |
| **Q4a** | Email address | C — `hello@typekerf.com` (with `support@` as a forwarding alias, not surfaced on the page) | Branded address aligns with future Resend `EMAIL_FROM=kerf <hello@typekerf.com>` swap. `hello@` is friendlier than `support@` per §B3. The `support@` alias is for users who guess that pattern. |
| **Q4b** | Page URL | `/contact` | Matches existing simple-noun pattern (`/faq`, `/privacy`, `/terms`). |
| **Q4c** | GitHub link targets | Footer → repo root. `/contact` page bug-report CTA → `/issues/new` directly. | Footer link is browse-oriented (lets users find releases, README, code); page CTA is action-oriented (drops users in the new-issue form). |
| **Voice** | Tone after first revision | Conversational, not directive | User pushed back on the original "Bugs go on GitHub. Email for everything else." (imperative) — wanted friendlier, more welcoming. Final voice uses conditional openings ("If you've found a bug…", "Anything else?", "feel free to poke around") instead of imperatives. |
| **Voice** | Solo / part-time framing | Dropped | User explicitly removed "built by one person" and "replies in a few days" framing — should read as a polished product, not a transparent side-project. Avoids soft commitments that could disappoint. |

## 4. Architecture

### File map

```
src/routes/
└── contact.tsx                 # NEW — uses existing <DocPage> layout

src/components/nav/
├── AppFooter.tsx               # MODIFY — extend LINKS array, add discriminator
└── AppFooter.test.tsx          # MODIFY — assertions for the two new entries

DEPLOYMENT.md                   # MODIFY — append "Email forwarding for hello@typekerf.com"
                                # checklist item (developer scope per §B9)
```

**Total surface:** 4 files modified or created. No new components, no new dependencies, no new env vars, no new server routes, no schema migration.

### Decomposition rationale

- `/contact` is a static information page — doesn't need its own component file or extracted sub-components. The `<DocPage>` primitive already handles chrome (title, lede, container styling).
- `AppFooter` is the right place for both new footer entries — adding two entries to a uniform list, no new component needed. The existing `<Link>` (TanStack Router) handles internal navigation; an `<a target="_blank">` handles the external GitHub link.
- The `kind` discriminator on `LINKS` is **explicit > implicit** (per §A1 / Karpathy). Detecting external-vs-internal via `to.startsWith("http")` would work today, but the field self-documents the data and removes the future-developer's cost of re-deriving the rule.

## 5. Page content (locked, §B3-compliant)

### Route definition

```tsx
// src/routes/contact.tsx
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
        kerf's source is open under the MIT License — feel free to poke around, read the docs,
        or see what's coming next.
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

### Voice audit (§B3)

| Banned thing | Present? | Notes |
|---|---|---|
| Exclamation marks | None | Verified |
| Hype words ("amazing", "crushing", etc.) | None | Verified |
| Cheerleader tone | None | Conversational throughout |
| Soft response-time commitments | None | "Please bear with the latency" was removed per user direction |
| Solo / team-size framing | None | "Built by one person" was removed per user direction |
| Imperative voice / instructional tone | None | "If you've found…", "Anything else?", "feel free to…" — all conditional / conversational |

## 6. Footer integration

### Updated `LINKS` constant in `src/components/nav/AppFooter.tsx`

```typescript
const LINKS = [
  { kind: "internal", to: "/how-it-works",      label: "how it works" },
  { kind: "internal", to: "/why-split-is-hard", label: "why split is hard" },
  { kind: "internal", to: "/faq",               label: "faq" },
  { kind: "internal", to: "/contact",           label: "contact" },
  { kind: "external", to: "https://github.com/shariski/kerf", label: "github" },
  { kind: "internal", to: "/privacy",           label: "privacy" },
  { kind: "internal", to: "/terms",             label: "terms" },
] as const;
```

**Order rationale:** explainer pages (how/why) → reference (faq) → engagement paths (contact, github) → legal (privacy, terms). Groups "ways to engage with kerf" together rather than splitting them across the row.

### Updated render code

```tsx
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
      <span className="kerf-app-footer-sep" aria-hidden>·</span>
    )}
  </span>
))}
```

### Accessibility

- `aria-label="github (opens in new tab)"` on the external link — screen readers announce the new-tab behavior; sighted users see just "github" (preserves §B5 visual minimalism).
- `target="_blank" rel="noopener noreferrer"` for security (defeats reverse-tabnabbing) and privacy (no Referer leak to GitHub).
- Visible text stays lowercase to match the existing footer convention.

## 7. `DEPLOYMENT.md` addition

Append to the existing `## Email (Resend)` section (or create a new `## Domain` section if structurally cleaner):

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

## 8. Testing strategy

Following §B8.

### `src/components/nav/AppFooter.test.tsx` — extend existing

| Test | Assertion |
|---|---|
| All 7 links render | Query for each label by text; expect 7 matches |
| `contact` link is internal with correct href | TanStack `<Link>` resolves to `<a href="/contact">` in tests |
| `github` link is external with correct attrs | `href="https://github.com/shariski/kerf"`, `target="_blank"`, `rel` matches `/noopener.*noreferrer\|noreferrer.*noopener/` |
| `github` link has accessible label | `aria-label` matches `/opens in new tab/i` |
| Separator count | 6 `·` separators rendered (between 7 links) |

### `src/routes/contact.tsx` — no test file

Matches existing convention: `/faq`, `/privacy`, `/terms`, `/how-it-works`, `/why-split-is-hard` have **no** route test files because they are static markup wrapping `<DocPage>`. Only stateful routes (`onboarding.test.tsx`, `settings.test.tsx`) have colocated tests in this codebase.

### What we're not testing

- **Brand voice (no exclamation marks etc.)** — voice violations would land in source code that goes through code review, not be silently injected at runtime. The magic-link template needs the test because it has parameterized inputs; this page has none.
- **External link reachability** — would require a live network call. Manual verification at PR review time; broken-link monitoring is a separate concern.
- **Email DNS forwarding** — manual `DEPLOYMENT.md` checklist item per §B9.
- **E2E** — §B8 explicitly skips this for MVP.

### Manual test plan (executed by developer)

1. `pnpm dev` → visit `/contact` → page renders with all four sections, three external links + one mailto link visible.
2. Click `mailto:hello@typekerf.com` → opens default mail client with To: pre-filled.
3. Click "Report a bug or suggest a feature" → opens https://github.com/shariski/kerf/issues/new in a new tab; original tab unchanged.
4. Click "github.com/shariski/kerf" → opens repo root in a new tab.
5. From any chromed page (e.g. `/dashboard`), click footer "contact" → navigates to `/contact` (no full page reload — TanStack Router handles it).
6. From any chromed page, click footer "github" → opens repo in a new tab; original tab unchanged.
7. Pre-deploy (developer scope per §B9): set up `hello@typekerf.com` email forwarding per `DEPLOYMENT.md` checklist; smoke test with an external `mail` send.

## 9. External-link security & privacy hygiene

All `target="_blank"` external links use `rel="noopener noreferrer"`:

- **`noopener`** prevents the destination page from accessing `window.opener` and navigating the kerf tab via `window.opener.location = "evil-url"` (reverse tabnabbing). Browsers default to noopener-behavior for `target="_blank"` since ~2021, but explicit setting covers older clients and serves as documentation.
- **`noreferrer`** strips the `Referer` header so GitHub doesn't see which kerf page sent the user (privacy hygiene; prevents accidental leakage of in-app URLs that could contain session or query state).

## 10. Out-of-band cleanups (NOT included in this work)

Flagged for awareness, **not fixed by this spec**:

- **`kerf.app` references in prior magic-link work** — `.env.example`, `DEPLOYMENT.md`, and `docs/superpowers/specs/2026-04-26-magic-link-email-design.md` all use `kerf.app` as the example branded domain. The actual production domain is `typekerf.com`. Recommend a small follow-up PR (`chore: replace kerf.app placeholders with typekerf.com`) — single search-and-replace, no logic change.
- **GitHub Discussions** — disabled on the repo. If volume on Issues becomes high enough that it benefits from a Q&A vs. bug separation, enabling Discussions and updating the `/contact` page's "general questions" copy to point at Discussions instead of (or in addition to) email is a future consideration.

## 11. References

- CLAUDE.md §A1 (think before coding), §A2 (simplicity), §A3 (surgical changes), §B3 (copy), §B5 (design discipline), §B6 (Phase A scope), §B8 (testing), §B9 (deploy boundary), §B11 (status checkpoints), §B12 (lint/format), §B13 (pnpm)
- Existing DocPage references: `src/routes/faq.tsx`, `src/components/doc/DocPage.tsx`
- Existing footer: `src/components/nav/AppFooter.tsx`
- Cloudflare Email Routing: <https://developers.cloudflare.com/email-routing/>
- ImprovMX (alternative email forwarding): <https://improvmx.com/>
- TanStack Router `<Link>` API: <https://tanstack.com/router/latest/docs/framework/react/api/router/linkComponent>
