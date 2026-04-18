/**
 * Split-specific metrics per 02-architecture.md §4.5 and product-spec
 * §5.4. Computed at session end from the session's keystroke events;
 * persisted as a `split_metrics_snapshots` row.
 *
 * TS convention is camelCase; the SQL schema in §4.5 uses snake_case.
 * The Drizzle schema handles the mapping at the storage boundary.
 */

export type SplitMetricsSnapshot = {
  // Metric 1: Inner column error rate (B, G, H, N, T, Y).
  // Directly measured; accuracy is high.
  innerColAttempts: number;
  innerColErrors: number;
  innerColErrorRate: number;

  // Metric 2: Thumb cluster decision time.
  // Average ms between the previous keystroke and a thumb-assigned press.
  thumbClusterCount: number;
  thumbClusterSumMs: number;
  thumbClusterAvgMs: number;

  // Metric 3: Cross-hand bigram timing.
  // Bigrams where prevChar and targetChar live on different hands, with
  // thumbs excluded — thumb→finger timing is qualitatively different.
  crossHandBigramCount: number;
  crossHandBigramSumMs: number;
  crossHandBigramAvgMs: number;

  // Metric 4: Columnar stability (INFERRED).
  // For each error, classify as "drift" (same hand, adjacent column, row
  // diff <= 1) vs "stable" (anything else — wrong hand, non-adjacent
  // column, etc). The metric's accuracy is moderate — UI should prefer
  // soft language ("likely drift") over certain claims ("wrong finger").
  columnarStableCount: number;
  columnarDriftCount: number;
  columnarStabilityPct: number;

  totalKeystrokes: number;
  // True when the sample is too small for the metrics to be meaningful.
  // Metrics are still populated; the flag tells the UI to suppress or
  // caveat them per §4.5.
  insufficientData: boolean;
};
