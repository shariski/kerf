import { describe, expect, it, vi } from "vitest";
import { CORPUS_VERSION, createCorpusLoader } from "./loader";
import type { Corpus, CorpusWord } from "./types";

const word = (over: Partial<CorpusWord> = {}): CorpusWord => ({
  word: over.word ?? "the",
  length: over.length ?? 3,
  chars: over.chars ?? ["e", "h", "t"],
  bigrams: over.bigrams ?? ["th", "he"],
  freqRank: over.freqRank ?? 0,
  leftKeystrokes: over.leftKeystrokes ?? 1,
  rightKeystrokes: over.rightKeystrokes ?? 2,
  innerColumnCount: over.innerColumnCount ?? 2,
});

const validCorpus = (over: Partial<Corpus> = {}): Corpus => ({
  version: over.version ?? CORPUS_VERSION,
  scope: over.scope ?? "alpha-only",
  source: over.source ?? "google-10000-english",
  words: over.words ?? [word()],
});

describe("createCorpusLoader", () => {
  describe("happy path", () => {
    it("fetches and returns a valid corpus", async () => {
      const corpus = validCorpus();
      const fetchJson = vi.fn().mockResolvedValue(corpus);
      const loader = createCorpusLoader({ fetchJson });

      const result = await loader.load();

      expect(result).toEqual(corpus);
      expect(fetchJson).toHaveBeenCalledTimes(1);
    });

    it("caches across repeated calls (fetches only once)", async () => {
      const fetchJson = vi.fn().mockResolvedValue(validCorpus());
      const loader = createCorpusLoader({ fetchJson });

      await loader.load();
      await loader.load();
      await loader.load();

      expect(fetchJson).toHaveBeenCalledTimes(1);
    });

    it("dedupes concurrent calls into a single fetch", async () => {
      let resolveFetch: (value: Corpus) => void = () => {};
      const pending = new Promise<Corpus>((resolve) => {
        resolveFetch = resolve;
      });
      const fetchJson = vi.fn().mockReturnValue(pending);
      const loader = createCorpusLoader({ fetchJson });

      const p1 = loader.load();
      const p2 = loader.load();
      resolveFetch(validCorpus());

      await Promise.all([p1, p2]);
      expect(fetchJson).toHaveBeenCalledTimes(1);
    });

    it("retries after a failed fetch (does not cache the rejection)", async () => {
      const fetchJson = vi
        .fn()
        .mockRejectedValueOnce(new Error("network boom"))
        .mockResolvedValueOnce(validCorpus());
      const loader = createCorpusLoader({ fetchJson });

      await expect(loader.load()).rejects.toThrow("network boom");
      const second = await loader.load();

      expect(second.words).toHaveLength(1);
      expect(fetchJson).toHaveBeenCalledTimes(2);
    });
  });

  describe("validation", () => {
    it("rejects when version mismatches CORPUS_VERSION", async () => {
      const fetchJson = vi.fn().mockResolvedValue(validCorpus({ version: 9999 }));
      const loader = createCorpusLoader({ fetchJson });

      await expect(loader.load()).rejects.toThrow(/version/i);
    });

    it("rejects when top-level shape is wrong (null)", async () => {
      const fetchJson = vi.fn().mockResolvedValue(null);
      const loader = createCorpusLoader({ fetchJson });

      await expect(loader.load()).rejects.toThrow(/corpus/i);
    });

    it("rejects when words is not an array", async () => {
      const fetchJson = vi.fn().mockResolvedValue({ ...validCorpus(), words: "nope" });
      const loader = createCorpusLoader({ fetchJson });

      await expect(loader.load()).rejects.toThrow(/words/i);
    });

    it("rejects when a word entry is missing required fields", async () => {
      const broken = { word: "the" };
      const fetchJson = vi.fn().mockResolvedValue({ ...validCorpus(), words: [broken] });
      const loader = createCorpusLoader({ fetchJson });

      await expect(loader.load()).rejects.toThrow();
    });
  });

  describe("defaults", () => {
    it("uses the default corpus URL (with version cache-bust) when none is provided", async () => {
      const fetchJson = vi.fn().mockResolvedValue(validCorpus());
      const loader = createCorpusLoader({ fetchJson });

      await loader.load();

      expect(fetchJson).toHaveBeenCalledWith(`/corpus.json?v=${CORPUS_VERSION}`);
    });

    it("respects a custom URL", async () => {
      const fetchJson = vi.fn().mockResolvedValue(validCorpus());
      const loader = createCorpusLoader({
        fetchJson,
        url: "/static/my-corpus.json",
      });

      await loader.load();

      expect(fetchJson).toHaveBeenCalledWith("/static/my-corpus.json");
    });
  });
});
