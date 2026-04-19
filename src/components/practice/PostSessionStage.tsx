/**
 * Minimal post-session placeholder for Task 2.4.
 *
 * Intentionally lean — the full summary card (accuracy/WPM pair, phase
 * framing, drill CTAs) lands in Task 2.5 once `computeStats` is wired to a
 * session record. Here we just close the loop so the user can start another
 * exercise via mouse or Enter.
 *
 * Copy honors CLAUDE.md §B3: a flat "Session complete." — no "Great job!",
 * no exclamation marks, no stats framed as a win.
 */

type Props = {
  onPracticeAgain: () => void;
};

export function PostSessionStage({ onPracticeAgain }: Props) {
  return (
    <div className="kerf-post-session">
      <h2 className="kerf-post-session-title">Session complete.</h2>
      <p className="kerf-post-session-subtitle">
        Your detailed summary will land here in the next update.
      </p>
      <button
        type="button"
        onClick={onPracticeAgain}
        className="kerf-post-session-cta"
      >
        Practice again
        <span className="kerf-post-session-shortcut">⏎</span>
      </button>
    </div>
  );
}
