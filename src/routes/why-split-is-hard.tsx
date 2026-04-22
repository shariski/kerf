import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "#/components/doc/DocPage";

export const Route = createFileRoute("/why-split-is-hard")({
  component: WhySplitIsHardPage,
});

function WhySplitIsHardPage() {
  return (
    <DocPage
      title="Why split keyboard transition is hard"
      lede="Moving from a row-staggered QWERTY to a columnar split isn't a speed problem. It's a muscle-memory replacement project."
    >
      <h2>Why split keyboards break muscle memory</h2>
      <p>
        Row-staggered QWERTY keyboards evolved from typewriters.
        The columns of keys lean diagonally across the board, and
        your hands compensate for that lean with a thousand tiny
        wrist rotations you don't consciously feel. After a few
        years, that compensation <em>is</em> your typing.
      </p>
      <p>
        A columnar split keyboard — Sofle, Lily58, Corne, Moonlander —
        puts each column of keys in a straight vertical line, moves
        the two halves apart, and hands the thumbs a job they've
        never had: pressing modifiers, space, sometimes entire
        layers of content. Your accumulated wrist-compensation
        now produces the wrong output. The fingers land on the
        right <em>rows</em> but the wrong <em>columns</em>. Speed
        collapses. Accuracy collapses. You feel like you forgot
        how to type.
      </p>
      <p>
        This is temporary. It's also predictable. Roughly everyone
        goes through a two-to-eight-week dip before the new
        muscle memory knits. kerf is specifically built for that
        dip.
      </p>

      <h2>Why generic typing-speed apps don't help</h2>
      <p>
        Type-speed trainers (Monkeytype, Keybr, 10FastFingers)
        reward one thing: words per minute. Their training loops
        optimize for speed first, correcting errors second. For
        someone who already knows how to type and just wants to
        be faster, that's fine.
      </p>
      <p>
        For a transitioner, it's actively harmful. Chasing speed
        early locks in errors — you pound <code>V</code> where{" "}
        <code>B</code> should be, land on <code>M</code> instead
        of <code>N</code>, and the next session punishes you
        with a lower score. So you try harder, go faster, and
        lock the errors in deeper. A month later you've built a
        split-keyboard muscle memory that's the mirror image of
        what you wanted.
      </p>
      <p>
        kerf counter-programs this: accuracy comes first, the
        stat hierarchy says so, and the engine specifically
        over-indexes on the errors you're making right now, not
        on the speed you could hit if you ignored them.
      </p>

      <h2>What actually changes physically</h2>
      <p>
        Three concrete things are different between staggered
        QWERTY and a columnar split:
      </p>
      <ul>
        <li>
          <strong>Inner column.</strong> The six keys <code>B</code>,{" "}
          <code>G</code>, <code>H</code>, <code>N</code>,{" "}
          <code>T</code>, <code>Y</code> sit in a different place
          relative to your index finger. On a staggered board,{" "}
          <code>B</code> is reached by bending your left index
          finger inward. On a columnar split, <code>B</code> is
          directly below <code>G</code> and slightly outward,
          requiring an entirely different finger motion. This is
          where most split-keyboard errors originate.
        </li>
        <li>
          <strong>Thumb cluster.</strong> Your thumbs previously
          had one job — hit space. Now they press space,
          backspace, enter, and layer toggles. The choreography
          is new, and the new work is what kerf measures with the{" "}
          <em>thumb cluster decision time</em> metric.
        </li>
        <li>
          <strong>Cross-hand bigrams.</strong> Common bigrams that
          require moving between the two halves (<code>th</code>,{" "}
          <code>he</code>, <code>in</code>, <code>er</code>) get
          slower because there's physical distance between the
          halves now. They speed back up, but they speed up last.
          kerf calls this out as a dedicated metric so you can
          see the recovery happening.
        </li>
      </ul>

      <h2>What kerf does differently</h2>
      <ul>
        <li>
          <strong>Accuracy-weighted weakness scoring.</strong>{" "}
          Errors cost more during transition than during refining.
          The engine literally changes its coefficient profile
          based on which phase you're in.
        </li>
        <li>
          <strong>Inner-column bias.</strong> Words with{" "}
          <code>B</code>, <code>G</code>, <code>H</code>,{" "}
          <code>N</code>, <code>T</code>, <code>Y</code> show up
          more often in adaptive-mode exercises, because those
          are the keys where you actually need the reps.
        </li>
        <li>
          <strong>Split-specific metrics on the dashboard.</strong>{" "}
          Inner-column error rate, thumb cluster decision time,
          cross-hand bigram timing, columnar stability. These
          aren't vanity numbers; they're the specific axes along
          which transition progress shows up.
        </li>
        <li>
          <strong>Honest framing.</strong> When your speed drops
          while your accuracy holds, the session summary calls
          that good news. It is.
        </li>
      </ul>

      <h2>Who this is not for</h2>
      <p>kerf is deliberately narrow:</p>
      <ul>
        <li>
          Total beginners who don't touch-type yet — TypingClub
          or Keybr will serve you better.
        </li>
        <li>
          People on standard staggered boards — many good free
          alternatives.
        </li>
        <li>
          Colemak / Dvorak users — V2, maybe. Not Phase A.
        </li>
        <li>
          Users already comfortable on a split who just want to
          grind speed — Monkeytype is better for that specifically.
        </li>
      </ul>
    </DocPage>
  );
}
