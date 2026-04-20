import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { auth } from "./auth";
import { db } from "./db";
import {
  bigramStats,
  characterStats,
  keyboardProfiles,
  sessions,
  splitMetricsSnapshots,
} from "./db/schema";
import {
  averageSplitMetrics,
  bucketActivityByDay,
  buildSparklineValues,
  computeHeatLevels,
  computeMasteredCount,
  computeStreakDays,
  computeTrendDelta,
  computeWeaknessRanking,
  formatDurationLabel,
  formatRelativeDay,
  type ActivityDay,
  type SplitSnapshot,
  type WeaknessRankEntry,
} from "#/domain/dashboard/aggregates";
import {
  computeWeaknessBreakdown,
  type WeaknessBreakdown,
} from "#/domain/dashboard/breakdown";
import { PHASE_BASELINES } from "#/domain/stats/baselines";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import {
  suggestPhaseTransition,
  type PhaseTransitionSignal,
} from "#/domain/adaptive/phaseSuggestion";
import { INSUFFICIENT_DATA_THRESHOLD } from "#/domain/metrics/computeSplitMetrics";
import type { SplitMetricsSnapshot } from "#/domain/metrics/types";
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

// --- activity log (Task 3.2b) ---------------------------------------------

export type RecentSession = {
  id: string;
  relativeTime: string; // "2h ago" / "today" / "yesterday" / "Nd ago" / YYYY-MM-DD
  mode: "adaptive" | "targeted_drill";
  /** Human-readable "52 words" or "drill on B" built from totals + filter config. */
  description: string;
  wpm: number;
  accuracyPct: number;
  durationLabel: string; // M:SS
};

export type DashboardActivityData = {
  /** Oldest → newest, always 30 entries. */
  days: ActivityDay[];
  /** Most recent 5 sessions. Empty when the user has no sessions yet. */
  recentSessions: RecentSession[];
};

const ACTIVITY_WINDOW_DAYS = 30;
const RECENT_SESSIONS_N = 5;
/** Average characters per word used to approximate word count from
 * `sessions.total_chars`. English averages ~4.7 letters + 1 space, so
 * 5 is a reasonable single-number approximation for a session. */
const CHARS_PER_WORD_APPROX = 5;

/**
 * Load 30-day activity buckets + the latest N sessions for the
 * active profile. Called alongside `getDashboardHeroStats` from the
 * dashboard route's loader.
 */
export const getDashboardActivity = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardActivityData> => {
  const request = getRequest();
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession) {
    throw new Error("getDashboardActivity: unauthorized");
  }
  const userId = authSession.user.id;

  const [profile] = await db
    .select({ id: keyboardProfiles.id })
    .from(keyboardProfiles)
    .where(
      and(
        eq(keyboardProfiles.userId, userId),
        eq(keyboardProfiles.isActive, true),
      ),
    )
    .limit(1);
  if (!profile) {
    return { days: bucketActivityByDay([], new Date(), ACTIVITY_WINDOW_DAYS), recentSessions: [] };
  }

  // Cheap: all session rows for this profile. One row per session;
  // a lifetime of practice is still small by DB standards.
  const allSessions = await db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      mode: sessions.mode,
      totalChars: sessions.totalChars,
      wpm: sessions.wpm,
      accuracy: sessions.accuracy,
      filterConfig: sessions.filterConfig,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.keyboardProfileId, profile.id),
      ),
    )
    .orderBy(asc(sessions.startedAt));

  const now = new Date();
  const days = bucketActivityByDay(
    allSessions.map((s) => s.startedAt),
    now,
    ACTIVITY_WINDOW_DAYS,
  );

  // Latest N by startedAt desc. Slice from the all-sessions array we
  // already fetched — one query is cheaper than a second window query.
  const recent = [...allSessions]
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, RECENT_SESSIONS_N);

  const recentSessions: RecentSession[] = recent.map((s) =>
    toRecentSession(s, now),
  );

  return { days, recentSessions };
});

type SessionRow = {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  mode: string;
  totalChars: number | null;
  wpm: number | null;
  accuracy: number | null;
  filterConfig: unknown;
};

function toRecentSession(row: SessionRow, now: Date): RecentSession {
  const durationMs =
    row.endedAt !== null
      ? row.endedAt.getTime() - row.startedAt.getTime()
      : 0;

  const mode = row.mode === "targeted_drill" ? "targeted_drill" : "adaptive";
  const cfg = isRecord(row.filterConfig) ? row.filterConfig : {};

  return {
    id: row.id,
    relativeTime: formatRelativeDay(row.startedAt, now),
    mode,
    description: buildSessionDescription({
      mode,
      totalChars: row.totalChars ?? 0,
      filterConfig: cfg,
    }),
    wpm: Math.round(row.wpm ?? 0),
    accuracyPct: Math.round((row.accuracy ?? 0) * 100),
    durationLabel: formatDurationLabel(durationMs),
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

// --- heatmap (Task 3.2c) --------------------------------------------------

export type DashboardHeatmapData = {
  keyboardType: KeyboardType;
  /** char → heat level 0..4 for KeyboardSVG's heatLevels prop. Only
   * alphabetic keys with at least HEATMAP_MIN_ATTEMPTS are included. */
  heatByChar: Record<string, number>;
  /** Number of alphabetic keys that have enough attempts to read. */
  measuredCount: number;
  /** Top-3 hottest keys (level 3 or 4) by error rate desc — surfaced
   * in the caption so the user doesn't have to scan the whole board. */
  hottest: string[];
};

/** Min per-key attempts before a key gets colored. Below this, the
 * signal is too noisy (one fat-fingered B in the whole session
 * shouldn't paint B red). */
const HEATMAP_MIN_ATTEMPTS = 10;
const HEATMAP_HOTTEST_N = 3;

/**
 * Per-key error-rate heatmap data for the active profile. Reads the
 * same per-user-aggregated `character_stats` rows as the hero stats;
 * the heatmap and "mastered" count are two views of the same data.
 */
export const getDashboardHeatmap = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardHeatmapData> => {
  const request = getRequest();
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession) {
    throw new Error("getDashboardHeatmap: unauthorized");
  }
  const userId = authSession.user.id;

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
    return {
      keyboardType: "sofle",
      heatByChar: {},
      measuredCount: 0,
      hottest: [],
    };
  }

  const rows = await db
    .select({
      character: characterStats.character,
      totalAttempts: characterStats.totalAttempts,
      totalErrors: characterStats.totalErrors,
    })
    .from(characterStats)
    .where(
      and(
        eq(characterStats.userId, userId),
        eq(characterStats.keyboardProfileId, profile.id),
      ),
    );

  const entries = computeHeatLevels(
    rows.map((r) => ({
      character: r.character,
      attempts: r.totalAttempts,
      errors: r.totalErrors,
    })),
    { minAttempts: HEATMAP_MIN_ATTEMPTS },
  );

  const heatByChar: Record<string, number> = {};
  let measuredCount = 0;
  for (const e of entries) {
    if (e.attempts >= HEATMAP_MIN_ATTEMPTS) measuredCount++;
    if (e.level > 0) heatByChar[e.character] = e.level;
  }

  // Top-N hottest: anything at level 3 or 4, ordered by error rate.
  const hottest = entries
    .filter((e) => e.level >= 3)
    .sort((a, b) => b.errorRate - a.errorRate)
    .slice(0, HEATMAP_HOTTEST_N)
    .map((e) => e.character);

  return {
    keyboardType: profile.keyboardType as KeyboardType,
    heatByChar,
    measuredCount,
    hottest,
  };
});

function buildSessionDescription(input: {
  mode: "adaptive" | "targeted_drill";
  totalChars: number;
  filterConfig: Record<string, unknown>;
}): string {
  const words = Math.max(1, Math.round(input.totalChars / CHARS_PER_WORD_APPROX));

  if (input.mode === "targeted_drill") {
    const target = input.filterConfig.drillTarget;
    const preset = input.filterConfig.drillPreset;
    if (typeof target === "string" && target.length > 0) {
      return `drill on ${target.toUpperCase()} · ${words} words`;
    }
    if (preset === "innerColumn") return `inner-column drill · ${words} words`;
    if (preset === "thumbCluster") return `thumb-cluster drill · ${words} words`;
    if (preset === "crossHandBigram") return `cross-hand drill · ${words} words`;
    return `drill · ${words} words`;
  }

  // Adaptive. Add hand-isolation context when it's anything other
  // than "either" so filters show up in the session log.
  const hand = input.filterConfig.handIsolation;
  const handSuffix =
    hand === "left" ? " · left hand only"
      : hand === "right" ? " · right hand only"
        : "";
  return `${words} words${handSuffix}`;
}

// --- skill trajectory (Task 3.2e) -----------------------------------------

export type TrajectoryPoint = {
  /** 0-based index within the returned window. */
  index: number;
  /** ISO date — used for tick labels / tooltips later. */
  startedAt: string;
  /** Session WPM, rounded. 0 when below the min-elapsed noise floor. */
  wpm: number;
  /** Session accuracy as 0–100 int. */
  accuracyPct: number;
};

export type DashboardTrajectoryData = {
  /** Ordered oldest → newest, at most TRAJECTORY_WINDOW_N entries. */
  points: TrajectoryPoint[];
  /** Most recent session's wpm / accuracy, or null when empty. */
  current: { wpm: number | null; accuracyPct: number | null };
  /** Delta vs first TREND_BASELINE_N sessions (integer; null when
   * insufficient history). */
  wpmDelta: number | null;
  accuracyDelta: number | null;
};

/** Number of most-recent sessions the trajectory charts cover. 30
 * matches the wireframe caption "last 30 sessions" and is long enough
 * to smooth out single-session noise without making the chart a blur. */
const TRAJECTORY_WINDOW_N = 30;

/**
 * Load the last-30-sessions time series of WPM + accuracy plus trend
 * deltas against the first few sessions in the window. Server-side
 * computation means the client renders immediately with already-
 * rounded numbers — no chart-library math on untrusted inputs.
 */
export const getDashboardTrajectory = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardTrajectoryData> => {
  const request = getRequest();
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession) {
    throw new Error("getDashboardTrajectory: unauthorized");
  }
  const userId = authSession.user.id;

  const [profile] = await db
    .select({ id: keyboardProfiles.id })
    .from(keyboardProfiles)
    .where(
      and(
        eq(keyboardProfiles.userId, userId),
        eq(keyboardProfiles.isActive, true),
      ),
    )
    .limit(1);
  if (!profile) {
    return {
      points: [],
      current: { wpm: null, accuracyPct: null },
      wpmDelta: null,
      accuracyDelta: null,
    };
  }

  // Pull all sessions ordered chronologically, then tail the window.
  // Small user-scoped table so the full scan is cheap — no reason to
  // push the window into SQL with LIMIT + reverse-sort.
  const rows = await db
    .select({
      startedAt: sessions.startedAt,
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

  if (rows.length === 0) {
    return {
      points: [],
      current: { wpm: null, accuracyPct: null },
      wpmDelta: null,
      accuracyDelta: null,
    };
  }

  const window = rows.slice(-TRAJECTORY_WINDOW_N);
  const points: TrajectoryPoint[] = window.map((r, i) => ({
    index: i,
    startedAt: r.startedAt.toISOString(),
    wpm: Math.round(r.wpm ?? 0),
    accuracyPct: Math.round((r.accuracy ?? 0) * 100),
  }));

  const last = points[points.length - 1]!;
  const wpmSeries = points.map((p) => p.wpm).filter((w) => w > 0);
  const accSeries = points.map((p) => p.accuracyPct);

  return {
    points,
    current: { wpm: last.wpm, accuracyPct: last.accuracyPct },
    wpmDelta: roundOrNull(
      computeTrendDelta(wpmSeries, TREND_BASELINE_N_TRAJECTORY),
    ),
    accuracyDelta: roundOrNull(
      computeTrendDelta(accSeries, TREND_BASELINE_N_TRAJECTORY),
      1,
    ),
  };
});

/** Trajectory trend baseline is smaller than the hero-stats one (7)
 * because the trajectory window itself is only 30; comparing the
 * last N against the first 3 of that window shows "how much has
 * momentum changed recently" rather than "how far from zero have
 * I come lifetime". */
const TREND_BASELINE_N_TRAJECTORY = 3;

// --- weakness ranking (Task 3.2d) -----------------------------------------

export type DashboardWeaknessRankingData = {
  /** Top N entries, descending by score. Shape matches
   * WeaknessRankEntry from the aggregates module. */
  entries: WeaknessRankEntry[];
  /** Active phase the score was computed under — the UI can surface
   * this so users understand why certain units rank where they do
   * (inner-column bonus only fires in `transitioning`). */
  phase: TransitionPhase;
  /** Full component breakdown for `entries[0]` — fuels the
   * transparency panel (Task 3.3). `null` when the user has no
   * high-confidence weaknesses yet. */
  topBreakdown: WeaknessBreakdown | null;
};

/** Top-N target for the ranking list. 10 matches the task-breakdown's
 * "top 7–10"; actual length can be shorter when the user has fewer
 * high-confidence units than the cap. */
const WEAKNESS_RANKING_TOP_N = 10;

/**
 * Rank the user's weakest typing units for dashboard Section 4.
 *
 * Reads per-user/profile `character_stats` + `bigram_stats` (both
 * maintained as UPSERTs by Task 2.8's `persistSession`). Uses the
 * active profile's phase to pick coefficients from PHASE_BASELINES
 * so the dashboard ranking agrees with what the adaptive engine
 * picks as exercise targets.
 */
export const getDashboardWeaknessRanking = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardWeaknessRankingData> => {
  const request = getRequest();
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession) {
    throw new Error("getDashboardWeaknessRanking: unauthorized");
  }
  const userId = authSession.user.id;

  const [profile] = await db
    .select({
      id: keyboardProfiles.id,
      transitionPhase: keyboardProfiles.transitionPhase,
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
    return { entries: [], phase: "transitioning", topBreakdown: null };
  }

  const phase = profile.transitionPhase as TransitionPhase;
  const baseline = PHASE_BASELINES[phase];

  const charRows = await db
    .select({
      character: characterStats.character,
      attempts: characterStats.totalAttempts,
      errors: characterStats.totalErrors,
      sumTime: characterStats.sumKeystrokeMs,
      hesitationCount: characterStats.hesitationCount,
    })
    .from(characterStats)
    .where(
      and(
        eq(characterStats.userId, userId),
        eq(characterStats.keyboardProfileId, profile.id),
      ),
    );

  const bigramRows = await db
    .select({
      bigram: bigramStats.bigram,
      attempts: bigramStats.totalAttempts,
      errors: bigramStats.totalErrors,
      sumTime: bigramStats.sumKeystrokeMs,
    })
    .from(bigramStats)
    .where(
      and(
        eq(bigramStats.userId, userId),
        eq(bigramStats.keyboardProfileId, profile.id),
      ),
    );

  const entries = computeWeaknessRanking({
    chars: charRows,
    bigrams: bigramRows,
    baseline,
    phase,
    topN: WEAKNESS_RANKING_TOP_N,
  });

  // Look up the raw stat behind entries[0] so the transparency panel
  // (Task 3.3) can render a live component breakdown. Matching by unit
  // is safe — computeWeaknessRanking preserves the lowercase unit
  // string verbatim, and we applied the same `/^[a-z]{2}$/` bigram
  // filter there so only well-formed units make it into `entries`.
  const top = entries[0] ?? null;
  let topBreakdown: WeaknessBreakdown | null = null;
  if (top) {
    if (top.isCharacter) {
      const raw = charRows.find(
        (r) => r.character.toLowerCase() === top.unit,
      );
      if (raw) {
        topBreakdown = computeWeaknessBreakdown(raw, baseline, phase, 0);
      }
    } else {
      const raw = bigramRows.find(
        (r) => r.bigram.toLowerCase() === top.unit,
      );
      if (raw) {
        topBreakdown = computeWeaknessBreakdown(raw, baseline, phase, 0);
      }
    }
  }

  return { entries, phase, topBreakdown };
});

// --- phase-transition suggestion (Task 3.4a) ------------------------------

export type DashboardPhaseSuggestionData = {
  /** Current phase on the active profile — the banner component needs
   * this to disambiguate a null signal (no suggestion *yet*) from
   * "already matches what the engine would suggest". */
  currentPhase: TransitionPhase;
  /** Non-null when thresholds in `phaseSuggestion.ts` fire. The UI is
   * responsible for honoring "max once per session" via sessionStorage
   * — that's a surface-level concern the domain stays out of. */
  signal: PhaseTransitionSignal | null;
};

/** Sized to the largest window the advisory needs: graduation checks
 * the last 10 sessions; break-return checks the last 3. One query
 * serves both. */
const PHASE_SUGGESTION_WINDOW_N = 10;

/**
 * Server-side wrapper around the `suggestPhaseTransition` domain
 * advisory. Inner-joins sessions with their `split_metrics_snapshots`
 * row so the two arrays we feed to the domain stay 1:1 — the domain
 * fails closed on length mismatch (`phaseSuggestion.ts:111`), and a
 * session without a snapshot can't contribute an inner-column signal
 * anyway.
 *
 * Materializes only the snapshot fields the advisory reads
 * (`innerColErrorRate`, `insufficientData`) — the latter is
 * reconstructed from `sessions.totalChars < INSUFFICIENT_DATA_THRESHOLD`
 * rather than persisted, matching how `computeSplitMetrics` derives it.
 */
export const getDashboardPhaseSuggestion = createServerFn({
  method: "GET",
}).handler(async (): Promise<DashboardPhaseSuggestionData> => {
  const request = getRequest();
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession) {
    throw new Error("getDashboardPhaseSuggestion: unauthorized");
  }
  const userId = authSession.user.id;

  const [profile] = await db
    .select({
      id: keyboardProfiles.id,
      transitionPhase: keyboardProfiles.transitionPhase,
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
    return { currentPhase: "transitioning", signal: null };
  }

  const currentPhase = profile.transitionPhase as TransitionPhase;

  // Fetch the last N sessions with matching snapshots, newest first,
  // then reverse so the domain receives chronological order (`.slice(-N)`
  // is what the advisory does internally).
  const rowsDesc = await db
    .select({
      startedAt: sessions.startedAt,
      accuracy: sessions.accuracy,
      totalChars: sessions.totalChars,
      innerColErrorRate: splitMetricsSnapshots.innerColErrorRate,
    })
    .from(sessions)
    .innerJoin(
      splitMetricsSnapshots,
      eq(splitMetricsSnapshots.sessionId, sessions.id),
    )
    .where(
      and(
        eq(sessions.userId, userId),
        eq(sessions.keyboardProfileId, profile.id),
      ),
    )
    .orderBy(desc(sessions.startedAt))
    .limit(PHASE_SUGGESTION_WINDOW_N);

  const rows = rowsDesc.slice().reverse();

  const recentSessions = rows.map((r) => ({
    accuracy: r.accuracy ?? 0,
  }));
  const recentSnapshots: SplitMetricsSnapshot[] = rows.map((r) => ({
    innerColAttempts: 0,
    innerColErrors: 0,
    innerColErrorRate: r.innerColErrorRate ?? 0,
    thumbClusterCount: 0,
    thumbClusterSumMs: 0,
    thumbClusterAvgMs: 0,
    crossHandBigramCount: 0,
    crossHandBigramSumMs: 0,
    crossHandBigramAvgMs: 0,
    columnarStableCount: 0,
    columnarDriftCount: 0,
    columnarStabilityPct: 0,
    totalKeystrokes: r.totalChars ?? 0,
    insufficientData: (r.totalChars ?? 0) < INSUFFICIENT_DATA_THRESHOLD,
  }));

  const lastSessionAt = rows.length > 0 ? rows[rows.length - 1]!.startedAt : undefined;

  const signal = suggestPhaseTransition({
    currentPhase,
    lastSessionAt,
    recentSessions,
    recentSnapshots,
  });

  return { currentPhase, signal };
});
