import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import {
  getActiveProfile,
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

export const Route = createFileRoute("/practice")({
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
  const { profile } = Route.useLoaderData();
  const status = useSessionStore((s) => s.status);
  const currentTarget = useSessionStore((s) => s.target);
  const corpus = useCorpus();

  const [filters, setFilters] = useState<PreSessionFilterValues>(DEFAULT_FILTERS);
  const [paused, setPaused] = useState(false);
  const [pauseSettings, setPauseSettings] = useState<PauseSettings>(
    DEFAULT_PAUSE_SETTINGS,
  );

  // Keep pre-session "Visual keyboard" toggle and pause-overlay toggle in sync:
  // flipping either updates the same source of truth the active stage reads.
  useEffect(() => {
    setPauseSettings((s) => ({ ...s, showKeyboard: filters.showKeyboard }));
  }, [filters.showKeyboard]);

  const startAdaptive = () => {
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

  if (status === "complete") {
    return (
      <main className="kerf-practice-main">
        <div className="kerf-practice-container kerf-stage-fade-in">
          <PostSessionStage onPracticeAgain={startAdaptive} />
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
