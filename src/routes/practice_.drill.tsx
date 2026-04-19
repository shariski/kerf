import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import {
  getActiveProfile,
  type KeyboardType,
  type DominantHand,
} from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import {
  ActiveSessionStage,
  PauseOverlay,
  DrillPreSessionStage,
  DrillActiveHeader,
  DrillPostSessionStage,
  type PauseSettings,
  type PresetKey,
} from "#/components/practice";
import { useSessionStore, sessionStore } from "#/stores/sessionStore";
import { useCorpus } from "#/hooks/useCorpus";
import {
  INNER_COLUMN_CHARS,
  generateCrossHandBigramDrill,
  generateDrill,
  generateInnerColumnDrill,
  generateThumbClusterDrill,
} from "#/domain/adaptive/drillGenerator";
import { summarizeSession } from "#/domain/session/summarize";
import { summarizeDrill } from "#/domain/session/drillSummary";
import { persistSession } from "#/server/persistSession";
import type { Corpus } from "#/domain/corpus/types";

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
  component: DrillPage,
});

const DEFAULT_PAUSE_SETTINGS: PauseSettings = {
  typingSize: "M",
  showKeyboard: true,
  expectedLetterHint: true,
};

type DrillBuild = {
  /** The drill string that becomes the typing target. */
  text: string;
  /** Display label for the header strip, e.g. "B", "er", "Inner column". */
  label: string;
  /** Which characters count as drill-target keystrokes for before/after. */
  targetChars: string[];
};

function buildDrill(
  corpus: Corpus,
  search: DrillSearch,
  layout: KeyboardType,
): DrillBuild | null {
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
      text: generateInnerColumnDrill({ corpus }),
      label: "Inner column",
      targetChars: [...INNER_COLUMN_CHARS],
    };
  }
  if (search.preset === "thumbCluster") {
    return {
      text: generateThumbClusterDrill({ corpus }),
      label: "Thumb cluster",
      // Thumb-cluster drill uses short words with no single target set.
      // Comparing overall letter accuracy is the honest proxy.
      targetChars: "abcdefghijklmnopqrstuvwxyz".split(""),
    };
  }
  if (search.preset === "crossHandBigram") {
    const text = generateCrossHandBigramDrill({ corpus, layout });
    return {
      text,
      label: "Cross-hand bigrams",
      // Unique chars in the generated drill — approximates the bigram
      // chars the user actually saw this run.
      targetChars: Array.from(
        new Set(text.toLowerCase().replace(/[^a-z]/g, "").split("")),
      ),
    };
  }
  return null;
}

function DrillPage() {
  const { profile } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const status = useSessionStore((s) => s.status);
  const corpus = useCorpus();

  const [paused, setPaused] = useState(false);
  const [pauseSettings, setPauseSettings] = useState<PauseSettings>(
    DEFAULT_PAUSE_SETTINGS,
  );

  // Capture the drill label + target char set at the moment the
  // drill is built so the post-session summary can reference them
  // even after the URL has changed (e.g. Run Again navigating to /).
  const [activeDrill, setActiveDrill] = useState<{
    label: string;
    targetChars: string[];
    target: string;
  } | null>(null);

  const hasRouteDrill = Boolean(search.target || search.preset);

  const startDrill = (build: DrillBuild) => {
    if (!build.text) return;
    setActiveDrill({
      label: build.label,
      targetChars: build.targetChars,
      target: build.text,
    });
    sessionStore
      .getState()
      .dispatch({ type: "start", target: build.text, now: performance.now() });
  };

  // Auto-start a drill whenever the URL carries target/preset and we
  // are idle. Re-fires if the user navigates back to a drill URL after
  // resetting the store.
  useEffect(() => {
    if (!hasRouteDrill) return;
    if (corpus.status !== "ready") return;
    if (status !== "idle") return;
    const build = buildDrill(corpus.corpus, search, profile.keyboardType);
    if (build) startDrill(build);
  }, [hasRouteDrill, corpus.status, status, search, profile.keyboardType]);

  // Escape toggles pause during active drill (mirrors /practice).
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

  // Enter on the complete screen runs the drill again.
  useEffect(() => {
    if (status !== "complete") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      runAgain();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire-and-forget session persistence (Task 2.8). Same dedup pattern
  // as /practice — completedAt identifies each distinct finish.
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

    // Capture which kind of drill this was so Phase 3 can group runs
    // by preset or by manual target.
    const filterConfig: Record<string, unknown> = search.target
      ? { drillTarget: search.target }
      : search.preset
        ? { drillPreset: search.preset }
        : {};

    persistSession({
      data: {
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
      },
    }).catch((err) => {
      console.error("persistSession failed:", err);
    });
  }, [status, activeDrill, profile.id, profile.transitionPhase, search]);

  const runAgain = () => {
    if (!activeDrill || corpus.status !== "ready") return;
    const build = buildDrill(corpus.corpus, search, profile.keyboardType);
    if (build) startDrill(build);
    setPaused(false);
  };

  const moveToAdaptive = () => {
    sessionStore.getState().dispatch({ type: "reset" });
    navigate({ to: "/practice" });
  };

  const restartSameExercise = () => {
    if (!activeDrill) return;
    sessionStore
      .getState()
      .dispatch({ type: "start", target: activeDrill.target, now: performance.now() });
    setPaused(false);
  };

  const endDrill = () => {
    sessionStore.getState().dispatch({ type: "reset" });
    setPaused(false);
  };

  // --- render branches ------------------------------------------------------

  if (status === "complete" && activeDrill) {
    const state = sessionStore.getState();
    const summary = summarizeSession({
      target: state.target,
      events: state.events,
      keyboardType: profile.keyboardType,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      phase: profile.transitionPhase,
    });
    const drillDelta = summarizeDrill({
      events: state.events,
      targetChars: activeDrill.targetChars,
    });
    return (
      <main className="kerf-practice-main">
        <div className="kerf-practice-container kerf-stage-fade-in">
          <DrillPostSessionStage
            drillLabel={activeDrill.label}
            target={state.target}
            summary={summary}
            drillDelta={drillDelta}
            onRunAgain={runAgain}
            onMoveToAdaptive={moveToAdaptive}
          />
        </div>
      </main>
    );
  }

  if (status === "active") {
    return (
      <main className="kerf-practice-main kerf-practice-main--active kerf-stage-fade-in">
        {activeDrill && <DrillActiveHeader label={activeDrill.label} />}
        <ActiveSessionStage
          keyboardType={profile.keyboardType}
          showKeyboard={pauseSettings.showKeyboard}
          expectedLetterHint={pauseSettings.expectedLetterHint}
          capture={!paused}
          typingSize={pauseSettings.typingSize}
        />
        {paused && (
          <PauseOverlay
            settings={pauseSettings}
            onSettingsChange={setPauseSettings}
            onResume={() => setPaused(false)}
            onRestart={restartSameExercise}
            onEnd={endDrill}
          />
        )}
      </main>
    );
  }

  // Idle: either route has no drill params → show picker, or we are
  // waiting for the corpus load before auto-starting.
  const showPicker = !hasRouteDrill;
  return (
    <main className="kerf-practice-main">
      <div className="kerf-practice-container kerf-stage-fade-in">
        {showPicker ? (
          <DrillPreSessionStage
            keyboardType={profile.keyboardType}
            dominantHand={profile.dominantHand}
            phase={profile.transitionPhase}
            onSelectTarget={(target) =>
              navigate({ to: "/practice/drill", search: { target } })
            }
            onSelectPreset={(preset) =>
              navigate({ to: "/practice/drill", search: { preset } })
            }
          />
        ) : (
          <p className="kerf-drill-loading" aria-live="polite">
            Building drill…
          </p>
        )}
        {corpus.status === "error" && (
          <p className="kerf-corpus-error" role="alert" aria-live="polite">
            Could not load the word list. Refresh the page to try again.
          </p>
        )}
      </div>
    </main>
  );
}

// Re-export for the test harness and future imports.
export { buildDrill };
