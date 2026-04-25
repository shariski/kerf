/**
 * Loads the bundled corpus once per browser session.
 *
 * Thin wrapper around `createCorpusLoader` that holds the resolved Corpus in
 * React state. Shares a singleton loader across all callers so the corpus is
 * fetched exactly once (the loader itself de-dupes in-flight requests).
 */

import { useEffect, useState } from "react";
import { createCorpusLoader } from "#/domain/corpus/loader";
import type { Corpus } from "#/domain/corpus/types";

const fetchJson = async (url: string): Promise<unknown> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`corpus fetch failed: ${res.status}`);
  return res.json();
};

const loader = createCorpusLoader({ fetchJson });

/** Count of corpus words containing each bigram (not total occurrences).
 *  De-duplicating within a single word ensures a word like "tt" in "butter"
 *  contributes 1, not 2, to the "tt" count. */
export function buildBigramSupport(corpus: Corpus): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const w of corpus.words) {
    // De-duplicate bigrams within a single word so we're counting
    // "words containing bigram X", not "occurrences of X in corpus".
    const seen = new Set(w.bigrams);
    for (const bg of seen) {
      counts.set(bg, (counts.get(bg) ?? 0) + 1);
    }
  }
  return counts;
}

/** Count of corpus words containing each character. Used by Path 2's
 *  Bayesian engine to enumerate the rankable character universe (every
 *  corpus character is a candidate, scored at the prior or posterior).
 *  Also serves as the cross-layer-leak guard: characters with support 0
 *  (e.g. drill keys like `;`) are filtered out of ranking. */
export function buildCharSupport(corpus: Corpus): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const w of corpus.words) {
    for (const c of w.chars) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
  }
  return counts;
}

export type CorpusState =
  | { status: "loading" }
  | {
      status: "ready";
      corpus: Corpus;
      /** Precomputed `bigram → corpus word count`. Built once on load.
       *  Consumed by the adaptive engine to detect bigram targets that
       *  can't be practiced via the word-picker. */
      bigramSupport: ReadonlyMap<string, number>;
      /** Precomputed `char → corpus word count`. Path 2 engine uses
       *  this as the rankable character universe — every corpus char
       *  becomes a candidate (scored at the Bayesian prior if no
       *  measured stat exists). Chars with support 0 (drill keys
       *  like `;`/`/`) are excluded. */
      charSupport: ReadonlyMap<string, number>;
    }
  | { status: "error"; error: Error };

export function useCorpus(): CorpusState {
  const [state, setState] = useState<CorpusState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loader
      .load()
      .then((corpus) => {
        if (!cancelled) {
          setState({
            status: "ready",
            corpus,
            bigramSupport: buildBigramSupport(corpus),
            charSupport: buildCharSupport(corpus),
          });
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
