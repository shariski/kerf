# Deployment checklist

This document tracks the **developer-scope** actions required before
deploying kerf to production. Per CLAUDE.md §B9, anything that touches
production secrets, the VPS, or external service dashboards lives here
— Claude Code generates artifacts but does not execute these steps.

---

## Email (Resend)

- [ ] Sign up at <https://resend.com> (free tier: 3,000 emails / month).
- [ ] Paste the API key into the production `.env` as `RESEND_API_KEY`.
- [ ] **Verify your sending domain** at <https://resend.com/domains>:
  add the SPF + DKIM TXT records to your DNS provider (Cloudflare,
  Route 53, Namecheap, etc.), then click "Verify" in the Resend
  dashboard. Until verified, sends are restricted to
  `onboarding@resend.dev`.
- [ ] Once verified, set `EMAIL_FROM` in the production `.env` to your
  branded address — e.g. `kerf <hello@typekerf.com>`. No code change is
  needed; `src/server/email/send.ts` reads this env var with the
  sandbox sender as the default fallback.
- [ ] Smoke test after first deploy: trigger a magic-link send from the
  production `/login` page. Confirm the email arrives within ~30
  seconds and renders correctly in **at minimum** Gmail web + Apple
  Mail. (See `docs/superpowers/specs/2026-04-26-magic-link-email-design.md`
  §11 for the full manual test plan.)

## Domain & Email forwarding (typekerf.com)

- [ ] Set up DNS for `typekerf.com` to point at the production VPS.
- [ ] Configure email forwarding for `hello@typekerf.com` → your personal inbox.
  Cloudflare Email Routing (free, requires Cloudflare-managed DNS) and ImprovMX
  (free tier) are both reasonable choices. The `/contact` page surfaces only
  `hello@`; consider also setting up `support@typekerf.com` as an alias to the
  same inbox so users who guess that pattern don't dead-end.
- [ ] Smoke test after DNS lands: `mail hello@typekerf.com` from any external
  address; confirm arrival in your inbox.
