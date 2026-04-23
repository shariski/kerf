import type { Corpus } from "../corpus/types";
import type { ComputedStats, TransitionPhase, UserBaseline } from "../stats/types";
import { buildBriefing, type Briefing } from "./briefingTemplates";
import type { DrillLibraryEntry } from "./drillLibrary";
import { lookupDrill } from "./drillLibrary";
import { generateExercise, type ExerciseOptions } from "./exerciseGenerator";
import { selectTarget, type SessionTarget } from "./targetSelection";

export type SessionOutput = {
  target: SessionTarget;
  /** String the user types. Word sequence for character/bigram targets;
   * curated key sequence for motion targets. Session reducer treats both
   * uniformly (target string + word boundaries). */
  exercise: string;
  briefing: Briefing;
  estimatedSeconds: number;
};

export type GenerateSessionInput = {
  stats: ComputedStats;
  baseline: UserBaseline;
  phase: TransitionPhase;
  corpus: Corpus;
  drillLibrary: DrillLibraryEntry[];
  frequencyInLanguage: (unit: string) => number;
  /** Drill-mode override. When present, skips selectTarget. */
  targetOverride?: SessionTarget;
  /** Optional override for the word-picker. */
  exerciseOptions?: Partial<ExerciseOptions>;
};

const DEFAULT_WORD_COUNT = 50;

function estimate(target: SessionTarget, wordCount: number): number {
  if (target.type === "diagnostic") return 90;
  if (target.type === "thumb-cluster") return 45;
  if (target.type === "vertical-column" || target.type === "inner-column") return 45;
  return Math.max(30, Math.min(120, wordCount * 2));
}

export function generateSession(input: GenerateSessionInput): SessionOutput {
  const target =
    input.targetOverride ??
    selectTarget(input.stats, input.baseline, input.phase, input.frequencyInLanguage);

  let exerciseString: string;
  let estimatedSeconds: number;

  if (target.type === "diagnostic") {
    const words = generateExercise({
      corpus: input.corpus,
      weaknessScoreFor: () => 1, // uniform weight
      targetWordCount: DEFAULT_WORD_COUNT,
      ...input.exerciseOptions,
    });
    exerciseString = words.join(" ");
    estimatedSeconds = estimate(target, DEFAULT_WORD_COUNT);
  } else if (target.type === "character" || target.type === "bigram") {
    const words = generateExercise({
      corpus: input.corpus,
      weaknessScoreFor: (unitId) => (unitId === target.value ? 10 : 0.5),
      targetWordCount: DEFAULT_WORD_COUNT,
      ...input.exerciseOptions,
    });
    exerciseString = words.join(" ");
    estimatedSeconds = estimate(target, DEFAULT_WORD_COUNT);
  } else {
    // Motion target: look up curated drill content.
    const drill = lookupDrill(input.drillLibrary, target, input.baseline.journey);
    exerciseString = drill.exercise;
    estimatedSeconds = drill.estimatedSeconds;
  }

  return {
    target,
    exercise: exerciseString,
    briefing: buildBriefing(target, input.baseline.journey, input.phase),
    estimatedSeconds,
  };
}
