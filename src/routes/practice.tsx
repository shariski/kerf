import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import {
  getActiveProfile,
  hasAnySessionOnActiveProfile,
  type KeyboardType,
  type DominantHand,
} from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import {
  PreSessionStage,
  ActiveSessionStage,
  PauseOverlay,
  PostSessionStage,
  type PauseSettings,
  type PreSessionFilterValues,
} from "#/components/practice";
import { useSessionStore, sessionStore } from "#/stores/sessionStore";
import { useCorpus } from "#/hooks/useCorpus";
import { generateExercise } from "#/domain/adaptive/exerciseGenerator";
import { summarizeSession } from "#/domain/session/summarize";
import { pickSummaryTitle } from "#/domain/session/pickSummaryTitle";
import { getFirstSessionTarget } from "#/domain/session/firstSessionExercise";
import { persistSession } from "#/server/persistSession";

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
  }> => {
    const [profile, hasSession] = await Promise.all([
      getActiveProfile(),
      hasAnySessionOnActiveProfile(),
    ]);
    if (!profile) throw redirect({ to: "/onboarding" });
    return {
      profile: {
        id: profile.id,
        keyboardType: profile.keyboardType as KeyboardType,
        dominantHand: profile.dominantHand as DominantHand,
        transitionPhase: profile.transitionPhase as TransitionPhase,
      },
      isFirstSession: !hasSession,
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

const TARGET_WORD_COUNT = 30;

function PracticePage() {
  const { profile, isFirstSession } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const status = useSessionStore((s) => s.status);
  const currentTarget = useSessionStore((s) => s.target);
  const corpus = useCorpus();

  const [filters, setFilters] = useState<PreSessionFilterValues>(DEFAULT_FILTERS);
  const [paused, setPaused] = useState(false);
  const [pauseSettings, setPauseSettings] = useState<PauseSettings>(
    DEFAULT_PAUSE_SETTINGS,
  );

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

  // Keep pre-session "Visual keyboard" toggle and pause-overlay toggle in sync:
  // flipping either updates the same source of truth the active stage reads.
  useEffect(() => {
    setPauseSettings((s) => ({ ...s, showKeyboard: filters.showKeyboard }));
  }, [filters.showKeyboard]);

  const useDiagnostic = isFirstSession && !diagnosticConsumedRef.current;

  const startAdaptive = () => {
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
        .dispatch({ type: "start", target, now: performance.now() });
      return;
    }

    if (corpus.status !== "ready") return;
    const maxLength =
      filters.maxWordLength === "all" ? undefined : filters.maxWordLength;

    // Cold-start weakness function: uniform weight until session history lands
    // in Phase 3. Biases slightly toward longer words via matchScore — OK
    // since longer words carry more transitions worth practicing.
    const words = generateExercise({
      corpus: corpus.corpus,
      weaknessScoreFor: () => 1,
      filters: { handIsolation: filters.handIsolation, maxLength },
      targetWordCount: TARGET_WORD_COUNT,
    });

    const target = words.join(" ");
    if (!target) return;
    sessionModeRef.current = "adaptive";
    sessionStore
      .getState()
      .dispatch({ type: "start", target, now: performance.now() });
  };

  const restartSameExercise = () => {
    if (!currentTarget) return;
    sessionStore
      .getState()
      .dispatch({ type: "start", target: currentTarget, now: performance.now() });
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
  // We read startAdaptive through a ref so we don't have to thread its
  // (transitively state-dependent) closure into the effect deps.
  const startAdaptiveRef = useRef(startAdaptive);
  startAdaptiveRef.current = startAdaptive;
  useEffect(() => {
    if (!search.autostart) return;
    if (status !== "idle") return;
    // Diagnostic doesn't need the corpus; adaptive does. Wait for it.
    if (!useDiagnostic && corpus.status !== "ready") return;
    startAdaptiveRef.current();
    void navigate({ to: "/practice", search: {}, replace: true });
  }, [search.autostart, status, useDiagnostic, corpus.status, navigate]);

  // Esc toggles pause (only while active)
  useEffect(() => {
    if (status !== "active") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]);

  // Enter restarts from the post-session placeholder. TypingArea's capture is
  // off when status=complete, so this listener does not collide with it.
  useEffect(() => {
    if (status !== "complete") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      startAdaptive();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, corpus.status, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire-and-forget session persistence (Task 2.8). Dedup by completedAt
  // so Strict Mode's double-invoked effect doesn't produce two rows.
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

    persistSession({
      data: {
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
      },
    }).catch((err) => {
      // Summary UI is already rendered — log only per §2.8 decision.
      console.error("persistSession failed:", err);
    });
  }, [status, profile.id, profile.transitionPhase, filters]);

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
      phase: profile.transitionPhase,
    });
    const title = pickSummaryTitle(summary.accuracyPct, profile.transitionPhase);
    return (
      <main className="kerf-practice-main">
        <div className="kerf-practice-container kerf-stage-fade-in">
          <PostSessionStage
            target={state.target}
            title={title}
            summary={summary}
            onPracticeAgain={startAdaptive}
          />
        </div>
      </main>
    );
  }

  if (status === "active") {
    return (
      <main className="kerf-practice-main kerf-practice-main--active kerf-stage-fade-in">
        <ActiveSessionStage
          keyboardType={profile.keyboardType}
          showKeyboard={pauseSettings.showKeyboard}
          expectedLetterHint={pauseSettings.expectedLetterHint}
          capture={!paused}
          typingSize={pauseSettings.typingSize}
          isFirstSession={sessionModeRef.current === "diagnostic"}
        />
        {paused && (
          <PauseOverlay
            settings={pauseSettings}
            onSettingsChange={setPauseSettings}
            onResume={() => setPaused(false)}
            onRestart={restartSameExercise}
            onEnd={endSession}
          />
        )}
      </main>
    );
  }

  return (
    <main className="kerf-practice-main">
      <div className="kerf-practice-container kerf-stage-fade-in">
        <PreSessionStage
          keyboardType={profile.keyboardType}
          phase={profile.transitionPhase}
          filterValues={filters}
          onFilterChange={setFilters}
          onStartAdaptive={startAdaptive}
          onDrillWeakness={() =>
            navigate({ to: "/practice/drill", search: {} })
          }
          onDrillInnerColumn={() =>
            navigate({
              to: "/practice/drill",
              search: { preset: "innerColumn" },
            })
          }
          isFirstSession={useDiagnostic}
        />
        {corpus.status === "error" && (
          <p className="kerf-corpus-error" role="alert" aria-live="polite">
            Could not load the word list. Refresh the page to try again.
          </p>
        )}
      </div>
    </main>
  );
}
