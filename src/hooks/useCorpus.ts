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

export type CorpusState =
  | { status: "loading" }
  | { status: "ready"; corpus: Corpus }
  | { status: "error"; error: Error };

export function useCorpus(): CorpusState {
  const [state, setState] = useState<CorpusState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    loader
      .load()
      .then((corpus) => {
        if (!cancelled) setState({ status: "ready", corpus });
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
