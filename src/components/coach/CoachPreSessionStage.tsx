import type { WhyReport } from "#/domain/coach/whyReport";

type Props = {
  report: WhyReport;
  quota: { usedToday: number; remaining: number };
  onStart: () => void;
};

export function CoachPreSessionStage({ report, quota, onStart }: Props) {
  const top = report.mechanisms[0];
  const exhausted = quota.remaining <= 0;

  return (
    <section className="kerf-coach-pre" aria-label="Coach session briefing">
      <h2 className="kerf-coach-title">Coach</h2>
      <p className="kerf-coach-subtitle">
        One personalized session per day. Based on your last {report.totalTrueConfusions} slips.
      </p>

      {top ? (
        <div className="kerf-coach-brief">
          <p className="kerf-coach-mechanism">
            <strong>{top.mechanism}</strong> — {top.sharePct}% of your slips, averaging {top.avgMs}
            ms per keystroke.
          </p>
          {top.topConfusions[0] && (
            <p className="kerf-coach-detail">
              Most common: typed <code>{top.topConfusions[0].typedAs}</code> instead of{" "}
              <code>{top.topConfusions[0].target}</code> ({top.topConfusions[0].count} times).
            </p>
          )}
        </div>
      ) : (
        <p className="kerf-coach-mechanism">Not enough data yet to diagnose your typing.</p>
      )}

      {exhausted ? (
        <p className="kerf-coach-quota">You have used today's session. Come back tomorrow.</p>
      ) : (
        <button type="button" className="kerf-btn-primary" onClick={onStart}>
          Start session
        </button>
      )}
    </section>
  );
}
