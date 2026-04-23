import type { CharacterStat, UserBaseline } from "../stats/types";

/**
 * Motion-pattern candidates for Target Selection (ADR-003 §4.2).
 *
 * Each candidate aggregates error data across a group of keys that share a
 * motion pattern (vertical column, inner column, thumb cluster). Score is
 * aggregate error rate normalized against the user's baseline error rate
 * (so a user-relative magnitude, not an absolute one).
 *
 * Scale note: these scores are NOT directly comparable with computeWeaknessScore
 * output — that function additionally applies ALPHA/BETA/GAMMA/DELTA phase
 * coefficients and a journey bonus. Motion-pattern scores here are ~1/ALPHA
 * times larger than character scores in transitioning phase (unweighted). Target
 * Selection (Task 8) handles the cross-candidate rebalancing via
 * TARGET_JOURNEY_WEIGHTS, which are hand-tuned per ADR-003 §6 Option C — those
 * weights will be revisited with beta feedback.
 */

export type VerticalColumnId =
  | "left-pinky"
  | "left-ring"
  | "left-middle"
  | "left-index-outer"
  | "left-index-inner"
  | "right-index-inner"
  | "right-index-outer"
  | "right-middle"
  | "right-ring"
  | "right-pinky";

type MotionCandidate = {
  type: "vertical-column" | "inner-column" | "thumb-cluster";
  value: string;
  keys: string[];
  label: string;
  score: number;
};

/** 5 columns × 2 hands. Each entry lists [top, home, bottom] keys for the
 * Sofle/Lily58 base layer (both keyboards share these on the main alpha area). */
const VERTICAL_COLUMNS: Record<VerticalColumnId, [string, string, string]> = {
  "left-pinky": ["q", "a", "z"],
  "left-ring": ["w", "s", "x"],
  "left-middle": ["e", "d", "c"],
  "left-index-outer": ["r", "f", "v"],
  "left-index-inner": ["t", "g", "b"],
  "right-index-inner": ["y", "h", "n"],
  "right-index-outer": ["u", "j", "m"],
  "right-middle": ["i", "k", ","],
  "right-ring": ["o", "l", "."],
  "right-pinky": ["p", ";", "/"],
};

const VERTICAL_LABELS: Record<VerticalColumnId, string> = {
  "left-pinky": "Left pinky column vertical reach",
  "left-ring": "Left ring column vertical reach",
  "left-middle": "Left middle column vertical reach",
  "left-index-outer": "Left index (outer) column vertical reach",
  "left-index-inner": "Left index (inner) column vertical reach",
  "right-index-inner": "Right index (inner) column vertical reach",
  "right-index-outer": "Right index (outer) column vertical reach",
  "right-middle": "Right middle column vertical reach",
  "right-ring": "Right ring column vertical reach",
  "right-pinky": "Right pinky column vertical reach",
};

function aggregateErrorRate(
  stats: CharacterStat[],
  keys: string[],
): { errors: number; attempts: number; rate: number } {
  const pool = stats.filter((s) => keys.includes(s.character.toLowerCase()));
  const errors = pool.reduce((n, s) => n + s.errors, 0);
  const attempts = pool.reduce((n, s) => n + s.attempts, 0);
  return { errors, attempts, rate: attempts > 0 ? errors / attempts : 0 };
}

const safeRatio = (n: number, d: number): number => (d > 0 ? n / d : 0);

export function verticalColumnCandidates(
  stats: CharacterStat[],
  baseline: UserBaseline,
): MotionCandidate[] {
  if (stats.length === 0) return [];
  return (Object.keys(VERTICAL_COLUMNS) as VerticalColumnId[]).map((id) => {
    const keys = VERTICAL_COLUMNS[id];
    const agg = aggregateErrorRate(stats, [...keys]);
    return {
      type: "vertical-column" as const,
      value: id,
      keys: [...keys],
      label: VERTICAL_LABELS[id],
      score: safeRatio(agg.rate, baseline.meanErrorRate),
    };
  });
}

const INNER_LEFT: readonly string[] = ["b", "g", "t"];
const INNER_RIGHT: readonly string[] = ["h", "n", "y"];

export function innerColumnCandidates(
  stats: CharacterStat[],
  baseline: UserBaseline,
): MotionCandidate[] {
  const left = aggregateErrorRate(stats, [...INNER_LEFT]);
  const right = aggregateErrorRate(stats, [...INNER_RIGHT]);
  return [
    {
      type: "inner-column" as const,
      value: "inner-left",
      keys: [...INNER_LEFT],
      label: "Inner-column reach — B, G, T (left hand)",
      score: safeRatio(left.rate, baseline.meanErrorRate),
    },
    {
      type: "inner-column" as const,
      value: "inner-right",
      keys: [...INNER_RIGHT],
      label: "Inner-column reach — H, N, Y (right hand)",
      score: safeRatio(right.rate, baseline.meanErrorRate),
    },
  ];
}

/** Phase A MVP: just the space bar. Enter/backspace deferred (ADR-003 §3). */
const THUMB_THRESHOLD = 0; // any error data qualifies for Phase A

export function thumbClusterCandidate(
  stats: CharacterStat[],
  baseline: UserBaseline,
): MotionCandidate | null {
  const space = stats.find((s) => s.character === " ");
  if (!space || space.attempts < 5) return null;
  const rate = space.errors / space.attempts;
  if (rate <= THUMB_THRESHOLD && space.errors === 0) return null;
  return {
    type: "thumb-cluster" as const,
    value: "space",
    keys: [" "],
    label: "Thumb cluster — space activation",
    score: safeRatio(rate, baseline.meanErrorRate),
  };
}
