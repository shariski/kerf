import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import {
  getActiveProfile,
  getCompletedSessionCountOnActiveProfile,
  getEngineStatsAndBaseline,
  getRecentSessionTargetsOnActiveProfile,
  type EngineStatsAndBaseline,
  type KeyboardType,
  type DominantHand,
} from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import {
  PreSessionStage,
  ActiveSessionStage,
  PauseOverlay,
  PostSessionStage,
  SessionBriefing,
  TargetRibbon,
  type PauseSettings,
  type PreSessionFilterValues,
} from "#/components/practice";
import { useSessionStore, sessionStore } from "#/stores/sessionStore";
import { useIdleAutoPause } from "#/hooks/useIdleAutoPause";
import { useCorpus } from "#/hooks/useCorpus";
import { summarizeSession } from "#/domain/session/summarize";
import { pickSummaryTitle } from "#/domain/session/pickSummaryTitle";
import { getFirstSessionTarget } from "#/domain/session/firstSessionExercise";
import { flushSessionQueue, persistSessionWithRetry } from "#/lib/persistSessionWithRetry";
import { useBeforeUnloadWarning } from "#/hooks/useBeforeUnloadWarning";
import { useOtherTabActive } from "#/hooks/useOtherTabActive";
import { AppFooter } from "#/components/nav/AppFooter";
import { generateSession } from "#/domain/adaptive/sessionGenerator";
import type { SessionOutput } from "#/domain/adaptive/sessionGenerator";
import { rankTargets, selectTarget } from "#/domain/adaptive/targetSelection";
import type { SessionTarget } from "#/domain/adaptive/targetSelection";
import { DRILL_LIBRARY } from "#/domain/adaptive/drillLibraryData";

/**
 * Drizzle types the profile columns as `string` (the schema uses `text()`
 * rather than a pg enum). The valid-value set is locked at write time via
 * `validateCreateProfileInput`, so narrowing at the route boundary is
 * safe — any value we find in the row was once validated at insertion.
 */
type LoadedProfile = {
  id: string;
  keyboardType: KeyboardType;
  dominantHand: DominantHand;
  transitionPhase: TransitionPhase;
};

/**
 * `/practice?autostart=1` skips the pre-session stage and drops the
 * user straight into active typing. Home's hero CTAs use this so the
 * commit-to-practice step only happens once. The param is cleared
 * with `replace: true` immediately after firing so a refresh (or
 * back/forward) won't re-auto-start a session the user has since
 * ended or completed.
 */
type PracticeSearch = { autostart?: boolean };

function validatePracticeSearch(search: Record<string, unknown>): PracticeSearch {
  const a = search.autostart;
  const autostart = a === true || a === 1 || a === "1" || a === "true";
  return autostart ? { autostart: true } : {};
}

export const Route = createFileRoute("/practice")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<{
    profile: LoadedProfile;
    isFirstSession: boolean;
    completedSessionCount: number;
    recentTargets: string[];
    engineData: EngineStatsAndBaseline | null;
  }> => {
    const [profile, completedSessionCount, recentTargets, engineData] = await Promise.all([
      getActiveProfile(),
      getCompletedSessionCountOnActiveProfile(),
      // 2 entries are enough for the cooldown rule (no 3-in-a-row).
      // Path 2 doesn't use a longer recency window — the Bayesian
      // model handles "recently practiced" via posterior updates,
      // not via a separate decay mechanism.
      getRecentSessionTargetsOnActiveProfile({ data: { limit: 2 } }),
      getEngineStatsAndBaseline(),
    ]);
    if (!profile) throw redirect({ to: "/onboarding" });
    return {
      profile: {
        id: profile.id,
        keyboardType: profile.keyboardType as KeyboardType,
        dominantHand: profile.dominantHand as DominantHand,
        transitionPhase: profile.transitionPhase as TransitionPhase,
      },
      isFirstSession: completedSessionCount === 0,
      completedSessionCount,
      recentTargets,
      engineData,
    };
  },
  validateSearch: validatePracticeSearch,
  component: PracticePage,
});

const DEFAULT_FILTERS: PreSessionFilterValues = {
  handIsolation: "either",
  maxWordLength: 6,
  showKeyboard: true,
};

const DEFAULT_PAUSE_SETTINGS: PauseSettings = {
  typingSize: "M",
  showKeyboard: true,
  expectedLetterHint: true,
};

function PracticePage() {
  const { profile, isFirstSession, completedSessionCount, recentTargets, engineData } =
    Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const status = useSessionStore((s) => s.status);
  const currentTarget = useSessionStore((s) => s.target);
  const corpus = useCorpus();

  const [filters, setFilters] = useState<PreSessionFilterValues>(DEFAULT_FILTERS);
  const [paused, setPaused] = useState(false);
  const [pauseSettings, setPauseSettings] = useState<PauseSettings>(DEFAULT_PAUSE_SETTINGS);

  // Mode used by the session currently running (or just finished). The
  // persist effect reads this so the DB row carries the right mode. A
  // ref — not state — so we don't re-trigger renders when it flips.
  const sessionModeRef = useRef<"adaptive" | "diagnostic">(
    isFirstSession ? "diagnostic" : "adaptive",
  );
  // Flips to true once we've actually started (or finished) the first
  // diagnostic. The "Practice again" CTA after a diagnostic should run
  // adaptive, not another diagnostic.
  const diagnosticConsumedRef = useRef(false);

  // ADR-003 §4 — briefing state machine (Gap 2).
  // generateSession result is held here until the user confirms start.
  const [pendingSession, setPendingSession] = useState<SessionOutput | null>(null);

  // The SessionTarget for the active (or just-completed) session.
  // Stored as a ref so it survives active → complete without triggering
  // extra renders. Pattern mirrors sessionModeRef / diagnosticConsumedRef.
  const currentSessionTargetRef = useRef<SessionTarget | null>(null);

  // Wall-clock timestamp when the briefing was shown — included in the
  // persistSession payload as `sessionTarget.declaredAt`.
  const briefingShownAtRef = useRef<Date | null>(null);

  // Keep pre-session "Visual keyboard" toggle and pause-overlay toggle in sync:
  // flipping either updates the same source of truth the active stage reads.
  useEffect(() => {
    setPauseSettings((s) => ({ ...s, showKeyboard: filters.showKeyboard }));
  }, [filters.showKeyboard]);

  const useDiagnostic = isFirstSession && !diagnosticConsumedRef.current;

  const generateSessionAndShowBriefing = () => {
    // First-session gate — serve the curated diagnostic target in place
    // of adaptive sampling, so the first DB row is a comparable baseline
    // (Task 4.1). Adaptive sampling on an empty weakness profile is just
    // uniform-random, which defeats the "baseline" idea.
    if (useDiagnostic) {
      const target = getFirstSessionTarget();
      if (!target) return;
      sessionModeRef.current = "diagnostic";
      diagnosticConsumedRef.current = true;
      sessionStore
        .getState()
        .dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
      return;
    }

    if (corpus.status !== "ready") return;

    const stats = engineData?.stats ?? { characters: [], bigrams: [] };
    const baseline = engineData?.baseline ?? {
      meanErrorRate: 0,
      meanKeystrokeTime: 300,
      meanHesitationRate: 0,
      journey: "conventional" as const,
    };
    const phase = engineData?.phase ?? profile.transitionPhase;

    // TODO: real frequency lookup — for Phase A, uniform stub is sufficient
    // because weakness delta weights attempts more than language frequency.
    const output = generateSession({
      stats,
      baseline,
      phase,
      corpus: corpus.corpus,
      corpusBigramSupport: corpus.bigramSupport,
      corpusCharSupport: corpus.charSupport,
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
      // 1-indexed "session about to start" — the loader's count
      // reflects sessions already persisted, so the upcoming one is
      // count + 1. Drives the every-DIAGNOSTIC_PERIOD re-baseline.
      upcomingSessionNumber: completedSessionCount + 1,
      // Recent adaptive-target values for the cooldown rule.
      recentTargets,
      exerciseOptions: {
        filters: {
          handIsolation: filters.handIsolation,
          maxLength: filters.maxWordLength === "all" ? undefined : filters.maxWordLength,
        },
      },
    });

    // Dev-only observability: surface the top-3 weakness candidates and
    // their weighted scores so it's easy to tell *why* a target was
    // picked (and, after a session, whether it's about to change).
    if (import.meta.env.DEV) {
      const ranked = rankTargets(stats, baseline, phase, () => 0.5, {
        corpusBigramSupport: corpus.bigramSupport,
        corpusCharSupport: corpus.charSupport,
        recentTargets,
      }).slice(0, 3);
      console.log(
        "[adaptive] top-3 weakness candidates:",
        ranked.map((t) => ({ type: t.type, value: t.value, score: t.score?.toFixed(3) })),
      );
      console.log("[adaptive] picked:", output.target.type, JSON.stringify(output.target.value));
    }

    briefingShownAtRef.current = new Date();
    sessionModeRef.current = "adaptive";
    setPendingSession(output);
  };

  // Kept for post-session Enter shortcut and post-complete keyboard handler.
  const startAdaptive = generateSessionAndShowBriefing;

  const restartSameExercise = () => {
    if (!currentTarget) return;
    sessionStore
      .getState()
      .dispatch({ type: "start", target: currentTarget, now: performance.now(), targetKeys: [] });
    setPaused(false);
  };

  const endSession = () => {
    sessionStore.getState().dispatch({ type: "reset" });
    setPaused(false);
  };

  // Auto-start when arriving with `?autostart=1` (Home hero CTAs). Fires
  // exactly once: the effect immediately clears the param via
  // `replace: true`, so on the subsequent render autostart is falsy and
  // a real "end session → back to pre-session" transition won't retrigger.
  // With the new briefing flow, autostart still shows the briefing — it just
  // skips the PreSessionStage click and goes straight to the SessionBriefing.
  // We read generateSessionAndShowBriefing through a ref so we don't have to
  // thread its (transitively state-dependent) closure into the effect deps.
  const generateSessionRef = useRef(generateSessionAndShowBriefing);
  generateSessionRef.current = generateSessionAndShowBriefing;
  useEffect(() => {
    if (!search.autostart) return;
    if (status !== "idle") return;
    if (pendingSession !== null) return;
    // Diagnostic doesn't need the corpus; adaptive does. Wait for it.
    if (!useDiagnostic && corpus.status !== "ready") return;
    generateSessionRef.current();
    void navigate({ to: "/practice", search: {}, replace: true });
  }, [search.autostart, status, pendingSession, useDiagnostic, corpus.status, navigate]);

  // Esc toggles the manual pause overlay during a live session. We
  // listen while active *or* paused — the latter because idle auto-
  // pause may have flipped the store into "paused" without the overlay
  // being open, and Esc should still escalate that into the overlay.
  //
  // Clock state is reducer-managed: opening the overlay dispatches a
  // `pause` (freezing the clock if it wasn't frozen already); resuming
  // dispatches `resume`. This is what makes Esc pause actually freeze
  // the timer — previously it only unbound keystroke capture and
  // WPM/elapsed kept ticking on wall time.
  useEffect(() => {
    if (status !== "active" && status !== "paused") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setPaused((prev) => {
        const next = !prev;
        const state = sessionStore.getState();
        if (next) {
          // Opening overlay. Dispatch pause only if not already paused
          // (idle auto-pause may have already done it for us).
          if (state.status === "active") {
            state.dispatch({ type: "pause", now: performance.now() });
          }
        } else {
          // Closing overlay. Explicit resume — capture is gated off
          // while paused, so reducer's keypress auto-resume can't fire.
          if (state.status === "paused") {
            state.dispatch({ type: "resume", now: performance.now() });
          }
        }
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  // Tab → restart current exercise. Only bound while the session is
  // live and the pause overlay is closed; when the overlay is open,
  // native Tab focus-walking owns the key.
  useEffect(() => {
    if (status !== "active" && status !== "paused") return;
    if (paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      e.preventDefault();
      const state = sessionStore.getState();
      if (!state.target) return;
      state.dispatch({
        type: "start",
        target: state.target,
        now: performance.now(),
        targetKeys: [],
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, paused]);

  // Idle auto-pause watchdog (see useIdleAutoPause.ts). Active whenever
  // we are mid-session, including while the pause overlay is open (the
  // reducer's pause action is a no-op if already paused).
  useIdleAutoPause(status === "active" || status === "paused");

  // Task 4.2 — warn before accidental close/reload while mid-session.
  // Browsers only honor this after user interaction, which the in-progress
  // session implies by definition.
  const sessionInFlight = status === "active" || status === "paused";
  useBeforeUnloadWarning(sessionInFlight);

  // Task 4.2 — cross-tab detection. Soft signal only: we surface a
  // banner on the pre-session stage, not a hard lock, because the user
  // may have abandoned the other tab.
  const otherTabActive = useOtherTabActive(sessionInFlight);

  // Task 4.2 — drain any retry backlog on mount. Fire-and-forget; the
  // in-flight guard inside the wrapper coalesces this with flushes
  // triggered by successful saves.
  useEffect(() => {
    void flushSessionQueue();
  }, []);

  // Post-session keyboard shortcuts — see docs/06-design-summary.md
  // §Keyboard Shortcuts. TypingArea's capture is off when status=complete,
  // so this listener does not collide with it.
  //
  // Also gated on `pendingSession === null`: after "Practice again" sets a
  // pending session, the render flips to SessionBriefing while status is
  // still "complete". Without this guard, the post-session listener would
  // stay attached and fight the briefing's own Enter listener.
  useEffect(() => {
    if (status !== "complete") return;
    if (pendingSession !== null) return;
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    const clearGPending = () => {
      gPending = false;
      if (gTimer) {
        clearTimeout(gTimer);
        gTimer = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      const targetEl = e.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || targetEl?.isContentEditable === true;

      // ⌘D / Ctrl+D → dashboard. Check modifier combo before plain-D branch
      // so ⌘D isn't mistakenly routed to drill.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        if (e.altKey || e.shiftKey) return;
        clearGPending();
        e.preventDefault();
        void navigate({ to: "/dashboard" });
        return;
      }

      // Remaining shortcuts: ignore any modifier combo, and ignore when
      // focus is inside a text field (per spec guard rules).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inField) return;

      // Use `e.code` (physical key) rather than `e.key` for vim
      // navigation — some browsers/layouts emit `e.key === "g"` for
      // Shift+g instead of "G", which would make G silently fail.
      const isKeyG = e.code === "KeyG";

      // Any non-`g` key cancels a pending gg — otherwise unrelated
      // keystrokes would "glue" into an accidental top-jump.
      if (!isKeyG) clearGPending();

      if (e.key === "Enter") {
        e.preventDefault();
        generateSessionRef.current();
        return;
      }

      if (e.code === "KeyD") {
        e.preventDefault();
        const state = sessionStore.getState();
        const summary = summarizeSession({
          target: state.target,
          events: state.events,
          keyboardType: profile.keyboardType,
          startedAt: state.startedAt,
          completedAt: state.completedAt,
          pausedMs: state.pausedMs,
          phase: profile.transitionPhase,
        });
        void navigate({
          to: "/practice/drill",
          search: summary.topWeaknessName ? { target: summary.topWeaknessName } : {},
        });
        return;
      }

      if (isKeyG && e.shiftKey) {
        e.preventDefault();
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
        return;
      }
      if (isKeyG && !e.shiftKey) {
        if (gPending) {
          clearGPending();
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          gPending = true;
          gTimer = setTimeout(() => {
            gPending = false;
            gTimer = null;
          }, 600);
        }
        return;
      }

      if (e.shiftKey) return;

      const step = Math.round(window.innerHeight * 0.4);
      if (e.code === "KeyJ") {
        e.preventDefault();
        window.scrollBy({ top: step, behavior: "smooth" });
        return;
      }
      if (e.code === "KeyK") {
        e.preventDefault();
        window.scrollBy({ top: -step, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
    // generateSessionRef is a stable ref — no need to list the function
    // itself. corpus/filters are read through the ref closure, not captured
    // directly here, so they don't belong in deps.
  }, [status, pendingSession, navigate, profile.keyboardType, profile.transitionPhase]);

  // Fire-and-forget session persistence (Task 2.8 / 4.2). Dedup by
  // completedAt so Strict Mode's double-invoked effect doesn't produce
  // two rows. `persistSessionWithRetry` swallows errors (queueing the
  // payload for later), so the summary UI stands on its own regardless
  // of network outcome.
  const lastPersistedAt = useRef<number | null>(null);
  useEffect(() => {
    if (status !== "complete") return;
    const state = sessionStore.getState();
    if (state.events.length === 0) return;
    if (state.completedAt === null) return;
    if (lastPersistedAt.current === state.completedAt) return;
    lastPersistedAt.current = state.completedAt;

    const elapsedMs =
      state.startedAt !== null ? Math.max(0, state.completedAt - state.startedAt) : 0;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - elapsedMs);

    const st = currentSessionTargetRef.current;
    // Invalidate the route on completion so the next "Practice again"
    // reads fresh stats (updated character_stats / bigram_stats) instead
    // of the loader snapshot from page mount — otherwise selectTarget
    // keeps picking the same target across sessions on the same page.
    void persistSessionWithRetry({
      sessionId: crypto.randomUUID(),
      keyboardProfileId: profile.id,
      mode: sessionModeRef.current,
      target: state.target,
      events: state.events.map((e) => ({
        targetChar: e.targetChar,
        actualChar: e.actualChar,
        isError: e.isError,
        keystrokeMs: e.keystrokeMs,
        prevChar: e.prevChar,
        timestamp: e.timestamp.toISOString(),
      })),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      phase: profile.transitionPhase,
      filterConfig: {
        handIsolation: filters.handIsolation,
        maxWordLength: filters.maxWordLength,
      },
      ...(st !== null
        ? {
            sessionTarget: {
              type: st.type,
              value: st.value,
              keys: st.keys,
              label: st.label,
              selectionScore: st.score ?? null,
              declaredAt: briefingShownAtRef.current?.toISOString() ?? new Date().toISOString(),
              attempts: state.targetAttempts,
              errors: state.targetErrors,
              accuracy:
                state.targetAttempts > 0 ? 1 - state.targetErrors / state.targetAttempts : null,
            },
          }
        : {}),
    }).finally(() => {
      void router.invalidate();
    });
  }, [status, profile.id, profile.transitionPhase, filters, router]);

  // Per-key breakdown for the post-session summary — computed once on complete.
  // useMemo re-runs if status flips (idle → complete → idle), which is fine.
  const sessionState = sessionStore.getState();
  const perKeyBreakdown = useMemo(() => {
    if (status !== "complete") return [];
    const st = currentSessionTargetRef.current;
    if (!st || st.keys.length === 0) return [];
    const keySet = new Set(st.keys);
    const acc: Record<string, { attempts: number; errors: number }> = {};
    for (const ev of sessionState.events) {
      if (!keySet.has(ev.targetChar)) continue;
      if (!acc[ev.targetChar]) acc[ev.targetChar] = { attempts: 0, errors: 0 };
      const entry = acc[ev.targetChar]!;
      entry.attempts++;
      if (ev.isError) entry.errors++;
    }
    return Object.entries(acc)
      .map(([key, { attempts, errors }]) => ({
        key,
        accuracy: attempts > 0 ? 1 - errors / attempts : 1,
        attempts,
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [status, sessionState.events]);

  // Soft next-target preview — use current (pre-session) stats to show
  // what the engine would pick if run right now. Pre-session stats are
  // close enough for Phase A; post-session stats would require a DB
  // round-trip we don't have. Returns null when no confident data.
  const nextTargetPreview = useMemo(() => {
    if (status !== "complete") return null;
    if (!engineData) return null;
    try {
      const next = selectTarget(
        engineData.stats,
        engineData.baseline,
        engineData.phase,
        () => 0.5,
        {
          corpusBigramSupport: corpus.status === "ready" ? corpus.bigramSupport : undefined,
          corpusCharSupport: corpus.status === "ready" ? corpus.charSupport : undefined,
          upcomingSessionNumber: completedSessionCount + 1,
          recentTargets,
        },
      );
      return next.type === "diagnostic" ? null : next.label;
    } catch {
      return null;
    }
  }, [status, engineData, completedSessionCount, recentTargets, corpus]);

  if (status === "active" || status === "paused") {
    // `idleAutoPaused` = clock is frozen by the watchdog but the user
    // hasn't opened the manual overlay. Capture stays on so their next
    // keystroke auto-resumes via the reducer — the chip is purely a
    // visual "the clock is paused, type to resume" signal.
    const idleAutoPaused = status === "paused" && !paused;
    const activeTarget = currentSessionTargetRef.current;
    return (
      <main
        id="main-content"
        className="kerf-practice-main kerf-practice-main--active kerf-stage-fade-in"
      >
        {activeTarget && <TargetRibbon label={activeTarget.label} keys={activeTarget.keys} />}
        <ActiveSessionStage
          keyboardType={profile.keyboardType}
          showKeyboard={pauseSettings.showKeyboard}
          expectedLetterHint={pauseSettings.expectedLetterHint}
          capture={!paused}
          typingSize={pauseSettings.typingSize}
          isFirstSession={sessionModeRef.current === "diagnostic"}
          targetKeys={activeTarget?.keys}
        />
        {idleAutoPaused && <IdlePauseChip />}
        {paused && (
          <PauseOverlay
            settings={pauseSettings}
            onSettingsChange={setPauseSettings}
            onResume={() => {
              if (sessionStore.getState().status === "paused") {
                sessionStore.getState().dispatch({ type: "resume", now: performance.now() });
              }
              setPaused(false);
            }}
            onRestart={restartSameExercise}
            onEnd={endSession}
          />
        )}
      </main>
    );
  }

  // Briefing stage: generateSession ran, waiting for user to confirm start.
  // Checked before the `complete` branch so "Practice again" from the
  // post-session page (which sets `pendingSession` without resetting the
  // store's `status`) transitions into the briefing instead of re-rendering
  // the same PostSessionStage.
  if (pendingSession !== null) {
    const handleBriefingStart = () => {
      currentSessionTargetRef.current = pendingSession.target;
      sessionStore.getState().dispatch({
        type: "start",
        target: pendingSession.exercise,
        now: performance.now(),
        targetKeys: pendingSession.target.keys,
      });
      setPendingSession(null);
    };
    return (
      <>
        <main id="main-content" className="kerf-practice-main">
          <div className="kerf-practice-container kerf-stage-fade-in">
            <SessionBriefing
              target={pendingSession.target}
              briefingText={pendingSession.briefing.text}
              onStart={handleBriefingStart}
            />
          </div>
        </main>
        <AppFooter />
      </>
    );
  }

  if (status === "complete") {
    // Pull the values the summary depends on straight from the store.
    // Only read inside the branch so active-session renders aren't
    // tied to state that only matters post-complete.
    const state = sessionStore.getState();
    const summary = summarizeSession({
      target: state.target,
      events: state.events,
      keyboardType: profile.keyboardType,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      pausedMs: state.pausedMs,
      phase: profile.transitionPhase,
    });
    const title = pickSummaryTitle(summary.accuracyPct, profile.transitionPhase);
    return (
      <>
        <main id="main-content" className="kerf-practice-main">
          <div className="kerf-practice-container kerf-stage-fade-in">
            <PostSessionStage
              target={state.target}
              title={title}
              summary={summary}
              onPracticeAgain={startAdaptive}
              sessionTarget={currentSessionTargetRef.current ?? undefined}
              perKeyBreakdown={perKeyBreakdown}
              nextTargetPreview={nextTargetPreview}
            />
          </div>
        </main>
        <AppFooter />
      </>
    );
  }

  return (
    <>
      <main id="main-content" className="kerf-practice-main">
        <div className="kerf-practice-container kerf-stage-fade-in">
          <PreSessionStage
            keyboardType={profile.keyboardType}
            phase={profile.transitionPhase}
            filterValues={filters}
            onFilterChange={setFilters}
            onStartAdaptive={generateSessionAndShowBriefing}
            onDrillWeakness={() => navigate({ to: "/practice/drill", search: {} })}
            onDrillInnerColumn={() =>
              navigate({
                to: "/practice/drill",
                search: { preset: "innerColumn" },
              })
            }
            isFirstSession={useDiagnostic}
          />
          {otherTabActive && (
            <p className="kerf-multitab-banner" role="status" aria-live="polite">
              Another tab has an active practice session. Starting here will save as a separate
              session alongside it.
            </p>
          )}
          {corpus.status === "error" && (
            <p className="kerf-corpus-error" role="alert" aria-live="polite">
              Could not load the word list. Refresh the page to try again.
            </p>
          )}
        </div>
      </main>
      <AppFooter />
    </>
  );
}

/**
 * Subtle visual cue for idle auto-pause. Distinct from the full
 * `PauseOverlay` (which is opened by Esc): no settings, no buttons,
 * just a quiet "— paused — type to resume" chip anchored near the
 * typing area. Input capture is still on, so any keystroke
 * transparently resumes the session via the reducers keypress
 * auto-resume path.
 */
function IdlePauseChip() {
  return (
    <div className="kerf-idle-pause-chip" role="status" aria-live="polite">
      <span className="kerf-idle-pause-chip-dot" aria-hidden="true" />
      paused · type to resume
    </div>
  );
}
