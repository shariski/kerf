import type { SessionTarget } from "#/domain/adaptive/targetSelection";

/**
 * Intent echo — displayed after a session to reflect what the user
 * targeted, how each key performed, and a soft forward-looking preview.
 *
 * Used by both PostSessionStage (adaptive) and DrillPostSessionStage (drill).
 * All props are optional so callers include only what they have available.
 *
 * ADR-003 §4 Stage 3 / Task 18 Gap 5.
 */

type Props = {
  sessionTarget?: SessionTarget;
  perKeyBreakdown?: { key: string; accuracy: number; attempts: number }[];
  nextTargetPreview?: string | null;
};

export function IntentEchoBlock({ sessionTarget, perKeyBreakdown, nextTargetPreview }: Props) {
  if (!sessionTarget && (!perKeyBreakdown || perKeyBreakdown.length === 0) && !nextTargetPreview) {
    return null;
  }

  return (
    <section className="kerf-intent-echo" aria-label="Intent recap">
      {sessionTarget && (
        <div className="kerf-intent-echo-block">
          <div className="kerf-intent-echo-eyebrow">you targeted</div>
          <div className="kerf-intent-echo-target">{sessionTarget.label}</div>
        </div>
      )}

      {perKeyBreakdown && perKeyBreakdown.length > 0 && (
        <div className="kerf-intent-echo-block">
          <div className="kerf-intent-echo-eyebrow">how it went on those keys</div>
          <ul className="kerf-intent-echo-key-list">
            {perKeyBreakdown.map((row) => (
              <li key={row.key} className="kerf-intent-echo-key-row">
                <span className="kerf-intent-echo-key-cap" aria-hidden>
                  {row.key === " " ? "␣" : row.key.toUpperCase()}
                </span>
                <span className="sr-only">
                  Key {row.key === " " ? "space" : row.key.toUpperCase()}:
                </span>
                <span className="kerf-intent-echo-key-acc">{(row.accuracy * 100).toFixed(0)}%</span>
                <span className="kerf-intent-echo-key-acc-label">accuracy</span>
                <span className="kerf-intent-echo-key-sep" aria-hidden>
                  ·
                </span>
                <span className="kerf-intent-echo-key-attempts">
                  {row.attempts} attempt{row.attempts === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextTargetPreview && (
        <div className="kerf-intent-echo-block">
          <div className="kerf-intent-echo-eyebrow">next focus</div>
          <div className="kerf-intent-echo-next">
            <span className="kerf-intent-echo-next-value">{nextTargetPreview}</span>
            <span className="kerf-intent-echo-next-note">
              you can override by picking a drill mode
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
