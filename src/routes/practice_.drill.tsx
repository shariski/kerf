import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import { noindexHead } from "#/lib/seo-head";
import { getActiveProfile, type KeyboardType, type DominantHand } from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import {
  ActiveSessionStage,
  PauseOverlay,
  DrillPreSessionStage,
  DrillPostSessionStage,
  SessionBriefing,
  TargetRibbon,
  type PauseSettings,
  type PresetKey,
} from "#/components/practice";
import { useSessionStore, sessionStore } from "#/stores/sessionStore";
import { useIdleAutoPause } from "#/hooks/useIdleAutoPause";
import { useCorpus } from "#/hooks/useCorpus";
import {
  INNER_COLUMN_CHARS,
  generateCrossHandBigramDrill,
  generateDrill,
  generateThumbClusterDrill,
} from "#/domain/adaptive/drillGenerator";
import { generateSession } from "#/domain/adaptive/sessionGenerator";
import type { SessionOutput } from "#/domain/adaptive/sessionGenerator";
import type { SessionTarget } from "#/domain/adaptive/targetSelection";
import { buildBriefing } from "#/domain/adaptive/briefingTemplates";
import { DRILL_LIBRARY } from "#/domain/adaptive/drillLibraryData";
import { summarizeSession } from "#/domain/session/summarize";
import { summarizeDrill } from "#/domain/session/drillSummary";
import { flushSessionQueue, persistSessionWithRetry } from "#/lib/persistSessionWithRetry";
import { useBeforeUnloadWarning } from "#/hooks/useBeforeUnloadWarning";
import { useOtherTabActive } from "#/hooks/useOtherTabActive";
import type { Corpus } from "#/domain/corpus/types";
import { AppFooter } from "#/components/nav/AppFooter";

type LoadedProfile = {
  id: string;
  keyboardType: KeyboardType;
  dominantHand: DominantHand;
  transitionPhase: TransitionPhase;
};

type DrillSearch = {
  target?: string;
  preset?: PresetKey;
};

const VALID_PRESETS: ReadonlySet<string> = new Set([
  "innerColumn",
  "thumbCluster",
  "crossHandBigram",
  "verticalColumn-leftPinky",
  "verticalColumn-leftRing",
  "verticalColumn-leftMiddle",
  "verticalColumn-leftIndexOuter",
  "verticalColumn-leftIndexInner",
  "verticalColumn-rightIndexInner",
  "verticalColumn-rightIndexOuter",
  "verticalColumn-rightMiddle",
  "verticalColumn-rightRing",
  "verticalColumn-rightPinky",
]);

/**
 * Narrow raw URL search params to the typed `DrillSearch` shape.
 * Tanstack Router hands us `Record<string, unknown>` by default; this
 * validator drops anything unrecognized and clamps target length to
 * what the drill generator accepts (1 or 2 chars).
 */
function validateDrillSearch(search: Record<string, unknown>): DrillSearch {
  const out: DrillSearch = {};
  const t = search.target;
  if (typeof t === "string") {
    const trimmed = t.trim().toLowerCase();
    if (trimmed.length === 1 || trimmed.length === 2) {
      out.target = trimmed;
    }
  }
  const p = search.preset;
  if (typeof p === "string" && VALID_PRESETS.has(p)) {
    out.preset = p as PresetKey;
  }
  return out;
}

export const Route = createFileRoute("/practice_/drill")({
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
  validateSearch: validateDrillSearch,
  head: () => noindexHead(),
  component: DrillPage,
});

const DEFAULT_PAUSE_SETTINGS: PauseSettings = {
  typingSize: "M",
  showKeyboard: true,
  expectedLetterHint: true,
  focusedKeyHint: true,
};

/** Default journey for drill mode — no user journey data available. */
const DRILL_JOURNEY = "conventional" as const;

/**
 * Map a vertical-column preset key to the (value, keys) the drill library
 * uses. Values must match DRILL_LIBRARY entries exactly.
 */
const VERTICAL_COLUMN_MAP: Record<string, { value: string; keys: string[]; label: string }> = {
  "verticalColumn-leftPinky": {
    value: "left-pinky",
    keys: ["q", "a", "z"],
    label: "Left pinky column vertical reach",
  },
  "verticalColumn-leftRing": {
    value: "left-ring",
    keys: ["w", "s", "x"],
    label: "Left ring column vertical reach",
  },
  "verticalColumn-leftMiddle": {
    value: "left-middle",
    keys: ["e", "d", "c"],
    label: "Left middle column vertical reach",
  },
  "verticalColumn-leftIndexOuter": {
    value: "left-index-outer",
    keys: ["r", "f", "v"],
    label: "Left index (outer) column vertical reach",
  },
  "verticalColumn-leftIndexInner": {
    value: "left-index-inner",
    keys: ["t", "g", "b"],
    label: "Left index (inner) column vertical reach",
  },
  "verticalColumn-rightIndexInner": {
    value: "right-index-inner",
    keys: ["y", "h", "n"],
    label: "Right index (inner) column vertical reach",
  },
  "verticalColumn-rightIndexOuter": {
    value: "right-index-outer",
    keys: ["u", "j", "m"],
    label: "Right index (outer) column vertical reach",
  },
  "verticalColumn-rightMiddle": {
    value: "right-middle",
    keys: ["i", "k", ","],
    label: "Right middle column vertical reach",
  },
  "verticalColumn-rightRing": {
    value: "right-ring",
    keys: ["o", "l", "."],
    label: "Right ring column vertical reach",
  },
  "verticalColumn-rightPinky": {
    value: "right-pinky",
    keys: ["p", ";", "/"],
    label: "Right pinky column vertical reach",
  },
};

/**
 * Build a SessionOutput for the given drill search. Uses generateSession
 * with targetOverride for presets that have drill library entries (vertical
 * column, inner column, thumb cluster). Falls back to manual text generation
 * for cross-hand bigrams and manual targets (which have no library entry).
 *
 * generateDrill is kept for manual-target and cross-hand-bigram paths;
 * do not delete it from drillGenerator.ts.
 */
function buildSessionOutput(
  corpus: Corpus,
  search: DrillSearch,
  layout: KeyboardType,
  phase: TransitionPhase,
): SessionOutput | null {
  // Manual target — single char or bigram
  if (search.target) {
    const t = search.target;
    const target: SessionTarget = {
      type: t.length === 1 ? "character" : "bigram",
      value: t,
      keys: t.split(""),
      label: t.toUpperCase(),
    };
    const exercise = generateDrill({ corpus, target: t });
    const briefing = buildBriefing(target, DRILL_JOURNEY, phase);
    return { target, exercise, briefing, estimatedSeconds: 45 };
  }

  const preset = search.preset;
  if (!preset) return null;

  // Vertical column — use generateSession with targetOverride
  const vertCol = VERTICAL_COLUMN_MAP[preset];
  if (vertCol) {
    const target: SessionTarget = {
      type: "vertical-column",
      value: vertCol.value,
      keys: vertCol.keys,
      label: vertCol.label,
    };
    return generateSession({
      stats: { characters: [], bigrams: [] },
      baseline: {
        meanErrorRate: 0,
        meanKeystrokeTime: 300,
        meanHesitationRate: 0,
        journey: DRILL_JOURNEY,
      },
      phase,
      corpus,
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
      targetOverride: target,
    });
  }

  if (preset === "innerColumn") {
    // Use inner-left (B, G, T) — left-hand inner column
    const target: SessionTarget = {
      type: "inner-column",
      value: "inner-left",
      keys: ["b", "g", "t"],
      label: "Inner-column reach — B, G, T (left)",
    };
    return generateSession({
      stats: { characters: [], bigrams: [] },
      baseline: {
        meanErrorRate: 0,
        meanKeystrokeTime: 300,
        meanHesitationRate: 0,
        journey: DRILL_JOURNEY,
      },
      phase,
      corpus,
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
      targetOverride: target,
    });
  }

  if (preset === "thumbCluster") {
    const target: SessionTarget = {
      type: "thumb-cluster",
      value: "space",
      keys: [" "],
      label: "Thumb cluster — space activation",
    };
    return generateSession({
      stats: { characters: [], bigrams: [] },
      baseline: {
        meanErrorRate: 0,
        meanKeystrokeTime: 300,
        meanHesitationRate: 0,
        journey: DRILL_JOURNEY,
      },
      phase,
      corpus,
      drillLibrary: DRILL_LIBRARY,
      frequencyInLanguage: () => 0.5,
      targetOverride: target,
    });
  }

  if (preset === "crossHandBigram") {
    // No drill library entry — generate text and build output manually
    const target: SessionTarget = {
      type: "cross-hand-bigram",
      value: "mixed",
      keys: [],
      label: "Cross-hand transitions",
    };
    const exercise = generateCrossHandBigramDrill({ corpus, layout });
    const briefing = buildBriefing(target, DRILL_JOURNEY, phase);
    return { target, exercise, briefing, estimatedSeconds: 60 };
  }

  return null;
}

/**
 * Legacy drill-build helper used only by the same-day compact briefing
 * storage key derivation and the "run again" action. Re-exported for
 * the test harness.
 */
type DrillBuild = {
  text: string;
  label: string;
  targetChars: string[];
};

function buildDrill(corpus: Corpus, search: DrillSearch, layout: KeyboardType): DrillBuild | null {
  if (search.target) {
    const t = search.target;
    return {
      text: generateDrill({ corpus, target: t }),
      label: t.toUpperCase(),
      targetChars: t.split(""),
    };
  }
  if (search.preset === "innerColumn") {
    return {
      text: "",
      label: "Inner column",
      targetChars: [...INNER_COLUMN_CHARS],
    };
  }
  if (search.preset === "thumbCluster") {
    return {
      text: generateThumbClusterDrill({ corpus }),
      label: "Thumb cluster",
      targetChars: "abcdefghijklmnopqrstuvwxyz".split(""),
    };
  }
  if (search.preset === "crossHandBigram") {
    const text = generateCrossHandBigramDrill({ corpus, layout });
    return {
      text,
      label: "Cross-hand bigrams",
      targetChars: Array.from(
        new Set(
          text
            .toLowerCase()
            .replace(/[^a-z]/g, "")
            .split(""),
        ),
      ),
    };
  }
  if (search.preset) {
    const col = VERTICAL_COLUMN_MAP[search.preset];
    if (col) {
      return {
        text: "",
        label: col.label,
        targetChars: col.keys,
      };
    }
  }
  return null;
}

/**
 * Same-day compact briefing storage key.
 * Set before starting; read on briefing display to decide full vs compact.
 */
function briefingSeenKey(targetType: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `adr003-briefing-seen:${targetType}:${today}`;
}

function DrillPage() {
  const { profile } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const status = useSessionStore((s) => s.status);
  const corpus = useCorpus();

  const [paused, setPaused] = useState(false);
  const [pauseSettings, setPauseSettings] = useState<PauseSettings>(DEFAULT_PAUSE_SETTINGS);

  // ADR-003 §4 — briefing state machine (Gap 3).
  // generateSession result held here until the user confirms start.
  const [pendingSession, setPendingSession] = useState<SessionOutput | null>(null);

  // The SessionTarget for the active (or just-completed) session.
  const currentSessionTargetRef = useRef<SessionTarget | null>(null);

  // Wall-clock timestamp when the briefing was shown — for persistSessionWithRetry.
  const briefingShownAtRef = useRef<Date | null>(null);

  // Snapshot of the URL search params at the moment the briefing was first
  // staged. The URL effect clears the live `search` after consuming params
  // (so re-arrival via in-app nav lands on the picker, not on a duplicated
  // briefing). But "Run again" from the post-session view still needs the
  // original params to rebuild a fresh exercise — without this ref, it
  // would call `buildSessionOutput(corpus, {}, …)` and return null.
  const drillSourceRef = useRef<DrillSearch | null>(null);

  // Capture the drill label + target char set at the moment the drill is built.
  const [activeDrill, setActiveDrill] = useState<{
    label: string;
    targetChars: string[];
    target: string;
    sessionTarget: SessionTarget | null;
  } | null>(null);

  const hasRouteDrill = Boolean(search.target || search.preset);

  const startFromPending = (output: SessionOutput) => {
    if (!output.exercise) return;
    const compact =
      typeof window !== "undefined"
        ? Boolean(window.sessionStorage.getItem(briefingSeenKey(output.target.type)))
        : false;
    if (!compact) {
      try {
        window.sessionStorage.setItem(briefingSeenKey(output.target.type), "1");
      } catch {
        // sessionStorage unavailable — proceed without tracking
      }
    }
    currentSessionTargetRef.current = output.target;
    briefingShownAtRef.current = new Date();
    // targetChars drives the before/after drill delta. For motion targets
    // the keys list is the target set; for char/bigram it is the same.
    // Cross-hand-bigram has empty keys — fall back to all alpha chars
    // so the before/after card still shows something meaningful.
    const targetChars =
      output.target.keys.length > 0 ? output.target.keys : "abcdefghijklmnopqrstuvwxyz".split("");
    setActiveDrill({
      label: output.target.label,
      targetChars,
      target: output.exercise,
      sessionTarget: output.target,
    });
    sessionStore.getState().dispatch({
      type: "start",
      target: output.exercise,
      now: performance.now(),
      targetKeys: output.target.keys,
    });
    setPendingSession(null);
  };

  // Auto-start a drill whenever the URL carries target/preset and we are idle.
  // The URL params are consumed once: as soon as the briefing is staged we
  // also `navigate({ search: {} }, replace)` to clear them. This makes the
  // briefing a one-shot — if the user navigates away and back via in-app
  // nav, the URL no longer carries the drill key and the picker shows
  // (matching the `?autostart=1` consume pattern in /practice). Without
  // this, browser-back to a stale `/practice/drill?target=…` URL would
  // silently re-create the briefing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: corpus.corpus and pendingSession are read inside as snapshots, not trigger conditions; including them would refire on corpus shape changes or post-creation pendingSession flip, neither of which should re-stage briefing.
  useEffect(() => {
    if (!hasRouteDrill) return;
    if (corpus.status !== "ready") return;
    if (status !== "idle") return;
    if (pendingSession !== null) return;
    const output = buildSessionOutput(
      corpus.corpus,
      search,
      profile.keyboardType,
      profile.transitionPhase,
    );
    if (output) {
      briefingShownAtRef.current = new Date();
      drillSourceRef.current = search;
      setPendingSession(output);
      void navigate({ to: "/practice/drill", search: {}, replace: true });
    }
  }, [
    hasRouteDrill,
    corpus.status,
    status,
    search,
    profile.keyboardType,
    profile.transitionPhase,
    navigate,
  ]);

  // Escape toggles the pause overlay.
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

  useIdleAutoPause(status === "active" || status === "paused");

  const sessionInFlight = status === "active" || status === "paused";
  useBeforeUnloadWarning(sessionInFlight);
  const otherTabActive = useOtherTabActive(sessionInFlight);

  // Auto-cancel briefing on browser-tab switch — see practice.tsx.
  useEffect(() => {
    if (pendingSession === null) return;
    const onVis = () => {
      if (document.hidden) {
        setPendingSession(null);
        void navigate({ to: "/practice/drill", search: {} });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [pendingSession, navigate]);

  // Reset to picker whenever the user (re)arrives at /practice/drill from
  // another in-app route. Same intent as the /practice reset: every fresh
  // arrival is a clean slate. The URL effect above consumes target/preset
  // params on first arrival (replace+empty search), so a re-arrival has a
  // clean URL and naturally lands on the picker; this effect additionally
  // clears any session/briefing state that survived the remount via the
  // singleton session store or React preservation.
  //
  // Deps are intentionally narrowed to [drillPathname]: hasRouteDrill is
  // derived from search params and changes within-route (URL effect clears
  // it after staging a briefing). Including it would cause this effect to
  // refire and wipe the briefing the user just kicked off — see the bug
  // where clicking a vertical-reach preset appeared to do nothing.
  const drillPathname = useRouterState({ select: (s) => s.location.pathname });
  // biome-ignore lint/correctness/useExhaustiveDependencies: hasRouteDrill is read as a snapshot inside the effect; including it in deps causes a refire-then-clobber race with the URL effect's setPendingSession + URL clear.
  useEffect(() => {
    if (drillPathname !== "/practice/drill") return;
    // Unconditional cleanups on route arrival: paused flag and any stale
    // session-store status from a prior route. These are scrubbed
    // regardless of URL params, otherwise a `status: "complete"` carried
    // over from a /practice post-session view would block the URL effect's
    // `status === "idle"` guard and the user would get stuck on
    // "Building drill…".
    setPaused(false);
    const state = sessionStore.getState();
    if (state.status !== "idle") {
      state.dispatch({ type: "reset" });
    }
    // pendingSession only resets when the URL has no drill params; if
    // hasRouteDrill is true, the URL effect owns the briefing creation
    // and clearing pendingSession here would race against it.
    if (!hasRouteDrill) {
      setPendingSession(null);
      drillSourceRef.current = null;
    }
  }, [drillPathname]);

  useEffect(() => {
    void flushSessionQueue();
  }, []);

  // Tab → restart current drill exercise. Mirrors the adaptive route's
  // Tab handler. Only bound while the session is live and the pause
  // overlay is closed; when the overlay is open, native Tab focus-walking
  // owns the key. Inlines the dispatch (rather than calling
  // restartSameExercise) to keep the deps array clean.
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
        targetKeys: currentSessionTargetRef.current?.keys ?? [],
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, paused]);

  // Post-session keyboard shortcuts — mirrors the adaptive route's
  // post-session handler for parity (j/k/gg/G scrolls + ⌘D dashboard +
  // Enter run-again). Gated on `pendingSession === null` so the listener
  // cleans up when the briefing renders (status still "complete" while
  // pendingSession is staged).
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
        runAgainRef.current();
        return;
      }

      // P → "Move to adaptive practice" — matches the shortcut hint
      // shown in DrillPostSessionStage's secondary CTA. Use e.code so
      // the binding works regardless of layout/shift state.
      if (e.code === "KeyP") {
        e.preventDefault();
        moveToAdaptiveRef.current();
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
      if (e.key === "j") {
        e.preventDefault();
        window.scrollBy({ top: step, behavior: "smooth" });
        return;
      }
      if (e.key === "k") {
        e.preventDefault();
        window.scrollBy({ top: -step, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
    // runAgainRef is a stable ref — no need to list it.
  }, [status, pendingSession, navigate]);

  // Session persistence on complete.
  const lastPersistedAt = useRef<number | null>(null);
  useEffect(() => {
    if (status !== "complete") return;
    if (!activeDrill) return;
    const state = sessionStore.getState();
    if (state.events.length === 0) return;
    if (state.completedAt === null) return;
    if (lastPersistedAt.current === state.completedAt) return;
    lastPersistedAt.current = state.completedAt;

    const elapsedMs =
      state.startedAt !== null ? Math.max(0, state.completedAt - state.startedAt) : 0;
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - elapsedMs);

    const filterConfig: Record<string, unknown> = search.target
      ? { drillTarget: search.target }
      : search.preset
        ? { drillPreset: search.preset }
        : {};

    const st = currentSessionTargetRef.current;
    void persistSessionWithRetry({
      sessionId: crypto.randomUUID(),
      keyboardProfileId: profile.id,
      mode: "targeted_drill",
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
      filterConfig,
      ...(st !== null
        ? {
            sessionTarget: {
              type: st.type,
              value: st.value,
              keys: st.keys,
              label: st.label,
              selectionScore: null,
              declaredAt: briefingShownAtRef.current?.toISOString() ?? new Date().toISOString(),
              attempts: state.targetAttempts,
              errors: state.targetErrors,
              accuracy:
                state.targetAttempts > 0 ? 1 - state.targetErrors / state.targetAttempts : null,
            },
          }
        : {}),
    }).finally(() => {
      // Refresh the route loader so the next adaptive-target pick
      // reads updated character_stats / bigram_stats instead of the
      // snapshot from page mount. Symmetric with /practice.
      void router.invalidate();
    });
  }, [status, activeDrill, profile.id, profile.transitionPhase, search, router]);

  const runAgain = () => {
    if (corpus.status !== "ready") return;
    // Read from the source-snapshot ref, not the live `search` — the URL
    // effect clears search after consuming, so a post-session "Run again"
    // sees an empty search if it reads it directly.
    const source = drillSourceRef.current ?? search;
    const output = buildSessionOutput(
      corpus.corpus,
      source,
      profile.keyboardType,
      profile.transitionPhase,
    );
    if (output) {
      briefingShownAtRef.current = new Date();
      setPendingSession(output);
    }
    setPaused(false);
  };

  // Stable ref so the post-session keydown effect doesn't have to re-bind
  // every render (runAgain closes over corpus/search/profile).
  const runAgainRef = useRef(runAgain);
  runAgainRef.current = runAgain;

  const moveToAdaptive = () => {
    sessionStore.getState().dispatch({ type: "reset" });
    navigate({ to: "/practice" });
  };

  // Stable ref for the P shortcut so the post-session keydown effect
  // doesn't have to re-bind every render (moveToAdaptive closes over
  // navigate). Mirrors runAgainRef.
  const moveToAdaptiveRef = useRef(moveToAdaptive);
  moveToAdaptiveRef.current = moveToAdaptive;

  const restartSameExercise = () => {
    if (!activeDrill) return;
    sessionStore.getState().dispatch({
      type: "start",
      target: activeDrill.target,
      now: performance.now(),
      targetKeys: currentSessionTargetRef.current?.keys ?? [],
    });
    setPaused(false);
  };

  const endDrill = () => {
    sessionStore.getState().dispatch({ type: "reset" });
    setPaused(false);
  };

  // Per-key breakdown for the post-session summary.
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
      const entry = acc[ev.targetChar] ?? { attempts: 0, errors: 0 };
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

  // --- render branches -------------------------------------------------------

  if (status === "active" || status === "paused") {
    const idleAutoPaused = status === "paused" && !paused;
    return (
      <main
        id="main-content"
        className="kerf-practice-main kerf-practice-main--active kerf-stage-fade-in"
      >
        {activeDrill && (
          <TargetRibbon
            label={activeDrill.label}
            keys={activeDrill.sessionTarget?.keys ?? activeDrill.targetChars}
          />
        )}
        <ActiveSessionStage
          keyboardType={profile.keyboardType}
          showKeyboard={pauseSettings.showKeyboard}
          expectedLetterHint={pauseSettings.expectedLetterHint}
          capture={!paused}
          typingSize={pauseSettings.typingSize}
          targetKeys={
            pauseSettings.focusedKeyHint
              ? (activeDrill?.sessionTarget?.keys ?? undefined)
              : undefined
          }
        />
        {idleAutoPaused && <DrillIdlePauseChip />}
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
            onEnd={endDrill}
          />
        )}
      </main>
    );
  }

  // Briefing stage — pending session waiting for user to confirm start.
  // Checked before the `complete` branch so "Run again" from the drill
  // post-session page (which sets `pendingSession` without resetting the
  // store's `status`) transitions into the briefing instead of re-rendering
  // the same DrillPostSessionStage.
  if (pendingSession !== null) {
    return (
      <>
        <main id="main-content" className="kerf-practice-main">
          <div className="kerf-practice-container kerf-stage-fade-in">
            <SessionBriefing
              target={pendingSession.target}
              briefingText={pendingSession.briefing.text}
              onStart={() => startFromPending(pendingSession)}
              onBack={() => {
                // Drill briefing is driven by URL params (?target=… or
                // ?preset=…), so we have to clear both the local pending
                // session AND the URL — otherwise the URL-watching effect
                // would just regenerate the briefing on the next render.
                setPendingSession(null);
                void navigate({ to: "/practice/drill", search: {} });
              }}
            />
          </div>
        </main>
        <AppFooter />
      </>
    );
  }

  if (status === "complete" && activeDrill) {
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
    const drillDelta = summarizeDrill({
      events: state.events,
      targetChars: activeDrill.targetChars,
    });
    return (
      <>
        <main id="main-content" className="kerf-practice-main">
          <div className="kerf-practice-container kerf-stage-fade-in">
            <DrillPostSessionStage
              drillLabel={activeDrill.label}
              target={state.target}
              summary={summary}
              drillDelta={drillDelta}
              onRunAgain={runAgain}
              onMoveToAdaptive={moveToAdaptive}
              sessionTarget={activeDrill.sessionTarget ?? undefined}
              perKeyBreakdown={perKeyBreakdown}
            />
          </div>
        </main>
        <AppFooter />
      </>
    );
  }

  // Idle: either route has no drill params → show picker, or we are
  // waiting for the corpus load before showing briefing.
  const showPicker = !hasRouteDrill;
  return (
    <>
      <main id="main-content" className="kerf-practice-main">
        <div className="kerf-practice-container kerf-stage-fade-in">
          {showPicker ? (
            <DrillPreSessionStage
              keyboardType={profile.keyboardType}
              dominantHand={profile.dominantHand}
              phase={profile.transitionPhase}
              onSelectTarget={(target) => navigate({ to: "/practice/drill", search: { target } })}
              onSelectPreset={(preset) => navigate({ to: "/practice/drill", search: { preset } })}
            />
          ) : (
            <p className="kerf-drill-loading" aria-live="polite">
              Building drill…
            </p>
          )}
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
      {showPicker && <AppFooter />}
    </>
  );
}

/**
 * Idle-pause visual chip — same shape as the one in /practice.
 * Kept route-local rather than shared: it's a thin status element and
 * sharing would require a component folder entry for two callers only.
 */
function DrillIdlePauseChip() {
  return (
    <div className="kerf-idle-pause-chip" role="status" aria-live="polite">
      <span className="kerf-idle-pause-chip-dot" aria-hidden="true" />
      paused · type to resume
    </div>
  );
}

// Re-export for the test harness and future imports.
export { buildDrill };
