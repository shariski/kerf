import "dotenv/config";
import { db } from "./index";
import { wordCorpus } from "./schema";

const WORDLIST_URL =
  "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english-usa-no-swears.txt";

/** Returns deduplicated unique characters in the order they appear. */
export function computeChars(word: string): string[] {
  return [...new Set(word.split(""))];
}

/** Returns deduplicated adjacent character pairs. */
export function computeBigrams(word: string): string[] {
  const result: string[] = [];
  for (let i = 0; i < word.length - 1; i++) {
    result.push(word.slice(i, i + 2));
  }
  return [...new Set(result)];
}

async function seed() {
  console.log("Fetching wordlist from GitHub...");
  const res = await fetch(WORDLIST_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch wordlist: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();

  // Mirrors EXTRA_BLOCKLIST in scripts/build-corpus.ts — kept in sync so
  // both the DB seed and the shipped corpus.json drop the same tokens.
  const EXTRA_BLOCKLIST = new Set(["israel", "israeli"]);

  // Keep only lowercase alpha words of length >= 2, minus blocklist.
  const words = text
    .trim()
    .split("\n")
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z]{2,}$/.test(w))
    .filter((w) => !EXTRA_BLOCKLIST.has(w));

  console.log(`Seeding ${words.length} words...`);

  const rows = words.map((word, i) => ({
    word,
    length: word.length,
    characters: computeChars(word),
    bigrams: computeBigrams(word),
    frequencyRank: i + 1,
  }));

  const CHUNK_SIZE = 500;
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    await db.insert(wordCorpus).values(chunk).onConflictDoNothing();
    process.stdout.write(`\r  inserted ${Math.min(i + CHUNK_SIZE, rows.length)}/${rows.length}`);
  }

  console.log("\nSeed complete.");
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1] ?? ""}`) {
  seed().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
