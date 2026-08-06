import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import { noindexHead } from "#/lib/seo-head";
import { getActiveProfile, type KeyboardType, type DominantHand } from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import { getCoachSession } from "#/server/coach";
import { annotateCoachPassage } from "#/server/coach/review";
import type { WhyReport } from "#/domain/coach/whyReport";
import type { PassageRecord } from "#/server/coach/catalog";
import {
  ActiveSessionStage,
  PauseOverlay,
  TargetRibbon,
  type PauseSettings,
} from "#/components/practice";
import { CoachPreSessionStage } from "#/components/coach/CoachPreSessionStage";
import { CoachPostSessionStage } from "#/components/coach/CoachPostSessionStage";
import { CoachGenerationDetails } from "#/components/coach/CoachGenerationDetails";
import { CoachPassageAnnotation } from "#/components/coach/CoachPassageAnnotation";
import { computeMechanismPerformance } from "#/domain/coach/mechanismPerformance";
import type { MechanismKey } from "#/domain/coach/mechanisms";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { LILY58_BASE_LAYER } from "#/domain/finger/lily58";
import type { FingerTable } from "#/domain/finger/types";

function fingerTableFor(keyboardType: KeyboardType): FingerTable {
  return keyboardType === "sofle" ? SOFLE_BASE_LAYER : LILY58_BASE_LAYER;
}
import { useSessionStore, sessionStore } from "#/stores/sessionStore";
import { useIdleAutoPause } from "#/hooks/useIdleAutoPause";
import { useBeforeUnloadWarning } from "#/hooks/useBeforeUnloadWarning";
import { useOtherTabActive } from "#/hooks/useOtherTabActive";
import { summarizeSession } from "#/domain/session/summarize";
import { flushSessionQueue, persistSessionWithRetry } from "#/lib/persistSessionWithRetry";
import { AppFooter } from "#/components/nav/AppFooter";

type LoadedProfile = {
  id: string;
  keyboardType: KeyboardType;
  dominantHand: DominantHand;
  transitionPhase: TransitionPhase;
};

type Stage = "loading" | "pre" | "typing" | "post" | "error";

/**
 * Map server CoachError messages to flat user copy. Raw server strings
 * (LLM internals, gate violations, HTTP details) never surface verbatim.
 */
function coachErrorCopy(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/daily coach limit/i.test(msg)) {
    return "You have used today's session. Come back tomorrow.";
  }
  if (/not enough typing data/i.test(msg)) {
    return "Not enough typing data yet to build a personalized passage. Keep practicing — Coach will be ready soon.";
  }
  if (/failed gate|quality/i.test(msg)) {
    return "The passage didn't meet the quality check. Please try again in a moment.";
  }
  if (/deepseek|unavailable|empty content|missing test_cases|json|reasoning|llm/i.test(msg)) {
    return "Passage generation is temporarily unavailable. Please try again in a moment.";
  }
  return "Coach couldn't prepare your session. Please try again.";
}

const DEFAULT_PAUSE_SETTINGS: PauseSettings = {
  typingSize: "M",
  showKeyboard: true,
  expectedLetterHint: true,
  focusedKeyHint: true,
};

export const Route = createFileRoute("/practice_/coach")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<{ profile: LoadedProfile }> => {
    const profile = await getActiveProfile();
    if (!profile) throw redirect({ to: "/onboarding" });
    return {
      profile: {
        id: profile.id,
        keyboardType: profile.keyboardType as KeyboardType,
        dominantHand: profile.dominantHand as DominantHand,
        transitionPhase: profile.transitionPhase as TransitionPhase,
      },
    };
  },
  head: () => noindexHead(),
  component: CoachPage,
});

function CoachPage() {
  const { profile } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const status = useSessionStore((s) => s.status);

  const [stage, setStage] = useState<Stage>("loading");
  const [report, setReport] = useState<WhyReport | null>(null);
  const [targetMechanism, setTargetMechanism] = useState<MechanismKey | null>(null);
  const [passage, setPassage] = useState<PassageRecord | null>(null);
  const [quota, setQuota] = useState<{ usedToday: number; remaining: number }>({
    usedToday: 0,
    remaining: 1,
  });
  const [reviewMode, setReviewMode] = useState(false);
  const [annotated, setAnnotated] = useState(false);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [pauseSettings, setPauseSettings] = useState<PauseSettings>(DEFAULT_PAUSE_SETTINGS);
  const passageRef = useRef<PassageRecord | null>(null);

  type CachedCoachSession = {
    report: WhyReport;
    targetMechanism: MechanismKey;
    quota: { usedToday: number; remaining: number };
    passage: PassageRecord;
    reviewMode: boolean;
  };
  const dayKey = useCallback(
    (suffix = "") => `coach:v1:${suffix}${profile.id}:${new Date().toISOString().slice(0, 10)}`,
    [profile.id],
  );

  /** Promote a fetched/cached session into the briefing state. */
  const applySession = useCallback((res: CachedCoachSession) => {
    setReport(res.report);
    setTargetMechanism(res.targetMechanism);
    setQuota(res.quota);
    setPassage(res.passage);
    setReviewMode(res.reviewMode);
    passageRef.current = res.passage;
    // Annotation state is per-passage: reset on every new session, and
    // reflect a verdict that was already stored on the passage (e.g. a
    // refresh restoring an annotated candidate).
    setAnnotated(res.passage.reviewVerdict != null);
    setStage("pre");
  }, []);

  /** Read the main (current-briefing) cache slot, if it holds a session. */
  const readMainCache = useCallback((): CachedCoachSession | null => {
    try {
      const raw = sessionStorage.getItem(dayKey());
      if (!raw) return null;
      const cached = JSON.parse(raw) as CachedCoachSession;
      return cached.report && cached.passage ? cached : null;
    } catch {
      return null;
    }
  }, [dayKey]);

  /**
   * Promote the prefetched `next:` candidate into the briefing (moves it
   * to the main slot). Returns true when a candidate was ready — making
   * "Practice again" and refreshes instant.
   */
  const promoteNextCache = useCallback((): boolean => {
    try {
      const raw = sessionStorage.getItem(dayKey("next:"));
      if (!raw) return false;
      const cached = JSON.parse(raw) as CachedCoachSession;
      if (!cached.report || !cached.passage) return false;
      sessionStorage.setItem(dayKey(), raw);
      sessionStorage.removeItem(dayKey("next:"));
      applySession(cached);
      return true;
    } catch {
      return false;
    }
  }, [dayKey, applySession]);

  // Coach session fetch. Guarded against StrictMode's double-invoked
  // dev effect: the server consumes the daily quota at fetch time, so
  // a second concurrent fetch would throw QUOTA_EXCEEDED and clobber
  // the first one's pre-stage.
  const coachFetchInFlight = useRef(false);
  // True when "next session" explicitly requested a fresh fetch. On a
  // plain arrival the cached/prefetched session is restored instead of
  // re-fetching (the /practice page prefetches it in the background).
  const explicitFetchRef = useRef(false);
  useEffect(() => {
    if (stage !== "loading") return;
    if (coachFetchInFlight.current) return;
    coachFetchInFlight.current = true;

    // Session cache: the server consumes the daily quota at fetch time, so
    // a refresh mid-flow would otherwise hit QUOTA_EXCEEDED with the fetched
    // passage unrecoverable. Cache today's session in sessionStorage and
    // restore it on quota exhaustion. Keyed per profile + UTC day.
    const cacheKey = dayKey();
    const cacheCoachSession = (res: CachedCoachSession) => {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(res));
      } catch {
        // Quota/sessionStorage unavailable — fetch still works.
      }
    };
    const restoreCoachSession = (): boolean => {
      const cached = readMainCache();
      if (!cached) return false;
      applySession(cached);
      return true;
    };

    // Arrival with a prefetched candidate (`next:` key — written by the
    // /practice page or by the while-typing prefetch): promote it so the
    // briefing shows the freshest passage, not the sticky day's first.
    // Outside review mode the main cache is the day's quota allocation —
    // restore it (prod semantics). In review mode (staging) refreshes
    // must produce fresh candidates, so fall through to a real fetch.
    if (!explicitFetchRef.current) {
      explicitFetchRef.current = false;
      if (promoteNextCache()) return;
      const sticky = readMainCache();
      if (sticky && !sticky.reviewMode) {
        applySession(sticky);
        return;
      }
    }
    explicitFetchRef.current = false;

    getCoachSession({ data: { keyboardProfileId: profile.id } })
      .then((res) => {
        cacheCoachSession(res);
        // The server consumes the day's quota inside this call, so on a
        // one-per-day plan `remaining` is honestly 0 here. The pre-stage
        // does not gate its start button on that — the fetched passage IS
        // today's allocation. True exhaustion never reaches this branch;
        // it surfaces as a QUOTA_EXCEEDED error, mapped below.
        applySession(res);
      })
      .catch((err: unknown) => {
        // Refresh after a successful fetch lands here (quota spent on the
        // first fetch). Restore the cached session instead of erroring.
        const msg = err instanceof Error ? err.message : String(err);
        if (/daily coach limit/i.test(msg) && restoreCoachSession()) {
          return;
        }
        setError(coachErrorCopy(err));
        setStage("error");
      })
      .finally(() => {
        coachFetchInFlight.current = false;
      });
  }, [stage, profile.id, applySession, dayKey, promoteNextCache, readMainCache]);

  // Esc toggles the manual pause overlay during a live session —
  // mirrors the practice/drill routes' handling.
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
          if (state.status === "active") {
            state.dispatch({ type: "pause", now: performance.now() });
          }
        } else {
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

  // Tab → restart the current passage. Mirrors the drill route's Tab
  // handler; only bound while the session is live and the overlay is
  // closed (when the overlay is open, native Tab focus-walk owns it).
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

  const sessionInFlight = status === "active" || status === "paused";
  useIdleAutoPause(sessionInFlight);
  useBeforeUnloadWarning(sessionInFlight);
  const otherTabActive = useOtherTabActive(sessionInFlight);

  // Every fresh arrival at /practice/coach is a clean slate: clear the
  // local paused flag and scrub any session-store status that survived
  // the remount from a prior route (singleton store) — otherwise the
  // idle-pause watchdog and beforeunload warning would keep running
  // against a stale, orphaned session. Mirrors the drill route.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (pathname !== "/practice/coach") return;
    setPaused(false);
    const state = sessionStore.getState();
    if (state.status !== "idle") {
      state.dispatch({ type: "reset" });
    }
  }, [pathname]);

  // Drain any retry backlog on mount — same as practice/drill.
  useEffect(() => {
    void flushSessionQueue();
  }, []);

  const startSession = () => {
    const target = passage?.text ?? "";
    if (!target) return;
    sessionStore
      .getState()
      .dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
    setPaused(false);
    setStage("typing");
  };

  const restartSamePassage = () => {
    const target = passageRef.current?.text ?? passage?.text ?? "";
    if (!target) return;
    sessionStore
      .getState()
      .dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
    setPaused(false);
    setStage("typing");
  };

  /**
   * "Practice again" after a finished session — mirrors basic adaptive
   * practice's generateSessionAndShowBriefing: start a NEW session. The
   * next candidate was prefetched while the user typed the previous one,
   * so this is normally an instant promotion from the `next` cache key.
   * Falls back to a synchronous fetch (brief loading) when the prefetch
   * hasn't landed yet, or to replaying the fetched passage when today's
   * quota is spent (prod).
   */
  const nextSession = () => {
    if (quota.remaining <= 0) {
      restartSamePassage();
      return;
    }
    // Normally the next candidate was prefetched while typing — promote
    // it instantly. Otherwise fetch synchronously (brief loading).
    if (promoteNextCache()) return;
    explicitFetchRef.current = true;
    setStage("loading");
  };

  // While the user types the current passage, prefetch the NEXT
  // candidate in the background so "Practice again" is instant. Quota is
  // consumed at fetch time, so only prefetch while sessions remain today
  // (on prod that's after the day's single fetch → no-op). Failures are
  // swallowed — nextSession falls back to a synchronous fetch.
  useEffect(() => {
    if (stage !== "typing") return;
    if (quota.remaining <= 0) return;
    const nextKey = dayKey("next:");
    let hasNext = false;
    try {
      hasNext = sessionStorage.getItem(nextKey) !== null;
    } catch {
      // sessionStorage unavailable — fall through.
    }
    if (hasNext) return;
    getCoachSession({ data: { keyboardProfileId: profile.id } })
      .then((res) => {
        try {
          sessionStorage.setItem(nextKey, JSON.stringify(res));
        } catch {
          // Cache write failure — nextSession fetches synchronously.
        }
      })
      .catch(() => {
        // Generation can fail (LLM hiccups); nextSession will surface it.
      });
  }, [stage, quota.remaining, profile.id, dayKey]);

  // Post-session persistence — same dedup + event DTO mapping as the
  // practice/drill routes, with the passage attached for the coach
  // pipeline. `sessionTarget` is intentionally omitted: the coach
  // session's target is the passage text, not an engine target.
  const lastPersistedAt = useRef<number | null>(null);
  useEffect(() => {
    if (status !== "complete") return;
    if (stage !== "typing") return;
    const state = sessionStore.getState();
    if (state.events.length === 0) return;
    if (state.completedAt === null) return;
    if (lastPersistedAt.current === state.completedAt) return;
    lastPersistedAt.current = state.completedAt;

    const elapsedMs =
      state.startedAt !== null ? Math.max(0, state.completedAt - state.startedAt) : 0;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - elapsedMs);

    const p = passageRef.current;
    void persistSessionWithRetry({
      sessionId: crypto.randomUUID(),
      keyboardProfileId: profile.id,
      mode: "coach",
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
      filterConfig: { coachPassage: p?.id ?? null },
      passageId: p?.id ?? null,
    }).finally(() => {
      void router.invalidate();
    });
  }, [status, stage, profile.id, profile.transitionPhase, router]);

  // Once the session completes, move out of the typing stage into the
  // post-session summary.
  useEffect(() => {
    if (status !== "complete" || stage !== "typing") return;
    setStage("post");
  }, [status, stage]);

  // Post-session keyboard shortcuts — mirrors practice.tsx's handler
  // for parity with the hint strip PostSessionStage renders (Enter
  // next session, D drill, ⌘D dashboard, j/k/gg/G scroll).
  const nextSessionRef = useRef(nextSession);
  nextSessionRef.current = nextSession;
  useEffect(() => {
    if (status !== "complete") return;
    if (stage !== "post") return;
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

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "d") {
        if (e.altKey || e.shiftKey) return;
        clearGPending();
        e.preventDefault();
        void navigate({ to: "/dashboard" });
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (inField) return;

      const isKeyG = e.code === "KeyG";
      if (!isKeyG) clearGPending();

      if (e.key === "Enter") {
        e.preventDefault();
        nextSessionRef.current();
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
    // restartRef is a stable ref — no need to list the function itself.
  }, [status, stage, navigate, profile.keyboardType, profile.transitionPhase]);

  // --- render branches ------------------------------------------------------

  if (stage === "typing") {
    const idleAutoPaused = status === "paused" && !paused;
    return (
      <main
        id="main-content"
        className="kerf-practice-main kerf-practice-main--active kerf-stage-fade-in"
      >
        {targetMechanism && <TargetRibbon label={`Coach · ${targetMechanism}`} keys={[]} />}
        <ActiveSessionStage
          keyboardType={profile.keyboardType}
          showKeyboard={pauseSettings.showKeyboard}
          expectedLetterHint={pauseSettings.expectedLetterHint}
          capture={!paused}
          typingSize={pauseSettings.typingSize}
        />
        {idleAutoPaused && <CoachIdlePauseChip />}
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
            onRestart={restartSamePassage}
            onEnd={() => {
              sessionStore.getState().dispatch({ type: "reset" });
              setPaused(false);
              setStage("pre");
            }}
          />
        )}
      </main>
    );
  }

  return (
    <>
      <main id="main-content" className="kerf-practice-main">
        <div className="kerf-practice-container kerf-stage-fade-in">
          {stage === "loading" && (
            <p className="kerf-coach-loading" role="status" aria-live="polite">
              Preparing your session — the first passage can take a few minutes
            </p>
          )}
          {stage === "pre" && report && passage && targetMechanism && (
            <>
              <CoachGenerationDetails passage={passage} reviewMode={reviewMode} />
              <CoachPreSessionStage
                report={report}
                targetMechanism={targetMechanism}
                quota={quota}
                passage={passage}
                onStart={startSession}
              />
            </>
          )}
          {stage === "post" && status === "complete" && (
            <>
              <CoachPostSessionStage
                target={sessionStore.getState().target}
                summary={summarizeSession({
                  target: sessionStore.getState().target,
                  events: sessionStore.getState().events,
                  keyboardType: profile.keyboardType,
                  startedAt: sessionStore.getState().startedAt,
                  completedAt: sessionStore.getState().completedAt,
                  pausedMs: sessionStore.getState().pausedMs,
                  phase: profile.transitionPhase,
                })}
              mechanismPerformance={computeMechanismPerformance(
                sessionStore.getState().events,
                fingerTableFor(profile.keyboardType),
              )}
              targetedMechanism={targetMechanism}
              quota={quota}
              onAgain={nextSession}
            />
            <CoachGenerationDetails passage={passage!} reviewMode={reviewMode} />
            <CoachPassageAnnotation
              reviewMode={reviewMode}
              saved={annotated}
              gatePassed={passage!.qualityGate.passed}
              gateViolations={passage!.qualityGate.violations}
              onSave={async (input) => {
                await annotateCoachPassage({
                  data: { passageId: passage!.id, ...input },
                });
                setAnnotated(true);
              }}
            />
            </>
          )}
          {stage === "error" && (
            <p className="kerf-coach-error" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          {otherTabActive && stage === "pre" && (
            <p className="kerf-multitab-banner" role="status" aria-live="polite">
              Another tab has an active practice session. Starting here will save as a separate
              session alongside it.
            </p>
          )}
        </div>
      </main>
      <AppFooter />
    </>
  );
}

/**
 * Idle-pause visual chip — same shape as the practice/drill routes.
 * Kept route-local rather than shared, matching the drill route's
 * DrillIdlePauseChip precedent.
 */
function CoachIdlePauseChip() {
  return (
    <div className="kerf-idle-pause-chip" role="status" aria-live="polite">
      <span className="kerf-idle-pause-chip-dot" aria-hidden="true" />
      paused · type to resume
    </div>
  );
}
