/**
 * Stats domain — shapes used by computeStats, decayStats, computeBaseline.
 *
 * TransitionPhase lives here for now; will move to a shared domain types
 * module when the adaptive engine (Task 1.3) also needs it.
 */

export type TransitionPhase = "transitioning" | "refining";

export type KeystrokeEvent = {
  /** The character the user was supposed to type. */
  targetChar: string;
  /** What the user actually typed. Equal to targetChar when correct. */
  actualChar: string;
  /** True iff actualChar !== targetChar. Stored explicitly to avoid
   * recomputing in hot loops. */
  isError: boolean;
  /** Time in ms from the previous keystroke to this one. */
  keystrokeMs: number;
  /** Previous targetChar in the same word/exercise; undefined for the
   * first keystroke of a session or first keystroke after a word break. */
  prevChar?: string;
  /** Wall-clock time the keystroke occurred. Used by decayStats. */
  timestamp: Date;
};

/** Aggregated per-character stats — see 02-architecture.md §schema. */
export type CharacterStat = {
  character: string;
  attempts: number;
  errors: number;
  /** Sum of keystrokeMs across attempts. */
  sumTime: number;
  /** Count of attempts whose keystrokeMs exceeded the hesitation
   * threshold passed to computeStats. */
  hesitationCount: number;
};

/** Aggregated per-bigram stats. No hesitationCount per the SQL schema
 * in 02-architecture.md §schema. */
export type BigramStat = {
  bigram: string;
  attempts: number;
  errors: number;
  sumTime: number;
};

export type ComputedStats = {
  characters: CharacterStat[];
  bigrams: BigramStat[];
};

/** Baseline used to normalize the weakness score (02-architecture.md §4.1). */
export type UserBaseline = {
  /** 0..1 — fraction of attempts that are errors. */
  meanErrorRate: number;
  /** ms — mean keystroke time. */
  meanKeystrokeTime: number;
  /** 0..1 — fraction of attempts flagged as hesitations. */
  meanHesitationRate: number;
};

/** A KeystrokeEvent annotated with a decay weight in [0, 1]. Produced by
 * decayStats; consumed by computeStats when weighted aggregation is
 * needed (e.g. mixing recent and historical events). */
export type WeightedKeystrokeEvent = KeystrokeEvent & { weight: number };
