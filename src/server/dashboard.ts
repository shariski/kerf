import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import {
  characterStats,
  keyboardProfiles,
  sessions,
  splitMetricsSnapshots,
} from "./db/schema";
import {
  averageSplitMetrics,
  buildSparklineValues,
  computeMasteredCount,
  computeStreakDays,
  computeTrendDelta,
  type SplitSnapshot,
} from "#/domain/dashboard/aggregates";
import type { KeyboardType } from "./profile";

/**
 * Payload consumed by the dashboard hero-stats section (Task 3.2a).
 *
 * Returned fields are already computed and rounded for display —
 * the component just renders. All numeric fields that require a
 * minimum history to be honest are `number | null`; the UI renders
 * a muted placeholder instead of a fake number when null.
 */
export type DashboardHeroData = {
  /** `null` when there are zero sessions — the route then renders
   * an empty-state CTA instead of the hero grid. */
  hasAnyData: boolean;

  /** Keyboard profile context for the section-header meta line. */
  profile: { keyboardType: KeyboardType };
  /** Total lifetime sessions for this profile. */
  totalSessions: number;

  // --- featured primary stat (accuracy) ---
  /** 0–100, rounded. */
  accuracyPct: number;
  /** Percentage-point delta vs the first `TREND_BASELINE_N` sessions.
   * `null` when there aren't enough sessions to be meaningful. */
  accuracyTrendPct: number | null;
  /** Chronological accuracy percentages, down-sampled for sparkline
   * rendering. Each value is 0–100. */
  accuracySparkline: number[];

  // --- secondary stats ---
  /** Average WPM across all sessions. Rounded. */
  avgWpm: number;
  /** Signed WPM delta vs baseline. `null` when insufficient history. */
  avgWpmTrend: number | null;

  /** Letters the user has "mastered" per thresholds. */
  mastered: { count: number; total: number };
  currentStreakDays: number;
  longestStreakDays: number;

  // --- split-specific metrics (accuracy caveats in the UI) ---
  splitMetrics: {
    innerColumnErrorRatePct: number | null;
    thumbClusterAvgMs: number | null;
    crossHandBigramAvgMs: number | null;
    columnarStabilityPct: number | null;
  };
};

/** Baseline window size for trend deltas. 7 matches the wireframe's
 * "+8 wpm vs first 7 sessions" caption. */
const TREND_BASELINE_N = 7;
const SPARKLINE_MAX_POINTS = 20;
/** "Mastered" thresholds — align with §4.1 weakness definition and
 * the dashboard wireframe's "letters at < 5% error" caption. */
const MASTERED_MIN_ATTEMPTS = 20;
const MASTERED_MAX_ERROR_RATE = 0.05;
/** Recent-window size for split-metrics averaging. Keeps the
 * dashboard responsive to the user's current form rather than
 * forever-memory of their early-learning days. */
const SPLIT_METRICS_RECENT_N = 30;

/**
 * Load everything the hero stats + split-metrics section need for
 * the active profile in a single call. Auth-gated; returns an
 * `hasAnyData: false` payload when the user has no sessions yet so
 * the UI can render an empty state.
 */
export const getDashboardHeroStats = createServerFn({
  method: "GET",
}).handler(async () => {
  const request = getRequest();
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession) {
    throw new Error("getDashboardHeroStats: unauthorized");
  }
  const userId = authSession.user.id;

  // Active profile — matches what /practice loads. A user with no
  // active profile redirects to onboarding upstream; here we just
  // fail loudly.
  const [profile] = await db
    .select({
      id: keyboardProfiles.id,
      keyboardType: keyboardProfiles.keyboardType,
    })
    .from(keyboardProfiles)
    .where(
      and(
        eq(keyboardProfiles.userId, userId),
        eq(keyboardProfiles.isActive, true),
      ),
    )
    .limit(1);
  if (!profile) {
    throw new Error("getDashboardHeroStats: no active profile");
  }

  // Fetch sessions in chronological order — both aggregates
  // (trend, sparkline, streak) depend on chronology.
  const sessionRows = await db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      wpm: sessions.wpm,
      accuracy: sessions.accuracy,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.keyboardProfileId, profile.id),
      ),
    )
    .orderBy(asc(sessions.startedAt));

  if (sessionRows.length === 0) {
    return emptyDashboardData(profile.keyboardType as KeyboardType);
  }

  // Running stats are the live per-user / per-profile UPSERT rows
  // Task 2.8 maintains — they already include every session's
  // contribution, so no re-aggregation here.
  const charStatRows = await db
    .select({
      character: characterStats.character,
      totalAttempts: characterStats.totalAttempts,
      totalErrors: characterStats.totalErrors,
      sumKeystrokeMs: characterStats.sumKeystrokeMs,
      hesitationCount: characterStats.hesitationCount,
    })
    .from(characterStats)
    .where(
      and(
        eq(characterStats.userId, userId),
        eq(characterStats.keyboardProfileId, profile.id),
      ),
    );

  // Recent split-metrics snapshots only — see SPLIT_METRICS_RECENT_N
  // rationale above. We intentionally don't filter by session id;
  // the trailing-N window is simpler and good enough for now.
  const splitRowsAll = await db
    .select({
      innerColAttempts: splitMetricsSnapshots.innerColAttempts,
      innerColErrors: splitMetricsSnapshots.innerColErrors,
      innerColErrorRate: splitMetricsSnapshots.innerColErrorRate,
      thumbClusterCount: splitMetricsSnapshots.thumbClusterCount,
      thumbClusterAvgMs: splitMetricsSnapshots.thumbClusterAvgMs,
      crossHandBigramCount: splitMetricsSnapshots.crossHandBigramCount,
      crossHandBigramAvgMs: splitMetricsSnapshots.crossHandBigramAvgMs,
      columnarStableCount: splitMetricsSnapshots.columnarStableCount,
      columnarDriftCount: splitMetricsSnapshots.columnarDriftCount,
      columnarStabilityPct: splitMetricsSnapshots.columnarStabilityPct,
      createdAt: splitMetricsSnapshots.createdAt,
    })
    .from(splitMetricsSnapshots)
    .where(
      and(
        eq(splitMetricsSnapshots.userId, userId),
        eq(splitMetricsSnapshots.keyboardProfileId, profile.id),
      ),
    )
    .orderBy(asc(splitMetricsSnapshots.createdAt));
  const splitRows: SplitSnapshot[] = splitRowsAll
    .slice(-SPLIT_METRICS_RECENT_N)
    .map((r) => ({
      innerColAttempts: r.innerColAttempts ?? 0,
      innerColErrors: r.innerColErrors ?? 0,
      innerColErrorRate: r.innerColErrorRate,
      thumbClusterCount: r.thumbClusterCount,
      thumbClusterAvgMs: r.thumbClusterAvgMs,
      crossHandBigramCount: r.crossHandBigramCount,
      crossHandBigramAvgMs: r.crossHandBigramAvgMs,
      columnarStableCount: r.columnarStableCount,
      columnarDriftCount: r.columnarDriftCount,
      columnarStabilityPct: r.columnarStabilityPct,
    }));

  // --- derive ---------------------------------------------------------

  const wpmValues = sessionRows
    .map((s) => s.wpm)
    .filter((w): w is number => typeof w === "number" && w > 0);
  const accuracyPcts = sessionRows
    .map((s) => s.accuracy)
    .filter((a): a is number => typeof a === "number")
    .map((a) => a * 100);

  const avgWpm = wpmValues.length > 0 ? Math.round(mean(wpmValues)) : 0;
  const accuracyPct =
    accuracyPcts.length > 0 ? Math.round(mean(accuracyPcts)) : 100;

  const avgWpmTrend = roundOrNull(
    computeTrendDelta(wpmValues, TREND_BASELINE_N),
  );
  const accuracyTrendPct = roundOrNull(
    computeTrendDelta(accuracyPcts, TREND_BASELINE_N),
    1,
  );

  const mastered = computeMasteredCount(
    charStatRows.map((c) => ({
      character: c.character,
      attempts: c.totalAttempts,
      errors: c.totalErrors,
      sumTime: c.sumKeystrokeMs,
      hesitationCount: c.hesitationCount,
    })),
    { minAttempts: MASTERED_MIN_ATTEMPTS, maxErrorRate: MASTERED_MAX_ERROR_RATE },
  );

  const streak = computeStreakDays(
    sessionRows.map((s) => s.startedAt),
    new Date(),
  );

  const splitMetrics = averageSplitMetrics(splitRows);

  return {
    hasAnyData: true,
    profile: { keyboardType: profile.keyboardType as KeyboardType },
    totalSessions: sessionRows.length,
    accuracyPct,
    accuracyTrendPct,
    accuracySparkline: buildSparklineValues(accuracyPcts, SPARKLINE_MAX_POINTS).map(
      (v) => Math.round(v * 10) / 10,
    ),
    avgWpm,
    avgWpmTrend,
    mastered: { count: mastered.mastered, total: mastered.total },
    currentStreakDays: streak.current,
    longestStreakDays: streak.longest,
    splitMetrics,
  } satisfies DashboardHeroData;
});

// --- helpers ---------------------------------------------------------------

function emptyDashboardData(keyboardType: KeyboardType): DashboardHeroData {
  return {
    hasAnyData: false,
    profile: { keyboardType },
    totalSessions: 0,
    accuracyPct: 0,
    accuracyTrendPct: null,
    accuracySparkline: [],
    avgWpm: 0,
    avgWpmTrend: null,
    mastered: { count: 0, total: 26 },
    currentStreakDays: 0,
    longestStreakDays: 0,
    splitMetrics: {
      innerColumnErrorRatePct: null,
      thumbClusterAvgMs: null,
      crossHandBigramAvgMs: null,
      columnarStabilityPct: null,
    },
  };
}

function mean(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

function roundOrNull(value: number | null, decimals = 0): number | null {
  if (value === null) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
