/**
 * Insight domain types per 02-architecture.md §4.4 and product-spec §5.4.
 *
 * A SessionInsight is computed at session end and feeds the post-session
 * summary UI. It carries structured data (so the UI can render rich
 * components) AND a plain-language summary (template-assembled, for
 * simpler surfaces + email digests).
 */

/** How the session's accuracy+speed trajectory reads against prior session.
 * Drives opener copy per product-spec §6.2 (accuracy-first).
 *
 * - right-trajectory: accuracy up, speed down — the ideal transition move
 * - concern: accuracy down, speed up — the anti-pattern to flag
 * - neutral: both up, OR no prior session to compare against
 * - mixed: both down — suggest a break or shorter session */
export type TrajectoryFrame = "right-trajectory" | "concern" | "neutral" | "mixed";

/** Before/after snapshot of a single weak unit — char or bigram. */
export type UnitDelta = {
  unit: string;
  errorRateBefore: number;
  errorRateAfter: number;
  meanTimeBefore: number;
  meanTimeAfter: number;
};

/** A detected behavioural pattern the UI can call out in the post-session
 * summary. Kept small — Phase A recognizes three patterns. */
export type PatternDetection = {
  kind: "bn-confusion" | "bv-drift" | "thumb-hesitation";
  /** Evidence count for substitution patterns; ignored for thumb-hesitation. */
  count: number;
  /** Human-readable evidence string for the UI to display verbatim. */
  evidence: string;
};

export type SessionInsight = {
  /** Top-3-weakness units from `beforeStats`, with their after-session
   * error rates and mean times attached. Ordered by before-session
   * weakness score, descending. */
  improvements: UnitDelta[];
  /** Unit names (char or bigram) that are top-weakness NOW but were not
   * top-weakness before the session — a regression or new surface. */
  newWeaknesses: string[];
  patterns: PatternDetection[];
  trajectoryFrame: TrajectoryFrame;
  /** Short (single-sentence) forward-looking note about what the next
   * session will emphasize. */
  nextRecommendation: string;
  /** Multi-paragraph plain-language summary assembled from the structured
   * fields above. Accuracy-first tone per product-spec §6.2. */
  plainLanguageSummary: string;
};

/** Weekly trajectory classification — wider-grained than the session
 * version because a week has enough data to surface a plateau
 * (`stagnant`) honestly, per Core Value 2.2 ("if user hasn't improved
 * in 2 weeks, platform says so"). Task 3.4b. */
export type WeeklyTrajectoryFrame =
  | "building" // not enough comparison data yet
  | "stagnant" // ≥2 weeks of meaningful data, neither metric moved
  | "right-trajectory" // accuracy climbed (regardless of speed)
  | "concern" // accuracy dropped while speed rose
  | "mixed" // both cooled
  | "steady"; // within noise but comparison window is too short to call it a plateau

/** Aggregate for a single week window. `accuracyPct` and `wpm` are
 * rounded for direct display and are `null` when the window was empty. */
export type WeeklyAggregate = {
  sessions: number;
  accuracyPct: number | null;
  wpm: number | null;
};

export type WeeklyInsight = {
  /** True when both the current-week and prior-week windows have ≥1
   * session — the narrative uses this to pick between comparison copy
   * and first-week "building" copy. */
  hasComparison: boolean;
  thisWeek: WeeklyAggregate;
  lastWeek: WeeklyAggregate;
  frame: WeeklyTrajectoryFrame;
  /** Single-paragraph plain-language read on the week. */
  narrative: string;
  /** 1-3 short recommendation strings for the UI to render as a list.
   * Template-assembled, phase-aware, accuracy-first. */
  recommendations: readonly string[];
};
