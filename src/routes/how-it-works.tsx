import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";

export const Route = createFileRoute("/how-it-works")({
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <DocPage
      title="How it works"
      lede="kerf picks exercises by watching which keys slow you down, which ones you miss, and which phase of the transition you're in."
    >
      <h2>The short version</h2>
      <p>
        Every session captures keystroke data — what you typed,
        what you meant to type, and how long each press took. The
        engine rolls that into per-character and per-bigram stats,
        assigns a <strong>weakness score</strong> to each unit, and
        picks words from a static English corpus that exercise the
        weakest ones. That's it. No LLMs, no gamified meta-score,
        no server-side ranking.
      </p>

      <h2>What the engine notices</h2>
      <p>For every keystroke you send, we record:</p>
      <ul>
        <li>
          The intended character and the actual character (which
          gives us error rate per key).
        </li>
        <li>
          The interval from the previous keystroke (which gives us
          average time per key and average time per two-letter
          combination — a bigram).
        </li>
        <li>
          Whether the press was a hesitation — defined as any
          interval more than ~2σ above your personal baseline.
        </li>
      </ul>
      <p>
        These events decay with age. Events older than 30 days get
        weighted down, so a keystroke from last week matters more
        than one from a year ago. This keeps the engine honest
        when you come back after a break: your recent typing
        dominates the picture.
      </p>

      <h2>Picking the next exercise</h2>
      <p>
        The weakness score for a unit <code>u</code> (either a
        letter or a bigram) is a weighted sum:
      </p>
      <p>
        <code>
          score(u) = α · error(u) + β · hesitation(u) + γ ·
          slowness(u) − δ · frequency(u)
        </code>
      </p>
      <p>
        The coefficients <code>α</code>, <code>β</code>,{" "}
        <code>γ</code>, <code>δ</code> are{" "}
        <strong>phase-aware</strong> — different for a
        transitioning user than for a refining one. During
        transition, errors carry the most weight (α is highest).
        Once you've stabilized, hesitation becomes the dominant
        lever (β takes over).
      </p>
      <p>
        A separate bonus weights the six inner-column keys —{" "}
        <code>B</code>, <code>G</code>, <code>H</code>,{" "}
        <code>N</code>, <code>T</code>, <code>Y</code> — higher
        during transition, because those are the keys whose
        positions are most different between staggered and
        columnar layouts and where most transitioners spend the
        longest adjusting.
      </p>

      <h2>Why it runs two ways</h2>
      <p>The engine has two modes, each with its own coefficient profile:</p>
      <ul>
        <li>
          <strong>Transitioning.</strong> You're still building
          muscle memory. Accuracy is fragile; speed will dip
          before it recovers. Expected. The engine emphasizes
          accuracy-weighted weaknesses and biases toward
          inner-column and cross-hand bigrams.
        </li>
        <li>
          <strong>Refining.</strong> You've stabilized. Accuracy
          is consistently high (≥ 95%) across ten or more
          sessions; inner-column error rate is below 8%. The
          engine now treats hesitation as the limiting factor,
          widens the corpus, and stops over-biasing the inner
          column.
        </li>
      </ul>
      <p>
        You can change phase manually at any time — the engine
        suggests a switch when the signals are strong, but you
        make the call.
      </p>

      <h2>What the engine deliberately doesn't do</h2>
      <ul>
        <li>
          <strong>No server-side content picking.</strong> The
          English word corpus is bundled with the app as a static
          JSON file, and exercise selection runs in your browser.
          Your stats travel to the server for persistence, not
          for ranking.
        </li>
        <li>
          <strong>No LLM generation.</strong> Exercises are
          word-picked from a curated list. This is deliberate —
          LLM content is a V2 feature, not a shortcut around
          grounding the training in real English frequency.
        </li>
        <li>
          <strong>No gamification.</strong> No streaks that
          punish you for skipping a day, no level-up animations,
          no "your accuracy dropped — try harder" nags. Accuracy
          drops are surfaced honestly; the engine explains why,
          not whether you should feel bad about it.
        </li>
      </ul>

      <h2>A worked example</h2>
      <p>
        Suppose you're twelve sessions into a Lily58 transition.
        Accuracy is 93%. The top three weaknesses the engine
        identified this week:
      </p>
      <ul>
        <li>
          <code>B</code> — error rate 14%, score 3.8
        </li>
        <li>
          bigram <code>er</code> — hesitation 1.9σ, score 3.3
        </li>
        <li>
          <code>T</code> — slow (178ms), score 2.6
        </li>
      </ul>
      <p>
        The next adaptive session will sample words whose
        characters or bigrams overlap those three targets. A
        transitioning coefficient profile means an over-index
        toward words containing <code>B</code>, <code>T</code>,
        and inner-column-dense words more generally. A
        refining-phase user with the same top-three would see a
        narrower pick — more bigram-heavy words, less inner-column
        bias.
      </p>
      <p>
        Every exercise on your dashboard has a small "how was
        this picked" box (the transparency panel) that shows the
        live formula + the current coefficient values + the top
        weaknesses being addressed. It's not hidden. It's the
        product.
      </p>
    </DocPage>
  );
}
