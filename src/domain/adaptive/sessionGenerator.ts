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
  /** Precomputed `bigram → corpus word count` map. When present,
   *  selectTarget excludes zero/low-support bigrams and generateExercise
   *  widens their emphasis pool to component chars (drill-mode path). */
  corpusBigramSupport?: ReadonlyMap<string, number>;
  /** Precomputed `char → corpus word count` map. When present,
   *  selectTarget excludes zero-support characters — fixes the drill-mode
   *  cross-layer leak where non-corpus keys (`;`, `/`) accumulate real
   *  character_stats and then argmax permanently. */
  corpusCharSupport?: ReadonlyMap<string, number>;
  /** 1-indexed number of the session about to be generated (i.e.
   *  `completedSessionCount + 1`). When divisible by
   *  `DIAGNOSTIC_PERIOD`, selectTarget returns a diagnostic target —
   *  this is the "periodic re-baseline" mechanism that widens stats
   *  coverage beyond what the per-session exploration blend can
   *  reach. Omitting the field disables the periodic diagnostic and
   *  leaves selectTarget purely argmax-driven (existing behavior). */
  upcomingSessionNumber?: number;
  /** Target values from the most recent sessions, newest first. Enables
   *  the same-target cooldown in selectTarget — a target value that
   *  has won the last `COOLDOWN_RUN_LENGTH - 1` sessions is excluded,
   *  forcing rotation. Omitting disables cooldown. */
  recentTargets?: readonly string[];
};

const DEFAULT_WORD_COUNT = 50;

/** Fraction of a character/bigram session's words guaranteed to contain
 *  the target unit. Hand-tuned starting value — revisit with beta feedback.
 *  Motion targets (vertical-column, thumb-cluster, inner-column) bypass
 *  this and use curated drillLibrary content instead. */
const TARGET_EMPHASIS_RATIO = 0.4;

/**
 * Strength of the rare-letter bias in the exploration-blend filler.
 *
 * Uniform-per-word sampling over an English corpus still inherits the
 * Zipfian letter distribution — `e`/`t`/`a` appear in >50% of words,
 * `q`/`j`/`z` in <1%. Without this bias, rare letters only surface in
 * filler once every 5-10 sessions, leaving the user with a persistent
 * "narrow letter scope" feeling even at high filler ratios. The bias
 * weights each filler-pool word by the inverse corpus support of its
 * characters, so words containing rare letters compete on an
 * approximately letter-uniform basis rather than a word-uniform one.
 *
 * Formula (inside the per-word closure):
 *   weight = 1 + RARE_LETTER_BOOST × Σ(1 / charSupport(c)) for c in word.chars
 *
 * Calibration at RARE_LETTER_BOOST = 30:
 *   - a word containing `q` (support ≈ 50) gains +0.6 weight from that
 *     letter alone → ~1.6× as likely as a pure-common-letter word;
 *   - a word of only common letters gains ~+0.02 → weight stays near 1.
 *
 * Raise if rare letters still feel scarce; lower if filler starts
 * feeling like "rare-letter ambush" (lots of unusual words). Disabled
 * when `corpusCharSupport` isn't provided — the filler degrades
 * gracefully to uniform-per-word behavior.
 */
const RARE_LETTER_BOOST = 30;

function estimate(target: SessionTarget, wordCount: number): number {
  if (target.type === "diagnostic") return 90;
  if (target.type === "thumb-cluster") return 45;
  if (target.type === "vertical-column" || target.type === "inner-column") return 45;
  return Math.max(30, Math.min(120, wordCount * 2));
}

export function generateSession(input: GenerateSessionInput): SessionOutput {
  const target =
    input.targetOverride ??
    selectTarget(input.stats, input.baseline, input.phase, input.frequencyInLanguage, {
      corpusBigramSupport: input.corpusBigramSupport,
      corpusCharSupport: input.corpusCharSupport,
      upcomingSessionNumber: input.upcomingSessionNumber,
      recentTargets: input.recentTargets,
    });

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
    // Capture in a local so the closure below keeps TypeScript's narrowing.
    const charSupport = input.corpusCharSupport;
    const words = generateExercise({
      corpus: input.corpus,
      weaknessScoreFor: (unitId) => (unitId === target.value ? 10 : 0.5),
      targetWordCount: DEFAULT_WORD_COUNT,
      mustContainUnit: target.value,
      mustContainMinRatio: TARGET_EMPHASIS_RATIO,
      corpusBigramSupport: input.corpusBigramSupport,
      // Exploration blend — filler slots (1 − TARGET_EMPHASIS_RATIO
      // of the session) are sampled per corpus word, biased toward
      // words containing corpus-rare letters (see RARE_LETTER_BOOST
      // doc above). Pairs with the every-DIAGNOSTIC_PERIOD-sessions
      // diagnostic and the same-target cooldown as the three halves of
      // the broader exploration mechanism. Degrades to uniform-per-
      // word when charSupport is unavailable.
      fillerWeightFor: charSupport
        ? (word) => {
            let rareBoost = 0;
            for (const c of word.chars) {
              rareBoost += 1 / (charSupport.get(c) ?? 1);
            }
            return 1 + RARE_LETTER_BOOST * rareBoost;
          }
        : () => 1,
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
