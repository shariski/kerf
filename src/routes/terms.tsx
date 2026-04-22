// TEMPLATE PLACEHOLDERS — replace before deploying to production:
//   {{COMPANY_NAME}}    → legal entity name
//   {{JURISDICTION}}    → governing law
//   {{CONTACT_EMAIL}}   → public contact
//   {{EFFECTIVE_DATE}}  → when these terms took effect

import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
});

function TermsPage() {
  return (
    <DocPage
      title="Terms of service"
      effectiveDate="{{EFFECTIVE_DATE}}"
      isTemplate
    >
      <h2>Who we are</h2>
      <p>
        kerf is operated by <strong>{"{{COMPANY_NAME}}"}</strong>,
        based in <strong>{"{{JURISDICTION}}"}</strong>. These
        terms apply every time you use the service.
      </p>

      <h2>The service</h2>
      <p>
        kerf is a typing-training platform designed for people
        transitioning between keyboard layouts, with a specific
        focus on columnar split keyboards. The service provides
        adaptive exercises, statistics, and insights based on
        your own typing data.
      </p>

      <h2>Accounts</h2>
      <p>
        You create an account by providing an email address and
        clicking the magic link we send you. You're responsible
        for the security of the device + email account you use
        to sign in. If someone else gains access to your email,
        they can access your kerf account.
      </p>

      <h2>Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Automate fake typing sessions, scrape the exercise
          corpus, or otherwise generate traffic that doesn't come
          from a human typing at a keyboard.
        </li>
        <li>
          Attempt to reverse-engineer the adaptive engine's
          server-side components, exploit authentication, or
          access other users' data.
        </li>
        <li>
          Use the service in a way that imposes an unreasonable
          load on the infrastructure.
        </li>
      </ul>

      <h2>Intellectual property</h2>
      <p>
        The kerf software, design, and content on this site are
        owned by <strong>{"{{COMPANY_NAME}}"}</strong>. You
        retain ownership of your own typing data; we hold it
        under the terms of the <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The service is provided "as is." We do our best to keep
        it running, accurate, and useful, but we don't guarantee
        any particular outcome — including, but not limited to,
        how fast you'll type after using it.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by{" "}
        <strong>{"{{JURISDICTION}}"}</strong> law,{" "}
        <strong>{"{{COMPANY_NAME}}"}</strong> is not liable for
        any indirect, incidental, or consequential damages
        arising out of your use of kerf.
      </p>

      <h2>Termination</h2>
      <p>
        You can delete your account at any time by emailing{" "}
        <strong>{"{{CONTACT_EMAIL}}"}</strong>. We can suspend
        accounts that violate these terms, with notice when
        reasonable.
      </p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of{" "}
        <strong>{"{{JURISDICTION}}"}</strong>. Any dispute will
        be handled in the courts of that jurisdiction.
      </p>

      <h2>Changes</h2>
      <p>
        If we materially change these terms, we'll post the new
        version here and bump the effective date. Continued use
        after a change means acceptance of the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        <strong>{"{{CONTACT_EMAIL}}"}</strong>
      </p>
    </DocPage>
  );
}
