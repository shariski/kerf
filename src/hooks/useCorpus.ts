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

/** Count of corpus words containing each character. `w.chars` is
 *  already deduped per word (see corpus/types.ts), so summation is
 *  direct. Drives the adaptive engine's character-target exclusion:
 *  a char with 0 corpus support (e.g. `;` accumulated via drill mode)
 *  can't be practiced by the word-picker and shouldn't be rankable. */
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
      /** Precomputed `char → corpus word count`. Parallel to
       *  `bigramSupport`, consumed by the engine to exclude character
       *  targets with no corpus representation (cross-layer leak from
       *  drill mode — keys like `;` / `/` accumulate real stats but
       *  can't be produced by the word-picker). */
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
