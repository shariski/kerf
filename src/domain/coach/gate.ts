import type { FingerTable } from "#/domain/finger/types";
import { profileText, type TransitionProfile } from "./triggerDensity";
import type { MechanismKey } from "./mechanisms";

export const BASELINE_PROFILE: TransitionProfile = {
  sameFinger: 0.216,
  rowCross: 0.345,
  crossHand: 0.439,
  nTransitions: 0,
  wordsEndingEst: 0.36,
  vowelInitialWords: 0.177,
  avgWordLen: 4.8,
  nWords: 0,
};

const META_WORDS = new Set([
  "sequence",
  "bigram",
  "transition",
  "finger",
  "typing",
  "practice",
  "drill",
  "pattern",
  "rhythm",
  "mistake",
  "error",
  "letter",
  "exercise",
  "keyboard",
  "keystroke",
]);

export type GateResult = {
  passed: boolean;
  mechanism: MechanismKey;
  measured: TransitionProfile;
  violations: string[];
};

/** Accepted passage length, in words. Overridable per-deployment. */
export type WordRange = { min: number; max: number };
export const DEFAULT_WORD_RANGE: WordRange = { min: 120, max: 350 };

export function evaluateGate(
  mechanism: MechanismKey,
  text: string,
  fingerTable: FingerTable,
  baseline: TransitionProfile = BASELINE_PROFILE,
  wordRange: WordRange = DEFAULT_WORD_RANGE,
): GateResult {
  const measured = profileText(text, fingerTable);
  const violations: string[] = [];

  if (measured.nWords < wordRange.min || measured.nWords > wordRange.max) {
    violations.push(
      `length: ${measured.nWords} words (need ${wordRange.min}-${wordRange.max})`,
    );
  }

  const paragraphs = (text.match(/\n\n/g)?.length ?? 0) + 1;
  if (paragraphs < 1 || paragraphs > 3) {
    violations.push(`paragraphs: ${paragraphs} (need 1-3)`);
  }

  const metaFound = [...META_WORDS].filter((w) => text.toLowerCase().split(/\b/).includes(w));
  if (metaFound.length > 0) {
    violations.push(`meta words: ${metaFound.join(", ")}`);
  }

  const thresholds: Partial<Record<MechanismKey, (m: TransitionProfile) => boolean>> = {
    "cross-hand": (m) => m.crossHand >= baseline.crossHand * 1.2,
    "row-cross": (m) => m.rowCross >= baseline.rowCross * 1.1,
    "same-finger": (m) => m.sameFinger >= baseline.sameFinger * 0.9,
    "space/timing": (m) => m.vowelInitialWords >= baseline.vowelInitialWords * 1.5,
  };
  const KNOWN: ReadonlySet<MechanismKey> = new Set([
    "space/timing",
    "same-finger",
    "adjacent-finger",
    "row-cross",
    "cross-hand",
    "non-alpha",
  ]);
  if (!KNOWN.has(mechanism)) {
    violations.push(`saturation: unknown mechanism "${mechanism}"`);
  } else {
    const check = thresholds[mechanism];
    if (check && !check(measured)) {
      violations.push(`saturation: ${mechanism} below threshold`);
    }
  }

  return { passed: violations.length === 0, mechanism, measured, violations };
}

/**
 * The exact minimum rates the gate enforces for a mechanism, rounded UP to
 * 3 decimals so that meeting an injected target guarantees passing the
 * gate. Single source of truth shared with the LLM generation prompt.
 * Returns null for mechanisms with no density requirement.
 */
export function gateTargetsFor(
  mechanism: MechanismKey,
  baseline: TransitionProfile = BASELINE_PROFILE,
): Record<string, number> | null {
  const ceil3 = (x: number) => Math.ceil(x * 1000) / 1000;
  switch (mechanism) {
    case "cross-hand":
      return { cross_hand_rate: ceil3(baseline.crossHand * 1.2) };
    case "row-cross":
      return { row_cross_rate: ceil3(baseline.rowCross * 1.1) };
    case "same-finger":
      return { same_finger_rate: ceil3(baseline.sameFinger * 0.9) };
    case "space/timing":
      return { vowel_initial_words: ceil3(baseline.vowelInitialWords * 1.5) };
    default:
      return null;
  }
}
