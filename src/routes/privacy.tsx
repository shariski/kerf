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
    <DocPage title="Privacy" effectiveDate="2026-09-30">
      <p>
        Short version: kerf stores your account and typing data. If you use Coach, we send a summary
        of your typing patterns to DeepSeek to prepare practice passages.
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
        <li>Coach usage and your optional answer to whether a passage was useful.</li>
      </ul>
      <p>
        We do not use third-party analytics or advertising trackers. Sign-in uses the cookies needed
        to keep you signed in.
      </p>

      <h2>How it's used</h2>
      <p>Only to:</p>
      <ul>
        <li>Run the adaptive engine that picks your exercises.</li>
        <li>Render your dashboard and session summaries.</li>
        <li>Send the magic-link email when you sign in.</li>
        <li>Prepare focused Coach passages and learn whether they are useful.</li>
      </ul>
      <p>
        For Coach, our server sends DeepSeek an aggregated diagnostic report: counts of typing
        confusions, character and bigram error rates, and timing averages. We do not send your
        email, name, full session text, or raw keystroke stream in that request. Generated passages
        may be reused for other users with similar practice needs. DeepSeek receives the summary to
        generate the passage; see its{" "}
        <a href="https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html">
          Open Platform terms
        </a>
        . We do not sell typing data to advertisers or use raw sessions to train our own models.
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
