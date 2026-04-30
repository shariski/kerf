import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";
import { canonicalLink } from "#/lib/seo-head";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service | kerf" },
      {
        name: "description",
        content:
          "kerf terms of service. Use at your own discretion; the platform is in active development.",
      },
      { property: "og:url", content: "https://typekerf.com/terms" },
    ],
    links: [canonicalLink("/terms")],
  }),
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
        (opens GitHub). You can read it, fork it, run your own copy — the LICENSE file has the full
        text.
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
        You can delete your account at any time — see <a href="/contact">contact</a> for how to get
        in touch. Accounts that violate these terms can be suspended, with notice when reasonable.
      </p>

      <h2>Changes</h2>
      <p>
        If these terms materially change, the new version goes here and the effective date above
        updates. Continued use after a change means acceptance.
      </p>
    </DocPage>
  );
}
