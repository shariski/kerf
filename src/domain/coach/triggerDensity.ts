import type { FingerTable } from "#/domain/finger/types";

export type TransitionProfile = {
  sameFinger: number;
  rowCross: number;
  crossHand: number;
  nTransitions: number;
  wordsEndingEst: number;
  vowelInitialWords: number;
  avgWordLen: number;
  nWords: number;
};

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

export function profileText(text: string, fingerTable: FingerTable): TransitionProfile {
  const clean = text.toLowerCase();
  const chars = [...clean];
  let sameFinger = 0;
  let rowCross = 0;
  let crossHand = 0;
  let nTransitions = 0;
  let prev: string | null = null;

  for (const c of chars) {
    if (prev !== null) {
      const p = fingerTable[prev];
      const cur = fingerTable[c];
      if (p && cur && prev !== " " && c !== " ") {
        nTransitions += 1;
        if (p.hand === cur.hand && p.finger === cur.finger) sameFinger += 1;
        else if (p.hand === cur.hand) rowCross += 1;
        else crossHand += 1;
      }
    }
    prev = c;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  const nWords = words.length;
  const wordsEndingEst = nWords
    ? words.filter((w) => "est".includes(w[w.length - 1] ?? "")).length / nWords
    : 0;
  const vowelInitialWords = nWords
    ? words.filter((w) => VOWELS.has(w[0] ?? "")).length / nWords
    : 0;
  const avgWordLen = nWords ? words.reduce((a, w) => a + w.length, 0) / nWords : 0;

  return {
    sameFinger: nTransitions ? sameFinger / nTransitions : 0,
    rowCross: nTransitions ? rowCross / nTransitions : 0,
    crossHand: nTransitions ? crossHand / nTransitions : 0,
    nTransitions,
    wordsEndingEst: Math.round(wordsEndingEst * 1000) / 1000,
    vowelInitialWords: Math.round(vowelInitialWords * 1000) / 1000,
    avgWordLen: Math.round(avgWordLen * 100) / 100,
    nWords,
  };
}
