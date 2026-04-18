import type { Corpus, CorpusWord } from "./types";

/**
 * Bumped whenever the corpus shape OR the build pipeline changes in a
 * way that invalidates previously cached JSON. The loader rejects any
 * fetched blob whose `version` doesn't match this constant, so stale
 * service-worker / browser caches fail loudly instead of silently
 * serving a corpus that doesn't match the runtime's expectations.
 */
export const CORPUS_VERSION = 1;

const DEFAULT_CORPUS_URL = "/corpus.json";

export type FetchJson = (url: string) => Promise<unknown>;

export type CorpusLoader = {
  load: () => Promise<Corpus>;
};

export type CorpusLoaderOptions = {
  fetchJson: FetchJson;
  url?: string;
};

export function createCorpusLoader(options: CorpusLoaderOptions): CorpusLoader {
  const { fetchJson, url = DEFAULT_CORPUS_URL } = options;
  // Cache the in-flight or resolved promise. Two invariants:
  //   1. Concurrent callers share one fetch (no thundering herd).
  //   2. A rejection does NOT poison the cache — the next load() retries.
  let inFlight: Promise<Corpus> | undefined;

  const load = async (): Promise<Corpus> => {
    if (inFlight) return inFlight;
    const pending = fetchJson(url).then(parseCorpus);
    inFlight = pending;
    try {
      return await pending;
    } catch (err) {
      inFlight = undefined;
      throw err;
    }
  };

  return { load };
}

const WORD_KEYS: readonly (keyof CorpusWord)[] = [
  "word",
  "length",
  "chars",
  "bigrams",
  "freqRank",
  "leftKeystrokes",
  "rightKeystrokes",
  "innerColumnCount",
];

function parseCorpus(raw: unknown): Corpus {
  if (!raw || typeof raw !== "object") {
    throw new Error("corpus: expected a JSON object");
  }
  const c = raw as Record<string, unknown>;

  if (c.version !== CORPUS_VERSION) {
    throw new Error(
      `corpus: version mismatch (expected ${CORPUS_VERSION}, got ${String(c.version)})`,
    );
  }
  if (!Array.isArray(c.words)) {
    throw new Error("corpus: `words` must be an array");
  }
  for (const key of WORD_KEYS) {
    // Shape-only sanity check: a production-grade validator would use a
    // runtime schema library. For a bundled, build-script-generated
    // artifact the risk surface is small — we're mainly guarding against
    // a hand-edit that drops a field.
    if (c.words.length > 0 && !(key in (c.words[0] as object))) {
      throw new Error(`corpus: word entry missing field "${key}"`);
    }
  }

  return c as unknown as Corpus;
}
