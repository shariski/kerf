import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import {
  getActiveProfile,
  hasAnySessionOnActiveProfile,
  updateFingerAssignment,
  type KeyboardType,
  type DominantHand,
} from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import type { JourneyCode } from "#/domain/adaptive/journey";
import {
  PreSessionStage,
  ActiveSessionStage,
  PauseOverlay,
  PostSessionStage,
  JourneyCaptureCard,
  type PauseSettings,
  type PreSessionFilterValues,
} from "#/components/practice";
import { useSessionStore, sessionStore } from "#/stores/sessionStore";
import { useIdleAutoPause } from "#/hooks/useIdleAutoPause";
import { useCorpus } from "#/hooks/useCorpus";
import { generateExercise } from "#/domain/adaptive/exerciseGenerator";
import { summarizeSession } from "#/domain/session/summarize";
import { pickSummaryTitle } from "#/domain/session/pickSummaryTitle";
import { getFirstSessionTarget } from "#/domain/session/firstSessionExercise";
import { flushSessionQueue, persistSessionWithRetry } from "#/lib/persistSessionWithRetry";
import { useBeforeUnloadWarning } from "#/hooks/useBeforeUnloadWarning";
import { useOtherTabActive } from "#/hooks/useOtherTabActive";
import { AppFooter } from "#/components/nav/AppFooter";

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
  fingerAssignment: JourneyCode | null; // null = pre-ADR-003 profile
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
        fingerAssignment: (profile.fingerAssignment as JourneyCode | null) ?? null,
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
        .dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
      return;
    }

    if (corpus.status !== "ready") return;
    const maxLength = filters.maxWordLength === "all" ? undefined : filters.maxWordLength;

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
      .dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
  };

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
  useEffect(() => {
    if (status !== "complete") return;
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
        startAdaptive();
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
    // startAdaptive closes over corpus/filters/refs; we intentionally do not
    // list it to avoid re-subscribing on every keystroke-induced filter change.
  }, [status, corpus.status, filters, navigate, profile.keyboardType, profile.transitionPhase]); // eslint-disable-line react-hooks/exhaustive-deps

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
    });
  }, [status, profile.id, profile.transitionPhase, filters]);

  // ADR-003 §2 — pre-ADR-003 profiles have NULL finger_assignment.
  // Gate the entire practice flow until the user answers.
  if (profile.fingerAssignment === null) {
    return (
      <>
        <main id="main-content" className="kerf-practice-main">
          <div className="kerf-practice-container kerf-stage-fade-in">
            <JourneyCaptureCard
              onSubmit={async (journey) => {
                await updateFingerAssignment({ data: { journey } });
                void router.invalidate();
              }}
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
            />
          </div>
        </main>
        <AppFooter />
      </>
    );
  }

  if (status === "active" || status === "paused") {
    // `idleAutoPaused` = clock is frozen by the watchdog but the user
    // hasn't opened the manual overlay. Capture stays on so their next
    // keystroke auto-resumes via the reducer — the chip is purely a
    // visual "the clock is paused, type to resume" signal.
    const idleAutoPaused = status === "paused" && !paused;
    return (
      <main
        id="main-content"
        className="kerf-practice-main kerf-practice-main--active kerf-stage-fade-in"
      >
        <ActiveSessionStage
          keyboardType={profile.keyboardType}
          showKeyboard={pauseSettings.showKeyboard}
          expectedLetterHint={pauseSettings.expectedLetterHint}
          capture={!paused}
          typingSize={pauseSettings.typingSize}
          isFirstSession={sessionModeRef.current === "diagnostic"}
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

  return (
    <>
      <main id="main-content" className="kerf-practice-main">
        <div className="kerf-practice-container kerf-stage-fade-in">
          <PreSessionStage
            keyboardType={profile.keyboardType}
            phase={profile.transitionPhase}
            filterValues={filters}
            onFilterChange={setFilters}
            onStartAdaptive={startAdaptive}
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
