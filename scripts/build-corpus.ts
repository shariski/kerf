/**
 * Build script — generates public/corpus.json from a raw wordlist.
 *
 * Source: first20hours/google-10000-english (MIT license), "usa-no-swears"
 * variant. Upstream already applies profanity filtering; we commit the
 * snapshot under scripts/data/ for reproducibility (no build-time network).
 *
 * Run:  pnpm build:corpus
 *
 * Output layout is defined by src/domain/corpus/types.ts. The script
 * computes hand-balance and inner-column metadata via the finger
 * assignment table from task 1.1 — these values are layout-agnostic
 * for alpha-only words because Sofle and Lily58 share the alpha layer.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getFingerForKey } from "../src/domain/finger/resolver";
import { CORPUS_VERSION } from "../src/domain/corpus/loader";
import type { Corpus, CorpusWord } from "../src/domain/corpus/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SOURCE_FILE = resolve(ROOT, "scripts/data/google-10000-english-usa-no-swears.txt");
const OUT_FILE = resolve(ROOT, "public/corpus.json");
const SOURCE_NAME = "google-10000-english-usa-no-swears";

const MIN_LEN = 2;
const MAX_LEN = 12;
const ALPHA_ONLY = /^[a-z]+$/;

// Words a typing app should not ship even if upstream missed them.
// Intentionally small — we trust the upstream filter and treat this
// as a belt-and-suspenders pass. Add here if something slips through.
const EXTRA_BLOCKLIST: ReadonlySet<string> = new Set<string>([
  // Politically-charged tokens kept out to maintain platform neutrality.
  "israel",
  "israeli",
]);

const INNER_COLUMN: ReadonlySet<string> = new Set(["b", "g", "h", "n", "t", "y"]);

function buildWord(word: string, freqRank: number): CorpusWord {
  const chars = [...new Set(word.split(""))].sort();
  const bigrams: string[] = [];
  for (let i = 0; i < word.length - 1; i++) {
    bigrams.push(word.slice(i, i + 2));
  }

  let left = 0;
  let right = 0;
  let innerColumnCount = 0;
  for (const ch of word) {
    // Sofle and Lily58 share alpha assignments — either lookup works.
    const assignment = getFingerForKey("sofle", ch);
    if (!assignment) {
      throw new Error(`word "${word}" contains char "${ch}" with no finger assignment`);
    }
    if (assignment.hand === "left") left++;
    else right++;
    if (INNER_COLUMN.has(ch)) innerColumnCount++;
  }

  return {
    word,
    length: word.length,
    chars,
    bigrams,
    freqRank,
    leftKeystrokes: left,
    rightKeystrokes: right,
    innerColumnCount,
  };
}

function main(): void {
  const raw = readFileSync(SOURCE_FILE, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let kept = 0;
  let droppedLen = 0;
  let droppedAlpha = 0;
  let droppedDupe = 0;
  let droppedBlock = 0;
  const seen = new Set<string>();
  const words: CorpusWord[] = [];

  lines.forEach((rawWord, idx) => {
    const w = rawWord.toLowerCase();
    if (w.length < MIN_LEN || w.length > MAX_LEN) {
      droppedLen++;
      return;
    }
    if (!ALPHA_ONLY.test(w)) {
      droppedAlpha++;
      return;
    }
    if (EXTRA_BLOCKLIST.has(w)) {
      droppedBlock++;
      return;
    }
    if (seen.has(w)) {
      droppedDupe++;
      return;
    }
    seen.add(w);
    words.push(buildWord(w, idx));
    kept++;
  });

  const corpus: Corpus = {
    version: CORPUS_VERSION,
    scope: "alpha-only",
    source: SOURCE_NAME,
    words,
  };

  writeFileSync(OUT_FILE, JSON.stringify(corpus));

  const stats = {
    source: SOURCE_NAME,
    input: lines.length,
    kept,
    droppedLen,
    droppedAlpha,
    droppedDupe,
    droppedBlock,
    outputPath: OUT_FILE,
    outputBytes: readFileSync(OUT_FILE).byteLength,
  };
  console.log(JSON.stringify(stats, null, 2));
}

main();
