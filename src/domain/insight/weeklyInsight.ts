import type { TransitionPhase } from "../profile/initialPhase";
import type { WeeklyAggregate, WeeklyInsight, WeeklyTrajectoryFrame } from "./types";

/**
 * Weekly insight generation (Task 3.4b).
 *
 * Pure, template-assembled, phase-aware. Mirrors the shape of
 * `sessionInsight.ts` but operates on a rolling 14-day session history
 * so it can classify *this-week vs. last-week* trajectory and surface
 * a plateau honestly (`frame === "stagnant"`) per Core Value 2.2:
 * "if user hasn't improved in 2 weeks, platform says so, not 'you're
 * doing great!'".
 *
 * Window choice — we use a rolling 7-day window anchored at `now`,
 * not calendar weeks. A calendar-week view would leave a user who
 * started Thursday staring at "first full week next Monday" for five
 * days; the rolling window shows a comparison as soon as there are
 * two windows of sessions.
 *
 * No LLM (§B7 / product-spec §7). Recommendations come from a phase-
 * and-frame keyed table; copy honors §B3 (no banned hype words — the
 * test file lints every emitted string against the same set used by
 * `sessionInsight.ts`).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * MS_PER_DAY;

/** Accuracy delta (percentage points) below which we treat the week
 * as "essentially unchanged" on the accuracy axis. Matches the
 * session-insight threshold (`sessionInsight.ts` §58) so the two
 * narratives use a consistent noise floor. */
export const WEEKLY_ACCURACY_NOISE_PP = 0.5;

/** WPM delta below which we treat the week as essentially unchanged
 * on the speed axis. Conservative — 1 WPM is well within day-to-day
 * noise on a 5-minute session. */
export const WEEKLY_WPM_NOISE = 1;

/** Sessions required in BOTH windows before we'll call a flat week a
 * plateau. Without this guard, a user with 2 sessions/week of
 * identical numbers would get a misleading "two weeks no
 * improvement" message. */
export const WEEKLY_STAGNATION_MIN_SESSIONS = 3;

/** Banned hype words per §B3 — the test file lints every generated
 * string against this set. Extending the single source from
 * `sessionInsight.ts` would be neater but cross-module wiring isn't
 * worth the churn for a 9-entry literal. */
export const BANNED_WORDS: readonly string[] = [
  "amazing",
  "crushing it",
  "nailed it",
  "incredible",
  "awesome",
  "killing it",
  "rockstar",
  "legend",
];

export type WeeklyInsightInput = {
  /** All sessions for the active profile. The domain slices the two
   * windows itself — the caller doesn't pre-filter. `accuracyPct` is
   * 0-100 (not 0-1), matching the dashboard-facing convention. */
  sessions: readonly { startedAt: Date; accuracyPct: number; wpm: number }[];
  phase: TransitionPhase;
  /** Injected clock for deterministic tests; defaults to `new Date()`. */
  now?: Date;
};

// --- helpers ---------------------------------------------------------------

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((s, x) => s + x, 0) / xs.length;

function bucket(
  sessions: WeeklyInsightInput["sessions"],
  now: Date,
): { thisWeek: typeof sessions; lastWeek: typeof sessions } {
  // Windows partition the time axis cleanly: `thisStart` belongs to
  // LAST-week, not this-week. So a session at exactly `now - 7 days`
  // falls into the last-week bucket — matching the convention that
  // "this week" means "the past 7 days excluding the 7-day boundary".
  // This also ensures (thisStart, now] ∪ (lastStart, thisStart] has no
  // gap and no overlap.
  const nowMs = now.getTime();
  const thisStart = nowMs - WEEK_MS;
  const lastStart = nowMs - 2 * WEEK_MS;
  const thisWeek = sessions.filter((s) => {
    const t = s.startedAt.getTime();
    return t > thisStart && t <= nowMs;
  });
  const lastWeek = sessions.filter((s) => {
    const t = s.startedAt.getTime();
    return t > lastStart && t <= thisStart;
  });
  return { thisWeek, lastWeek };
}

type RawAggregate = {
  sessions: number;
  accuracyPct: number;
  wpm: number;
};

function rawAggregate(sessions: WeeklyInsightInput["sessions"]): RawAggregate {
  return {
    sessions: sessions.length,
    accuracyPct: mean(sessions.map((s) => s.accuracyPct)),
    wpm: mean(sessions.map((s) => s.wpm)),
  };
}

function roundForDisplay(raw: RawAggregate): WeeklyAggregate {
  if (raw.sessions === 0) {
    return { sessions: 0, accuracyPct: null, wpm: null };
  }
  return {
    sessions: raw.sessions,
    accuracyPct: Math.round(raw.accuracyPct),
    wpm: Math.round(raw.wpm),
  };
}

function classifyFrame(thisWeek: RawAggregate, lastWeek: RawAggregate): WeeklyTrajectoryFrame {
  if (thisWeek.sessions === 0 || lastWeek.sessions === 0) return "building";

  // Classification reads the raw means, not the display-rounded
  // values, so a sub-noise delta (say +0.9 WPM) can't tip the frame
  // just because it happens to round up to +1.
  const accDelta = thisWeek.accuracyPct - lastWeek.accuracyPct;
  const wpmDelta = thisWeek.wpm - lastWeek.wpm;
  const accMoved = Math.abs(accDelta) >= WEEKLY_ACCURACY_NOISE_PP;
  const wpmMoved = Math.abs(wpmDelta) >= WEEKLY_WPM_NOISE;

  if (!accMoved && !wpmMoved) {
    // Nothing moved. The honest call — "plateau" — only fires when
    // there's enough evidence in both windows that the flatness isn't
    // just small-sample noise.
    if (
      thisWeek.sessions >= WEEKLY_STAGNATION_MIN_SESSIONS &&
      lastWeek.sessions >= WEEKLY_STAGNATION_MIN_SESSIONS
    ) {
      return "stagnant";
    }
    return "steady";
  }

  // Accuracy-first: when accuracy moved, it drives the frame.
  if (accMoved) {
    return accDelta > 0 ? "right-trajectory" : wpmDelta > 0 ? "concern" : "mixed";
  }

  // Accuracy essentially flat; speed moved.
  return wpmDelta > 0 ? "right-trajectory" : "mixed";
}

// --- copy composition ------------------------------------------------------

function narrativeFor(
  frame: WeeklyTrajectoryFrame,
  phase: TransitionPhase,
  thisWeek: WeeklyAggregate,
  lastWeek: WeeklyAggregate,
): string {
  const accDelta =
    thisWeek.accuracyPct !== null && lastWeek.accuracyPct !== null
      ? thisWeek.accuracyPct - lastWeek.accuracyPct
      : 0;
  const wpmDelta = thisWeek.wpm !== null && lastWeek.wpm !== null ? thisWeek.wpm - lastWeek.wpm : 0;
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

  switch (frame) {
    case "building":
      if (thisWeek.sessions === 0) {
        return "No sessions yet this week. A week-over-week read lands once there's data in both windows.";
      }
      return phase === "transitioning"
        ? `${thisWeek.sessions} session${thisWeek.sessions === 1 ? "" : "s"} logged this week. Muscle memory is forming — next week's comparison will be the first meaningful one.`
        : `${thisWeek.sessions} session${thisWeek.sessions === 1 ? "" : "s"} logged this week. Flow takes reps to lock in — the week-over-week read will mean more once there's prior-week data.`;

    case "stagnant":
      return `Two weeks of similar numbers — accuracy around ${thisWeek.accuracyPct}%, speed around ${thisWeek.wpm} WPM. Plateaus are normal, but worth naming honestly rather than papering over.`;

    case "right-trajectory":
      if (accDelta > 0) {
        return phase === "transitioning"
          ? `Accuracy climbed ${sign(accDelta)} pp this week to ${thisWeek.accuracyPct}%. That is how muscle memory forms — careful reps over fast ones.`
          : `Accuracy climbed ${sign(accDelta)} pp to ${thisWeek.accuracyPct}%, with speed ${wpmDelta === 0 ? "holding" : wpmDelta > 0 ? "up" : "easing"} at ${thisWeek.wpm} WPM. Clean refinement.`;
      }
      // Accuracy flat, speed up.
      return phase === "transitioning"
        ? `Speed edged up to ${thisWeek.wpm} WPM while accuracy held steady at ${thisWeek.accuracyPct}%. Keep accuracy the lead number until it's consistent over more sessions.`
        : `Speed rose ${sign(wpmDelta)} WPM to ${thisWeek.wpm} WPM with accuracy holding at ${thisWeek.accuracyPct}%. Flow is polishing.`;

    case "concern":
      return `Speed ticked up to ${thisWeek.wpm} WPM, but accuracy slipped ${Math.abs(accDelta)} pp to ${thisWeek.accuracyPct}%. Easing pace will pay more than pushing it — accuracy leads.`;

    case "mixed":
      return `Both accuracy (${thisWeek.accuracyPct}%) and speed (${thisWeek.wpm} WPM) cooled this week. Shorter sessions or a rest day often resets things. No one week tells the full story.`;

    case "steady":
      return phase === "transitioning"
        ? `Accuracy (${thisWeek.accuracyPct}%) and speed (${thisWeek.wpm} WPM) held within noise this week. Consistency is the point — not every rep is a breakthrough.`
        : `Steady week — accuracy at ${thisWeek.accuracyPct}%, speed at ${thisWeek.wpm} WPM. Flow is locking in through reps.`;
  }
}

function recommendationsFor(
  frame: WeeklyTrajectoryFrame,
  phase: TransitionPhase,
): readonly string[] {
  switch (frame) {
    case "building":
      return [
        "Show up ≥3 times in the next 7 days so there's a line to draw between two points.",
        phase === "transitioning"
          ? "Keep sessions short while muscle memory is forming — S or M mode, under 5 minutes."
          : "Stay in adaptive mode; the engine needs session history to shape your rotation.",
      ];

    case "stagnant":
      return phase === "transitioning"
        ? [
            "Try drill mode on your top weakness — drills break plateaus that adaptive mix cannot.",
            "Or take 2-3 days off. Plateaus often break after rest.",
          ]
        : [
            "A longer L-mode session at a higher target WPM can stretch flow past a plateau.",
            "Or take 2-3 days off. Plateaus often break after rest.",
          ];

    case "right-trajectory":
      return phase === "transitioning"
        ? [
            "Keep the accuracy-first rhythm. Do not chase speed until accuracy holds over ≥10 sessions.",
            "Longer sessions (M or L mode) help consolidate what is forming.",
          ]
        : [
            "Ease speed targets up next session if accuracy stays above 95%.",
            "Stay in adaptive mode — the engine is tracking the rotation well.",
          ];

    case "concern":
      return [
        "Drop to S or M mode and slow down for a few sessions.",
        "If accuracy sits below 92% next week, consider switching back to transitioning phase until it rebuilds.",
      ];

    case "mixed":
      return [
        "Short, frequent sessions (S mode, daily) rebuild baseline faster than one long push.",
        "Mixed weeks often correlate with tired reps — watch for fatigue.",
      ];

    case "steady":
      return phase === "transitioning"
        ? [
            "Keep the cadence. Muscle memory forms through repetition, not intensity.",
            "If the same errors keep surfacing, try drill mode on the top weakness.",
          ]
        : [
            "Keep the rotation. Flow locks in through reps, not reaches.",
            "If you feel under-challenged, a longer L-mode session can add stretch.",
          ];
  }
}

// --- main ------------------------------------------------------------------

export function generateWeeklyInsight(input: WeeklyInsightInput): WeeklyInsight {
  const now = input.now ?? new Date();
  const { thisWeek, lastWeek } = bucket(input.sessions, now);
  const thisRaw = rawAggregate(thisWeek);
  const lastRaw = rawAggregate(lastWeek);
  const frame = classifyFrame(thisRaw, lastRaw);
  const thisAgg = roundForDisplay(thisRaw);
  const lastAgg = roundForDisplay(lastRaw);
  const narrative = narrativeFor(frame, input.phase, thisAgg, lastAgg);
  const recommendations = recommendationsFor(frame, input.phase);

  return {
    hasComparison: thisAgg.sessions > 0 && lastAgg.sessions > 0,
    thisWeek: thisAgg,
    lastWeek: lastAgg,
    frame,
    narrative,
    recommendations,
  };
}
