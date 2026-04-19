/**
 * End-to-end integration test for the hand isolation filter (Task 2.7).
 *
 * The existing unit tests in exerciseGenerator.test.ts exercise the
 * filter branch against hand-crafted `CorpusWord` fixtures where
 * `leftKeystrokes` / `rightKeystrokes` are injected directly. Those
 * tests pass even if the corpus build pipeline silently breaks the
 * metadata — e.g. if a finger-table entry is reassigned and every
 * shipped word suddenly has the wrong hand count.
 *
 * This test guards that gap: it loads the REAL shipped `public/corpus.json`,
 * runs `generateExercise` with each handIsolation mode, and verifies
 * the output words have the expected hand-distribution properties.
 * It is the one place that couples the finger table, the build
 * pipeline, and the runtime filter in a single assertion path.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getFingerForKey } from "#/domain/finger/resolver";
import type { Corpus } from "#/domain/corpus/types";
import { generateExercise } from "./exerciseGenerator";

const CORPUS_PATH = resolve(__dirname, "..", "..", "..", "public", "corpus.json");

/** Load the bundled corpus once and share across tests in this file. */
const realCorpus: Corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8"));

/** Deterministic RNG for repeatable sampling — mulberry32 copied from the
 * unit-test file so we don't reach across module boundaries. */
function seededRng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const uniformScore = () => 1;

describe("generateExercise — hand isolation × real corpus", () => {
  it("corpus sanity: words carry leftKeystrokes and rightKeystrokes that sum to length", () => {
    // If this assertion ever fails, the build pipeline is dropping chars
    // somewhere (or the finger table has an unmapped letter) — the filter
    // can't be trusted downstream.
    for (const w of realCorpus.words.slice(0, 50)) {
      expect(
        w.leftKeystrokes + w.rightKeystrokes,
        `${w.word} has inconsistent hand counts`,
      ).toBe(w.length);
    }
  });

  it("handIsolation 'left' produces only words whose every character is on the left hand", () => {
    const out = generateExercise({
      corpus: realCorpus,
      weaknessScoreFor: uniformScore,
      filters: { handIsolation: "left" },
      targetWordCount: 30,
      rng: seededRng(42),
    });
    expect(out.length).toBeGreaterThan(0);
    // Belt: each output word's rightKeystrokes metadata is 0.
    // Braces: re-derive hand independently — if the finger table ever
    // gets reassigned and the build pipeline is out of sync, this catches
    // it even when the shipped metadata looks self-consistent.
    for (const word of out) {
      const meta = realCorpus.words.find((w) => w.word === word);
      expect(meta, `corpus missing metadata for "${word}"`).toBeDefined();
      expect(meta!.rightKeystrokes, `"${word}" should be all-left`).toBe(0);
      for (const ch of word) {
        const assign = getFingerForKey("sofle", ch);
        expect(
          assign?.hand,
          `char "${ch}" in "${word}" is not on the left hand per finger table`,
        ).toBe("left");
      }
    }
  });

  it("handIsolation 'right' produces only words whose every character is on the right hand", () => {
    const out = generateExercise({
      corpus: realCorpus,
      weaknessScoreFor: uniformScore,
      filters: { handIsolation: "right" },
      targetWordCount: 30,
      rng: seededRng(42),
    });
    expect(out.length).toBeGreaterThan(0);
    for (const word of out) {
      const meta = realCorpus.words.find((w) => w.word === word);
      expect(meta, `corpus missing metadata for "${word}"`).toBeDefined();
      expect(meta!.leftKeystrokes, `"${word}" should be all-right`).toBe(0);
      for (const ch of word) {
        const assign = getFingerForKey("sofle", ch);
        expect(
          assign?.hand,
          `char "${ch}" in "${word}" is not on the right hand per finger table`,
        ).toBe("right");
      }
    }
  });

  it("handIsolation 'either' returns a mix that includes both left-only and right-only words", () => {
    // Sanity: without the filter, sampling across the corpus should turn
    // up at least one of each. Lock this in so a future "default filter"
    // change doesn't silently narrow the baseline.
    const out = generateExercise({
      corpus: realCorpus,
      weaknessScoreFor: uniformScore,
      filters: { handIsolation: "either" },
      targetWordCount: 100,
      rng: seededRng(7),
    });
    const metas = out
      .map((word) => realCorpus.words.find((w) => w.word === word))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);
    const hasLeftOnly = metas.some((m) => m.rightKeystrokes === 0);
    const hasRightOnly = metas.some((m) => m.leftKeystrokes === 0);
    expect(hasLeftOnly).toBe(true);
    expect(hasRightOnly).toBe(true);
  });
});
