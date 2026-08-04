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
  "sequence", "bigram", "transition", "finger", "typing", "practice", "drill",
  "pattern", "rhythm", "mistake", "error", "letter", "exercise", "keyboard", "keystroke",
]);

export type GateResult = {
  passed: boolean;
  mechanism: MechanismKey;
  measured: TransitionProfile;
  violations: string[];
};

export function evaluateGate(
  mechanism: MechanismKey,
  text: string,
  fingerTable: FingerTable,
  baseline: TransitionProfile = BASELINE_PROFILE,
): GateResult {
  const measured = profileText(text, fingerTable);
  const violations: string[] = [];

  if (measured.nWords < 120 || measured.nWords > 350) {
    violations.push(`length: ${measured.nWords} words (need 120-350)`);
  }

  const paragraphs = Math.min(
    (text.match(/\n\n/g)?.length ?? 0) + (text.includes("\n") ? 1 : 0) + 1,
    3,
  );
  if (paragraphs < 1 || paragraphs > 3) {
    violations.push(`paragraphs: ${paragraphs} (need 1-3)`);
  }

  const metaFound = [...META_WORDS].filter((w) =>
    text.toLowerCase().split(/\b/).includes(w),
  );
  if (metaFound.length > 0) {
    violations.push(`meta words: ${metaFound.join(", ")}`);
  }

  const thresholds: Partial<Record<MechanismKey, (m: TransitionProfile) => boolean>> = {
    "cross-hand": (m) => m.crossHand >= baseline.crossHand * 1.2,
    "row-cross": (m) => m.rowCross >= baseline.rowCross * 1.1,
    "same-finger": (m) => m.sameFinger >= baseline.sameFinger * 0.9,
    "space/timing": (m) => m.vowelInitialWords >= baseline.vowelInitialWords * 1.5,
  };
  const check = thresholds[mechanism];
  if (check && !check(measured)) {
    violations.push(`saturation: ${mechanism} below threshold`);
  }

  return { passed: violations.length === 0, mechanism, measured, violations };
}
