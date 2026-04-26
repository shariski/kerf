# Magic-link email — Resend integration design

**Date:** 2026-04-26
**Branch:** `main` (work opens a new branch — suggested `feat/email-magic-link`)
**Replaces:** stub `sendMagicLink` callback in `src/server/auth.ts:72-80` (currently `console.log` in dev, `throw new Error("Email sending not configured — wire Resend in Phase 4")` in prod)
**Tracks:** `docs/03-task-breakdown.md:106-107` ("Configure the magic link plugin with a Resend driver; gate the driver behind `NODE_ENV` so local dev logs the magic link to the console instead of sending real email")
**Related task in `README.md` Status:** none yet — Phase 4.6/4.7 are post-Phase-5; this is in-Phase-4 polish work covered by §B11 once shipped.
**Status:** approved by user, ready for plan-writing

---

## 1. Context

The magic-link auth flow is fully wired through the UI (`src/routes/login.tsx:29` calls `authClient.signIn.magicLink`) and through better-auth's plugin (`src/server/auth.ts:72-80` registers a `sendMagicLink` callback). The only gap is the actual email transport: the callback throws in production with an explicit `Phase 4: wire Resend here using process.env.RESEND_API_KEY` comment.

The user has signed up for Resend and added `RESEND_API_KEY` to `.env`. They have **not** yet verified a custom sending domain — Resend requires DNS TXT records (SPF/DKIM) before allowing sends from anything other than `onboarding@resend.dev`. Per CLAUDE.md §B9, DNS verification stays in developer scope; this spec covers everything code-side.

This is the only auth-triggered email pathway scaffolded in the app. There is no password flow (`emailAndPassword: { enabled: false }`), no notifications, and no welcome email. So "implement email" reduces to: send a kerf-branded magic-link email via Resend in production, keep the dev console-log experience, and design a template that survives real-world email-client rendering quirks.

## 2. Goals & non-goals

**Goals:**

- Send the magic-link email via Resend in production with a kerf-branded HTML template.
- Keep dev defaults safe (no real sends) but provide an explicit opt-in for real-inbox testing.
- Always render and write a `/tmp/kerf-last-email.html` preview file in dev so template iteration doesn't require a network round-trip.
- Land template + transport with full unit-test coverage on the pure renderer and behavior-test coverage on the Resend boundary.
- Ship a `DEPLOYMENT.md` checklist item for the developer-scope DNS verification step.

**Non-goals (deferred):**

- Welcome / post-signup email. (Q1: chose A — magic-link only.)
- Generic email-service abstraction with template registry / retry queue / multi-channel transport. (Q1: chose A; §B6 forbids pre-building.)
- Custom-domain sending (`hello@kerf.app` etc.). Code is parameterized to swap via `EMAIL_FROM` once verified — but verification is developer scope.
- Auto-retry on Resend failure. (Q6c: failure must be visible to user, not papered over.)
- React Email components, MJML, or any template-build step. (Q5: chose A — single raw HTML file is simpler than abstracting for one template.)
- E2E test of the magic-link round trip. (§B8 — manual verification of main flow is sufficient for MVP.)
- Cross-client rendering test infrastructure (Litmus / Email on Acid). (Manual inbox check during `EMAIL_DEV_MODE=send` test before deploy is enough for Phase A.)
- Auto-refresh meta tag in the dev preview file. (Q6e: kept passive — auto-refresh would risk shipping into prod HTML if gating is forgotten.)

## 3. Decisions made during brainstorming

| Decision | Choice | Why |
|----------|--------|-----|
| **Q1.** Scope | A — magic-link only | Matches `docs/03-task-breakdown.md:106-107` verbatim. §B6 — no welcome / abstraction unless needed. |
| **Q2.** Sending domain | C — start with `onboarding@resend.dev`, parameterize via `EMAIL_FROM` | User has no verified custom domain yet. One env-var swap covers the eventual upgrade. DNS work stays developer scope per §B9. |
| **Q3.** Dev-mode behaviour | D — env-var opt-in (`EMAIL_DEV_MODE=send\|log`, default `log`) **AND** always write `/tmp/kerf-last-email.html` | Safe-by-default, explicit opt-in for real-inbox testing, preview file accelerates template iteration with zero network cost. |
| **Q4.** Email visual direction | A — Paper (light cream `#f5efe6` background, espresso `#211a14` ink, Fraunces wordmark, amber `#F59E0B` CTA, JetBrains Mono URL fallback) | Honors §B5 design discipline + §B4 a11y. Light templates dodge ~80% of email-client dark-mode-inversion bugs (Apple Mail, Gmail web, Outlook desktop). The brand voice carries through Fraunces + amber + voice — not through chromatic darkness. |
| **Q5.** Template implementation | A — single raw HTML in `src/server/email/magicLinkEmail.ts`, ~80 lines, zero new deps | YAGNI per §B6 / §A2. React Email is gold-plating for one template. |
| **Q6a.** Subject + copy | Subject: `Your kerf sign-in link`. Body, CTA, footer per §B3 — quiet, factual, no exclamation marks, no hype words. | §B3 accuracy-first copy guidelines. |
| **Q6b.** Plain-text alternative | Hand-written, included alongside HTML in every send | RFC 2822 multipart deliverability + a11y. Auto-strip-from-HTML produces ugly output. |
| **Q6c.** Error handling | Resend failures bubble after `console.error` log. No retry. | §B10 — magic-link failure must be visible so user can retry. Silent retry would mask real problems. |
| **Q6d.** Env vars | `EMAIL_FROM` (default `kerf <onboarding@resend.dev>`), `EMAIL_DEV_MODE` (default `log`), reuse `RESEND_API_KEY` | Minimum surface, all overridable, all documented in `.env.example`. |
| **Q6e.** Preview file behaviour | Always write in dev. No auto-refresh. Failures swallowed silently with one `console.warn`. | Preview is convenience, never blocks the actual flow. Auto-refresh meta tag would risk shipping to prod. |

## 4. Architecture

### File layout

```
src/server/
├── auth.ts                       # MODIFIED — sendMagicLink callback delegates to email module
└── email/
    ├── magicLinkEmail.ts         # NEW — pure render: ({email, url}) => {subject, html, text}
    ├── magicLinkEmail.test.ts    # NEW — unit tests for the renderer
    ├── send.ts                   # NEW — Resend transport + dev/prod switch + preview file
    └── send.test.ts              # NEW — unit tests for transport (Resend mocked)

.env.example                      # MODIFIED — Phase 4 marker removed; EMAIL_FROM + EMAIL_DEV_MODE added with comments

DEPLOYMENT.md                     # MODIFIED OR CREATED — adds "Verify Resend sending domain" pre-deploy checklist item

package.json                      # MODIFIED — adds "resend" dependency
```

**Why this split:**

- `magicLinkEmail.ts` is **pure** (string in → string out, no I/O, no `Date.now()`, no random). Testable without mocking anything. Mirrors §B1 domain/server philosophy at smaller scale.
- `send.ts` is the **impure boundary** — Resend client, console logs, file writes, env branching all live here. Single place to mock.
- `auth.ts` shrinks to a 1-line delegation; the Phase 4 throw + comment go away.
- The `email/` subfolder is the seed for future templates without touching `auth.ts` again — but per §B6, this spec adds zero pre-built infrastructure for hypothetical future emails.

## 5. Public interface

### `magicLinkEmail.ts`

```typescript
export type MagicLinkEmailInput = {
  email: string; // recipient (used for "to" only — not displayed in template body)
  url: string;   // the magic-link verification URL (drops into CTA href + URL fallback block)
};

export type RenderedEmail = {
  subject: string;
  html: string;  // multipart-ready, inline CSS only, no <link>/<script>/<style> blocks
  text: string;  // plain-text alternative
};

export function renderMagicLinkEmail(input: MagicLinkEmailInput): RenderedEmail;
```

Inputs are escaped before interpolation. Defense-in-depth — even though better-auth controls the URL today.

### `send.ts`

```typescript
export async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void>;
```

Internals (not exported):

- Lazy Resend client singleton — only instantiated when actually sending. Dev default never touches `Resend`.
- `getEmailFrom()` — reads `EMAIL_FROM`, defaults to `"kerf <onboarding@resend.dev>"`.
- `shouldSendInDev()` — reads `EMAIL_DEV_MODE === "send"`.
- `writePreviewFile(html)` — writes `/tmp/kerf-last-email.html`, swallows errors with one `console.warn`, dev only.

### `auth.ts` change

```diff
-import { magicLink } from "better-auth/plugins";
+import { magicLink } from "better-auth/plugins";
+import { sendMagicLinkEmail } from "./email/send";

   plugins: [
     magicLink({
-      sendMagicLink: async ({ email, url }) => {
-        if (process.env.NODE_ENV === "production") {
-          // Phase 4: wire Resend here using process.env.RESEND_API_KEY
-          throw new Error("Email sending not configured — wire Resend in Phase 4");
-        }
-        console.log(`\n[MAGIC LINK] Login link for ${email}:\n${url}\n`);
-      },
+      sendMagicLink: async ({ email, url }) => {
+        await sendMagicLinkEmail({ email, url });
+      },
     }),
   ],
```

## 6. Data flow

```
User submits email on /login
  │
  ▼
authClient.signIn.magicLink({ email })            [src/lib/auth-client.ts via src/routes/login.tsx:29]
  │
  ▼
better-auth POST /api/auth/magic-link/send
  │  (better-auth generates token, builds URL like
  │   https://<baseURL>/api/auth/magic-link/verify?token=...)
  ▼
sendMagicLink callback in auth.ts
  │  await sendMagicLinkEmail({ email, url });
  ▼
sendMagicLinkEmail()                              [src/server/email/send.ts]
  │
  ├── renderMagicLinkEmail({email, url}) → {subject, html, text}    [src/server/email/magicLinkEmail.ts]
  │
  ├── if dev: writePreviewFile(html)              [/tmp/kerf-last-email.html, best-effort]
  │
  └── branch on env:
       │
       ├── NODE_ENV === "production":
       │     resend.emails.send({from: EMAIL_FROM, to: email, subject, html, text})
       │       └── on error: console.error('[magic-link] Resend send failed:', err) then throw
       │
       ├── dev + EMAIL_DEV_MODE === "send":
       │     same as prod path
       │
       └── dev default:
             console.log(
               `[MAGIC LINK] ${email}\n` +
               `  url:     ${url}\n` +
               `  preview: /tmp/kerf-last-email.html`
             )

  Throws or returns up to better-auth, which surfaces to authClient.signIn.magicLink → login.tsx authError state.
```

**Key invariants:**

- The renderer never sees the verification token directly. better-auth passes the full URL — token is opaque to my code.
- The Resend client is lazy-initialized. A missing `RESEND_API_KEY` in dev default is fine and does not crash the import chain.

## 7. Behaviour: error handling

| Failure mode | Behaviour |
|---|---|
| Resend HTTP 4xx (invalid `from`, malformed `to`, etc.) | `console.error('[magic-link] Resend send failed:', err)` → throw → better-auth returns error → `authError` shown to user on `/login` |
| Resend HTTP 5xx (Resend service degraded) | Same as 4xx. **No automatic retry.** User sees error, can resubmit. |
| Network failure mid-request | Fetch error bubbles up via the same path; `console.error` logs. |
| `RESEND_API_KEY` missing in production | Lazy init throws on first send: `RESEND_API_KEY not set` |
| Preview file write fails | Silently swallowed with one `console.warn`. Preview is dev convenience; never blocks the user-facing flow. |
| `EMAIL_FROM` malformed | Not pre-validated. Resend will reject with 4xx, handled by the 4xx row above. Trust-the-boundary. |

## 8. Behaviour: dev mode

```
if NODE_ENV === "production":
  → always send via Resend (lazy init throws if key missing — fail loudly)
else (dev):
  → always render template
  → always write /tmp/kerf-last-email.html (best-effort; failures swallowed)
  → if EMAIL_DEV_MODE === "send": send via Resend (real-inbox test)
  → else (default): console.log the URL + preview file path
```

Dev console log format:

```
[MAGIC LINK] foo@example.com
  url:     http://localhost:3000/api/auth/magic-link/verify?token=abc...
  preview: /tmp/kerf-last-email.html
```

## 9. Behaviour: env config

`.env.example` block to replace the existing `# ── Email (Resend) ── Phase 4 only ──` block:

```bash
# ── Email (Resend) ─────────────────────────────────────────────────────────
# Sign up at https://resend.com and paste your API key.
# In dev, this is only consulted when EMAIL_DEV_MODE=send (see below).
RESEND_API_KEY=

# Friendly-name + sender address. Until you verify your own domain in Resend,
# you must send from "onboarding@resend.dev". Once your domain is verified,
# swap to e.g. "kerf <hello@kerf.app>" — no code change needed.
EMAIL_FROM=kerf <onboarding@resend.dev>

# Dev-only: "send" actually sends real emails to your inbox (handy for
# checking how Gmail/Apple Mail render the template). "log" (default)
# just console-logs the magic-link URL. Ignored in production.
EMAIL_DEV_MODE=log
```

## 10. Visual design — magic-link email template (Direction A: Paper)

| Element | Value |
|---|---|
| **Background** | `#f5efe6` (paper / cream) |
| **Body ink** | `#211a14` (espresso) — heading and primary text |
| **Secondary text** | `#4a3f33` (warm dark) — body copy |
| **Muted text** | `#8a7f72` — labels, footer, URL fallback |
| **Wordmark** | `kerf` — Fraunces, weight 300, font-variation-settings `"SOFT" 100`, font-size `30px`, letter-spacing `-0.02em`, color `#211a14`. Falls back to `Georgia, serif` when Fraunces unavailable. |
| **Heading** | `Sign in to kerf` — Inter 500, `17px` |
| **Body copy** | Inter 400, `14.5px`, line-height `1.55` |
| **CTA button** | Background `#F59E0B` (amber), color `#211a14`, padding `11px 22px`, border-radius `6px`, font-weight `500` |
| **URL fallback** | JetBrains Mono `11.5px`, background `rgba(0,0,0,0.04)`, padding `9px 11px`, border-radius `4px`, word-break `break-all` |
| **Footer disclaimer** | `11.5px`, color `#8a7f72`, separated by `1px solid rgba(0,0,0,0.08)` top border, padding-top `14px`, margin-top `18px` |
| **Container width** | Single column, max-width `~520px`, padding `36px 28px 32px` |

All CSS is **inline** on each element. No `<style>` blocks, no `<link>` tags, no `<script>`. This is enforced by a unit test (see §11).

### Copy (locked)

| Field | Text |
|---|---|
| Subject | `Your kerf sign-in link` |
| Wordmark | `kerf` |
| Heading | `Sign in to kerf` |
| Body | `Click the button below to sign in. The link works once and expires in 10 minutes.` |
| CTA button | `Sign in to kerf` |
| URL fallback label | `Or paste this URL into your browser:` |
| Footer | `If you didn't request this, you can ignore this email — no account changes will be made.` |

Plain-text alternative:

```
kerf

Sign in to kerf
───────────────

Open the link below to sign in. It works once and expires in 10 minutes.

{url}

If you didn't request this, you can ignore this email — no account changes will be made.
```

A reference HTML mockup at the visual direction was reviewed and approved during brainstorming. Saved at `.superpowers/brainstorm/13051-1777182092/content/email-design-direction.html` for future reference (not committed — `.superpowers/` is gitignored).

## 11. Testing strategy

Following §B8 — pure functions get exhaustive unit tests with deterministic inputs; impure boundaries get behavior tests with mocks; no E2E.

### `magicLinkEmail.test.ts` — pure renderer

| Test | Assertion |
|---|---|
| Smoke / shape | `renderMagicLinkEmail({email, url})` returns `{subject, html, text}`, all non-empty strings |
| Subject locked | `result.subject === "Your kerf sign-in link"` |
| HTML content | Contains wordmark `kerf`, heading `Sign in to kerf`, body phrase `10 minutes`, the input URL twice (CTA `href` + visible fallback), and the footer disclaimer |
| Email-client safety invariant | HTML contains **no** `<style>`, `<link>`, or `<script>` tags (regex check on the output) |
| Text content | Contains the URL on its own line and the disclaimer |
| URL escaping | If `url` contains `"><script>alert(1)</script>`, output HTML does not contain unescaped `<script>` |
| Idempotent | Two calls with identical input deep-equal each other |

### `send.test.ts` — transport (Resend mocked via `vi.mock("resend", ...)`)

`vi.stubEnv` controls per-test env. `vi.mock` replaces the `Resend` import with a `vi.fn()` constructor returning a fake client whose `emails.send` is a spy.

| Test | Assertion |
|---|---|
| Prod path | `NODE_ENV=production`, `EMAIL_FROM=kerf <hello@kerf.app>`, `RESEND_API_KEY=test`: calls `resend.emails.send` once with `{from, to, subject, html, text}` matching renderer output |
| Default `EMAIL_FROM` | `EMAIL_FROM` unset → uses `"kerf <onboarding@resend.dev>"` |
| Dev default | `NODE_ENV=development`, `EMAIL_DEV_MODE` unset: does NOT call Resend; console.log called with URL + preview path |
| Dev send opt-in | `NODE_ENV=development`, `EMAIL_DEV_MODE=send`, key set: calls Resend (same as prod) |
| Preview file in dev | Any dev mode → `/tmp/kerf-last-email.html` exists with the rendered HTML after the call |
| Preview write failure | Mock `fs` to throw on write → `sendMagicLinkEmail` does NOT throw; one `console.warn` recorded |
| Resend rejection | Mock `emails.send` to reject → `sendMagicLinkEmail` rethrows; `console.error` called once with the error |
| Lazy init | Dev default with `RESEND_API_KEY` unset: `sendMagicLinkEmail` does NOT crash (Resend constructor never called) |

### Manual test plan (executed by developer, not automated)

1. **Dev default, no key** — `pnpm dev` with `RESEND_API_KEY` unset. Submit email at `/login`. Expect console log with URL + preview file path. Open `/tmp/kerf-last-email.html` in browser; eyeball template.
2. **Dev send mode** — `EMAIL_DEV_MODE=send pnpm dev` with key set. Submit email. Real email lands in your inbox. Verify rendering in Gmail web, Gmail mobile (iOS or Android), and Apple Mail at minimum.
3. **Resend dashboard** — confirm the send is logged in Resend's "Emails" tab with right `from`, `to`, `subject`.
4. **Pre-prod handoff** — `DEPLOYMENT.md` lists "Before first prod deploy: verify your sending domain in Resend (TXT records — your scope per §B9)" so the user knows to swap `EMAIL_FROM` once verified.

## 12. Out-of-band cleanups (NOT included in this work)

Flagged for awareness, **not fixed by this spec**:

- **Pre-existing typecheck noise on `main`** — when this brainstorm session opened, ~25 TypeScript diagnostics surfaced across `journey.test.ts`, `motionPatterns.test.ts`, `drillLibrary.test.ts`, `keyboards.tsx` (missing `updateKeyboardProfile` export, missing `nickname` on `ProfileListEntry`), `KeyboardThumbnail.tsx`, etc. These appear to be artifacts of recent merges (PR #66, PR #67) and are unrelated to the email work. Per §A3 (surgical changes), this spec does not address them. Recommend a separate cleanup PR.
- The `# Phase 4 only` marker comment in `.env.example` is removed as part of this work (Phase 4 is now), but the broader Phase 4 status update in `README.md` `## Status` belongs to whichever PR closes the relevant Phase 4 task — which this work may or may not be (no numbered task in `README.md` directly tracks magic-link email send). Per §B11, ask before pre-ticking.

## 13. References

- Better-auth magic-link plugin docs: <https://www.better-auth.com/docs/plugins/magic-link>
- Resend Node SDK: <https://resend.com/docs/send-with-nodejs>
- Resend domain verification: <https://resend.com/docs/dashboard/domains/introduction>
- CLAUDE.md §A2 (simplicity), §B1 (domain/server split), §B3 (copy), §B6 (Phase A scope), §B8 (testing), §B9 (deploy boundary), §B10 (clarify), §B11 (status checkpoints), §B12 (lint/format), §B13 (pnpm)
- `docs/03-task-breakdown.md:106-107` (the originating Phase 4 task line)
- Visual reference (gitignored): `.superpowers/brainstorm/13051-1777182092/content/email-design-direction.html`
