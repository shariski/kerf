import type { DashboardHeroData } from "#/server/dashboard";

/**
 * Split-keyboard-specific metrics section (Task 3.2, "Split-specific
 * metrics section (NEW)" per task-breakdown §3.2 + product-spec §5.4).
 *
 * Four metrics specific to migrating from a row-staggered QWERTY
 * layout to a columnar split:
 *
 *   1. Inner column error rate (B G H N T Y) — the classic split
 *      pain points.
 *   2. Thumb cluster decision time — time to press a thumb key,
 *      averaged across recent sessions.
 *   3. Cross-hand bigram timing — time for bigrams that jump hands
 *      (hard on split layouts).
 *   4. Columnar stability — inferred from same-hand adjacent-column
 *      drift errors.
 *
 * Product-spec §5.4 calls for "accuracy caveats surfaced" — we spell
 * out what each number means in plain language below the value so
 * users don't mis-read "47%" as "I'm bad at 53% of this".
 */

type Props = { data: DashboardHeroData };

export function SplitMetrics({ data }: Props) {
  const m = data.splitMetrics;
  return (
    <div className="kerf-dash-split-grid">
      <Metric
        label="inner column errors"
        value={m.innerColumnErrorRatePct}
        format={(v) => `${Math.round(v * 10) / 10}%`}
        caption="error rate across B G H N T Y — the split-keyboard inner column"
      />
      <Metric
        label="thumb cluster"
        value={m.thumbClusterAvgMs}
        format={(v) => `${Math.round(v)}ms`}
        caption="avg time to press a thumb key — proxy for thumb fluency"
      />
      <Metric
        label="cross-hand bigrams"
        value={m.crossHandBigramAvgMs}
        format={(v) => `${Math.round(v)}ms`}
        caption="avg time for letter pairs that jump hands (th, he, in…)"
      />
      <Metric
        label="columnar stability"
        value={m.columnarStabilityPct}
        format={(v) => `${Math.round(v)}%`}
        caption="of your errors, the share that are NOT neighbouring-column drift — higher is better"
      />
    </div>
  );
}

function Metric({
  label,
  value,
  format,
  caption,
}: {
  label: string;
  value: number | null;
  format: (v: number) => string;
  caption: string;
}) {
  return (
    <article className="kerf-dash-split-card">
      <div className="kerf-dash-split-label">{label}</div>
      <div className="kerf-dash-split-value">
        {value !== null ? (
          format(value)
        ) : (
          <span className="kerf-dash-split-value--empty">—</span>
        )}
      </div>
      <div className="kerf-dash-split-caption">{caption}</div>
    </article>
  );
}
