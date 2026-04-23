// TEMPLATE PLACEHOLDERS — replace before deploying to production:
//   {{COMPANY_NAME}}    → legal entity name (e.g. "Kerf Typing Labs Ltd.")
//   {{JURISDICTION}}    → governing law (e.g. "England and Wales")
//   {{CONTACT_EMAIL}}   → public contact (e.g. "legal@kerf.app")
//   {{EFFECTIVE_DATE}}  → when this policy took effect (e.g. "1 May 2026")
//   {{DATA_REGION}}     → where data is stored (e.g. "the European Union")
//   {{EMAIL_PROVIDER}}  → magic-link email service (e.g. "Resend, Inc.")
//   {{HOSTING}}         → infrastructure provider (e.g. "Hetzner Cloud, Germany")

import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <DocPage title="Privacy policy" effectiveDate="{{EFFECTIVE_DATE}}" isTemplate>
      <h2>Who we are</h2>
      <p>
        kerf is operated by <strong>{"{{COMPANY_NAME}}"}</strong>, based in{" "}
        <strong>{"{{JURISDICTION}}"}</strong>. Questions about this policy can be sent to{" "}
        <strong>{"{{CONTACT_EMAIL}}"}</strong>.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your email address, provided when you sign in via magic link.</li>
        <li>
          Your typing sessions — the sequence of keystrokes, which character was intended, which was
          actually typed, how long each press took, and whether you paused. This is the data that
          lets the adaptive engine work.
        </li>
        <li>
          Aggregate statistics we derive from those sessions — per-character error rate, per-bigram
          timing, split- specific metrics, weakness scores.
        </li>
        <li>
          Your keyboard profile — which layout you use, which phase the engine thinks you're in, and
          associated preferences.
        </li>
      </ul>
      <p>
        We do not use third-party analytics. We do not set cookies beyond the session cookie
        required to keep you signed in.
      </p>

      <h2>How we use it</h2>
      <p>We use the above data only to:</p>
      <ul>
        <li>Run the adaptive engine that picks your exercises.</li>
        <li>Render your dashboard and session summaries.</li>
        <li>Send you the magic-link email when you sign in.</li>
      </ul>
      <p>
        We do not sell your data. We do not share it with advertisers. We do not train
        machine-learning models on your typing.
      </p>

      <h2>Storage</h2>
      <p>
        Your data is stored in PostgreSQL on infrastructure in <strong>{"{{DATA_REGION}}"}</strong>,
        operated by <strong>{"{{HOSTING}}"}</strong>. Magic-link emails are delivered by{" "}
        <strong>{"{{EMAIL_PROVIDER}}"}</strong>; they receive your email address and the one-time
        link, and nothing else.
      </p>

      <h2>Your rights</h2>
      <p>
        You can request access to, or deletion of, your data by emailing{" "}
        <strong>{"{{CONTACT_EMAIL}}"}</strong>. We will respond within 30 days. Data deletion
        removes your account, your keyboard profiles, and every session + stat row associated with
        them.
      </p>

      <h2>Third parties</h2>
      <ul>
        <li>
          <strong>{"{{EMAIL_PROVIDER}}"}</strong> — magic-link email delivery.
        </li>
        <li>
          <strong>{"{{HOSTING}}"}</strong> — infrastructure for the app + database.
        </li>
      </ul>
      <p>No other third parties have access to your data.</p>

      <h2>Changes to this policy</h2>
      <p>We will post any material changes here and bump the effective date at the top.</p>

      <h2>Contact</h2>
      <p>
        <strong>{"{{CONTACT_EMAIL}}"}</strong>
      </p>
    </DocPage>
  );
}
