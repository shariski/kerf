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
    <>
      {sessionTarget && (
        <section className="space-y-2 mb-6">
          <p className="text-sm text-kerf-text-secondary">You targeted:</p>
          <p className="text-lg text-kerf-text-primary">{sessionTarget.label}</p>
        </section>
      )}

      {perKeyBreakdown && perKeyBreakdown.length > 0 && (
        <section className="mb-6">
          <h3 className="text-sm text-kerf-text-secondary mb-2">How it went on those keys</h3>
          <table className="w-full text-sm">
            <tbody>
              {perKeyBreakdown.map((row) => (
                <tr key={row.key}>
                  <td className="font-mono text-kerf-text-primary pr-4">
                    {row.key === " " ? "space" : row.key.toUpperCase()}
                  </td>
                  <td className="text-kerf-text-secondary">
                    {(row.accuracy * 100).toFixed(0)}% accuracy · {row.attempts} attempts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {nextTargetPreview && (
        <section className="mb-6">
          <p className="text-sm text-kerf-text-secondary">
            Next session will likely focus on:{" "}
            <span className="text-kerf-text-primary">{nextTargetPreview}</span>. You can override by
            picking a drill mode.
          </p>
        </section>
      )}
    </>
  );
}
