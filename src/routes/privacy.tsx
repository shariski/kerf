import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";
import { canonicalLink } from "#/lib/seo-head";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy | kerf" },
      {
        name: "description",
        content:
          "kerf privacy policy: what data is collected (keystrokes, accounts), how it's stored, and your rights.",
      },
      { property: "og:url", content: "https://typekerf.com/privacy" },
    ],
    links: [canonicalLink("/privacy")],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <DocPage title="Privacy" effectiveDate="2026-04-26">
      <p>
        Short version: kerf stores your email and your typing data. Nothing else, nowhere else, no
        third parties beyond what magic-link sign-in needs.
      </p>

      <h2>What's collected</h2>
      <ul>
        <li>
          Your email address — given when you sign in via magic link, or by Google or GitHub if you
          choose social sign-in.
        </li>
        <li>
          Your typing sessions — the sequence of keystrokes, what was intended vs. what you typed,
          timing per press, pauses. This is what the adaptive engine uses to pick your exercises.
        </li>
        <li>
          Aggregate stats derived from sessions — per-character error rates, per-bigram timing,
          weakness scores, your phase, your keyboard profile.
        </li>
      </ul>
      <p>
        That's it. No third-party analytics, no advertising trackers, no cookies beyond the one
        needed to keep you signed in.
      </p>

      <h2>How it's used</h2>
      <p>Only to:</p>
      <ul>
        <li>Run the adaptive engine that picks your exercises.</li>
        <li>Render your dashboard and session summaries.</li>
        <li>Send the magic-link email when you sign in.</li>
      </ul>
      <p>
        Your typing data is never sold, never shared with advertisers, never used to train
        machine-learning models.
      </p>

      <h2>Your rights</h2>
      <p>
        You can delete your account at any time — see <a href="/contact">contact</a> for how to get
        in touch. Deletion removes your account, your keyboard profiles, and every session and stat
        row associated with them. If you want a copy of your data first, ask in the same place.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy materially changes, the new version goes here and the effective date above
        updates.
      </p>
    </DocPage>
  );
}
