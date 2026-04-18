import { getFingerForKey } from "../finger/resolver";
import type { KeyboardLayout } from "../finger/types";
import type { KeystrokeEvent } from "../stats/types";
import type { SplitMetricsSnapshot } from "./types";

/**
 * Split-specific metrics per 02-architecture.md §4.5 and product-spec §5.4.
 *
 * Computed at session end from keystroke events. Four metrics:
 *
 *   1. Inner column error rate on {b,g,h,n,t,y}
 *   2. Thumb cluster decision time (avg keystrokeMs on thumb-assigned keys)
 *   3. Cross-hand bigram timing (avg keystrokeMs on bigrams spanning hands,
 *      excluding bigrams that touch a thumb-assigned key)
 *   4. Columnar stability — for each error, classify as "drift" (same hand,
 *      adjacent column, row diff ≤ 1) vs "stable" (anything else)
 *
 * Sub-threshold sessions still populate metrics but set `insufficientData`
 * so the UI can suppress or caveat them.
 */

export const INSUFFICIENT_DATA_THRESHOLD = 50;

const INNER_COLUMN = new Set(["b", "g", "h", "n", "t", "y"]);

const EMPTY_METRICS: Omit<SplitMetricsSnapshot, "totalKeystrokes" | "insufficientData"> = {
  innerColAttempts: 0,
  innerColErrors: 0,
  innerColErrorRate: 0,
  thumbClusterCount: 0,
  thumbClusterSumMs: 0,
  thumbClusterAvgMs: 0,
  crossHandBigramCount: 0,
  crossHandBigramSumMs: 0,
  crossHandBigramAvgMs: 0,
  columnarStableCount: 0,
  columnarDriftCount: 0,
  // By convention: no errors → fully stable. Flipped to a real ratio below
  // once we see at least one classified error.
  columnarStabilityPct: 1,
};

export function computeSplitMetrics(
  events: readonly KeystrokeEvent[],
  layout: KeyboardLayout,
): SplitMetricsSnapshot {
  const totalKeystrokes = events.length;
  const insufficientData = totalKeystrokes < INSUFFICIENT_DATA_THRESHOLD;

  const m = { ...EMPTY_METRICS };

  for (const ev of events) {
    const targetLower = ev.targetChar.toLowerCase();
    const targetAssign = getFingerForKey(layout, targetLower);

    // Metric 1 — inner column error rate.
    if (INNER_COLUMN.has(targetLower)) {
      m.innerColAttempts++;
      if (ev.isError) m.innerColErrors++;
    }

    // Metric 2 — thumb cluster decision time.
    if (targetAssign?.finger === "thumb") {
      m.thumbClusterCount++;
      m.thumbClusterSumMs += ev.keystrokeMs;
    }

    // Metric 3 — cross-hand bigram timing. Requires a prevChar, both chars
    // mapped in the finger table, different hands, and neither char on a
    // thumb (thumb→finger timing is qualitatively different — §4.5).
    if (ev.prevChar !== undefined) {
      const prevAssign = getFingerForKey(layout, ev.prevChar.toLowerCase());
      if (
        prevAssign &&
        targetAssign &&
        prevAssign.finger !== "thumb" &&
        targetAssign.finger !== "thumb" &&
        prevAssign.hand !== targetAssign.hand
      ) {
        m.crossHandBigramCount++;
        m.crossHandBigramSumMs += ev.keystrokeMs;
      }
    }

    // Metric 4 — columnar stability. Only defined on errors where both the
    // intended and the typed key are in the finger table.
    if (ev.isError) {
      const typedAssign = getFingerForKey(layout, ev.actualChar.toLowerCase());
      if (targetAssign && typedAssign) {
        const sameHand = targetAssign.hand === typedAssign.hand;
        const colDiff = Math.abs(targetAssign.col - typedAssign.col);
        const rowDiff = Math.abs(targetAssign.row - typedAssign.row);
        if (sameHand && colDiff === 1 && rowDiff <= 1) {
          m.columnarDriftCount++;
        } else {
          m.columnarStableCount++;
        }
      }
    }
  }

  if (m.innerColAttempts > 0) {
    m.innerColErrorRate = m.innerColErrors / m.innerColAttempts;
  }
  if (m.thumbClusterCount > 0) {
    m.thumbClusterAvgMs = m.thumbClusterSumMs / m.thumbClusterCount;
  }
  if (m.crossHandBigramCount > 0) {
    m.crossHandBigramAvgMs = m.crossHandBigramSumMs / m.crossHandBigramCount;
  }
  const totalClassified = m.columnarStableCount + m.columnarDriftCount;
  if (totalClassified > 0) {
    m.columnarStabilityPct = m.columnarStableCount / totalClassified;
  }

  return { ...m, totalKeystrokes, insufficientData };
}
