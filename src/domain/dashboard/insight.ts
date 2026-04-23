import type { TransitionPhase } from "#/domain/stats/types";
import type { WeaknessRankEntry } from "./aggregates";

/**
 * Compose the dashboard's Engine Insight copy — the plain-language
 * narrative + "next exercise will emphasize" rationale that sits
 * under the charts.
 *
 * Pure function, no LLM (see product-spec §7 / CLAUDE.md §B7). All
 * strings honor accuracy-first rules from §6.2 and the no-hype
 * word list from §B3 (amazing / nailed it / crushing it / ...).
 *
 * The caller passes in what the dashboard already has loaded —
 * hero trajectory deltas, top weaknesses from the ranking, and the
 * profile's active phase. No new server call; this is all composition
 * over the existing loader payload.
 */

export type InsightInput = {
  totalSessions: number;
  /** Percentage-point accuracy delta vs baseline (hero stats
   * trajectory). null when insufficient history. */
  accuracyTrendPct: number | null;
  /** Signed WPM delta vs baseline. null when insufficient history. */
  wpmTrend: number | null;
  /** Current phase — chooses between "muscle memory" (transitioning)
   * and "polishing flow" (refining) language per §B3. */
  phase: TransitionPhase;
  /** Top weakness units, highest-score first. Shared type with the
   * ranking section — compose reuses the same evidence the engine
   * ranks by. */
  topWeaknesses: readonly WeaknessRankEntry[];
};

export type DashboardInsight = {
  /** 1–3 sentences summarising where the user is. Accuracy-first,
   * quiet-mentor tone. */
  narrative: string;
  /** The "Next exercise will emphasize ..." sentence listing the
   * top weaknesses as a comma-joined inline list with scores. */
  rationale: string;
  /** Structured top-3 units the engine will target next, exposed
   * separately so the UI can render them as inline chips/strongs. */
  nextFocus: readonly WeaknessRankEntry[];
};

/** Minimum absolute delta (pct points) before we claim a direction. */
const TREND_SIGNIFICANCE_PTS = 0.5;
const TREND_SIGNIFICANCE_WPM = 2;

export function composeDashboardInsight(input: InsightInput): DashboardInsight {
  const { totalSessions, accuracyTrendPct, wpmTrend, phase, topWeaknesses } = input;

  const narrative = narrativeFor({
    totalSessions,
    accuracyTrendPct,
    wpmTrend,
    phase,
    hasWeaknesses: topWeaknesses.length > 0,
  });

  const nextFocus = topWeaknesses.slice(0, 3);
  const rationale =
    nextFocus.length === 0
      ? phase === "transitioning"
        ? "Not enough per-letter signal yet. Keep practicing — the engine builds your rotation from the letters that earn the most attempts."
        : "No standout weaknesses on your profile. The engine will keep rotations balanced until one surfaces."
      : `Next exercise will emphasize ${formatFocusList(nextFocus)}. That's where the engine sees your biggest friction right now.`;

  return {
    narrative,
    rationale,
    nextFocus,
  };
}

// --- narrative composition -----------------------------------------------

function narrativeFor(args: {
  totalSessions: number;
  accuracyTrendPct: number | null;
  wpmTrend: number | null;
  phase: TransitionPhase;
  hasWeaknesses: boolean;
}): string {
  const { totalSessions, accuracyTrendPct, wpmTrend, phase } = args;

  const preamble =
    totalSessions === 1
      ? "One session in — early data, but the engine is already watching."
      : `Across ${totalSessions} sessions on this profile:`;

  const body = trajectoryBodyFor({
    accuracyTrendPct,
    wpmTrend,
    phase,
  });

  return `${preamble} ${body}`;
}

function trajectoryBodyFor(args: {
  accuracyTrendPct: number | null;
  wpmTrend: number | null;
  phase: TransitionPhase;
}): string {
  const { accuracyTrendPct, wpmTrend, phase } = args;
  const accDir = directionOf(accuracyTrendPct, TREND_SIGNIFICANCE_PTS);
  const wpmDir = directionOf(wpmTrend, TREND_SIGNIFICANCE_WPM);

  // Accuracy-first order of precedence: if accuracy is moving, that's
  // the headline. Only comment on speed when accuracy is flat or
  // when speed is moving in the "right" (paired with accuracy-up)
  // direction.
  if (accDir === "up" && wpmDir !== "up") {
    return phase === "transitioning"
      ? "accuracy is climbing — that's muscle memory locking in. Keep the pace careful."
      : "accuracy is climbing while speed eases off — that's the polish flow the refining phase is about.";
  }

  if (accDir === "up" && wpmDir === "up") {
    return "both accuracy and speed are up. Nice trajectory — stay on accuracy first if the two diverge later.";
  }

  if (accDir === "down" && wpmDir === "up") {
    // The concern case per §6.2: speed up at the cost of accuracy.
    return "your speed ticked up, but accuracy slipped. Slowing down will pay off — accuracy is the ground truth the engine rewards.";
  }

  if (accDir === "down") {
    return phase === "transitioning"
      ? "accuracy dipped. A short, careful rep or two should re-seat the muscle memory before you push speed."
      : "accuracy dipped. Ease back on pace; the refining phase trusts flow only when accuracy's underneath it.";
  }

  // Accuracy flat or null.
  if (wpmDir === "up") {
    return phase === "transitioning"
      ? "accuracy is holding steady and speed is creeping up — keep the accuracy discipline and the speed will follow honestly."
      : "steady accuracy with speed lifting — flow's coming along.";
  }

  if (wpmDir === "down") {
    return phase === "transitioning"
      ? "accuracy is holding; speed eased off. That often means muscle memory is still knitting — good."
      : "accuracy is holding; speed eased off. Refining tolerates slower days when the ground stays solid.";
  }

  // Both flat / both null.
  return phase === "transitioning"
    ? "trajectory is steady. Muscle memory is built one careful session at a time — keep showing up."
    : "trajectory is steady. The refining phase rewards reps that don't chase, and this is that shape.";
}

function directionOf(delta: number | null, threshold: number): "up" | "down" | "flat" | "unknown" {
  if (delta === null) return "unknown";
  if (delta >= threshold) return "up";
  if (delta <= -threshold) return "down";
  return "flat";
}

// --- rationale formatting ------------------------------------------------

function formatFocusList(units: readonly WeaknessRankEntry[]): string {
  const parts = units.map((u) => `${u.unit} (score ${u.score.toFixed(1)})`);
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}
