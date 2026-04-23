import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";

export const Route = createFileRoute("/faq")({
  component: FaqPage,
});

function FaqPage() {
  return (
    <DocPage title="FAQ" lede="Short answers to common questions.">
      <h2>Do I need a specific keyboard?</h2>
      <p>
        In Phase A, kerf supports two layouts: <strong>Sofle</strong> and <strong>Lily58</strong>.
        Both are 58-key columnar splits with QWERTY base layers. If you're on a different layout,
        the adaptive engine will still work, but the finger-assignment tables won't match your
        physical keys.
      </p>

      <h2>Does it work with Corne / Ergodox / Moonlander / Glove80?</h2>
      <p>
        Not yet. Adding new keyboards means curating finger assignments per layout; we'd rather get
        two right than six wrong. Corne is the most-requested and the most likely next addition, but
        it's not scheduled.
      </p>

      <h2>Does it work with Colemak or Dvorak?</h2>
      <p>
        Not in Phase A. Alt-layouts are a V2 candidate — they require re-curating the word corpus
        and re-indexing the weakness tables against the new letter positions.
      </p>

      <h2>Why not just use Monkeytype?</h2>
      <p>
        Two reasons. First, Monkeytype rewards speed over accuracy from the start, which backfires
        during transition (see <a href="/why-split-is-hard">why split is hard</a>). Second,
        Monkeytype has no split-specific metrics — it can tell you you're slower, not that your
        inner-column error rate has dropped or your thumb cluster time is 100ms faster this week.
      </p>

      <h2>How is my data used?</h2>
      <p>
        Your sessions — keystrokes, timing, accuracy — are stored per-account and used only to run
        the adaptive engine and render your dashboard. We do not sell data, share data, or run
        third-party analytics on your typing. See <a href="/privacy">privacy</a> for the full
        breakdown.
      </p>

      <h2>Why does the app say I'm getting slower?</h2>
      <p>
        Because, during transition, you probably are — and that's usually fine. The engine tells you
        so honestly: speed dropping while accuracy holds is muscle memory forming, not regression.
        It shows back up a few weeks later with interest.
      </p>

      <h2>What is "transitioning" vs "refining"?</h2>
      <p>
        Transitioning is the early phase — you're still building split-keyboard muscle memory,
        accuracy is the limiting factor, and the engine over-indexes on errors + inner column.
        Refining is after you've stabilized — accuracy is consistently above 95%, inner-column error
        rate is below 8%, and the engine shifts to treating hesitation and flow as the limits worth
        optimizing.
      </p>

      <h2>Can I turn off the adaptive engine and just drill?</h2>
      <p>
        Yes — that's drill mode. Pick a letter, bigram, or a preset (inner column, thumb cluster,
        cross-hand bigrams) and get a focused synthetic exercise instead of an adaptive word pick.
      </p>

      <h2>How long until I'm fast on my split?</h2>
      <p>
        Honest range from beta testing: two to eight weeks depending on how much you type and how
        different your previous keyboard was from columnar. The speed recovery curve is usually
        steep for the first week (you get back about 30% of your previous speed), flat for two to
        three weeks (muscle memory is knitting), then steep again.
      </p>

      <h2>Is my typing data ever shared?</h2>
      <p>No.</p>

      <h2>Can I export my data?</h2>
      <p>Not yet. Export is scheduled for V2.</p>

      <h2>Is there a mobile app?</h2>
      <p>
        No. kerf is fundamentally a physical-keyboard product — there's nothing a touch screen can
        meaningfully practice. Opening kerf on a phone shows a gate asking you to come back at your
        desk.
      </p>
    </DocPage>
  );
}
