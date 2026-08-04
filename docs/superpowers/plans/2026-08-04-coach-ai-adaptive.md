# Coach (AI Adaptive Practice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Coach" practice mode that shows the user why their typing is weak (mechanism-level diagnosis) and serves personalized general-knowledge passages generated with AI, gated by a deterministic quality check, quota-limited to 1 free session/day, and persisted into a reusable passage catalog.

**Architecture:** Deterministic "why-engine" classifies the user's recent errors by finger mechanics (using the existing layout-aware `FingerTable`s for sofle/lily58). A server function computes the why-report, looks up the passage catalog by weakness-set key; on a miss it calls the DeepSeek API (two-step: root-cause analysis → topic-seeded passage generation with thinking disabled on the generation call), runs the trigger-density + naturalness gate, stores the passage, and returns it. The client types the passage with the existing session engine and persists with a `passage_id` link. No billing in this plan — a server-side daily quota (1/day) enforces the free tier.

**Tech Stack:** TanStack Start (file routes + `createServerFn`), Drizzle ORM + postgres, zod, vitest, React 19, DeepSeek API (OpenAI-compatible chat completions).

## Global Constraints

- All new code follows repo conventions: domain logic in `src/domain/**` as pure functions with co-located `*.test.ts`; server logic in `src/server/**`; biome format/lint (`pnpm lint`, `pnpm format:check`), `pnpm typecheck`, `pnpm test` must pass.
- Keystroke event type is `KeystrokeEvent` from `#/domain/stats/types` (re-exported by `#/domain/session/types`).
- Finger tables come from `#/domain/finger/sofle` (`SOFLE_BASE_LAYER`) and `#/domain/finger/lily58` (`LILY58_BASE_LAYER`); `KeyboardLayout = "sofle" | "lily58"` from `#/domain/finger/types`.
- New DB tables/columns are declared in `src/server/db/schema.ts` and applied via drizzle-kit migration (`pnpm db:generate`, review SQL, `pnpm db:migrate`).
- **IP constraint:** the V6 prompt texts are core IP (validated in the private repo `~/Work/kerf-adaptive-poc`). Task 6 copies them verbatim from there; do NOT rewrite or "improve" them. The kerf repo is public — a pre-launch task (outside this plan) must extract the generation service into a closed-source backend if the repo stays public.
- Quota semantics: 1 Coach passage served per user per UTC day, enforced server-side at fetch time (generation costs money — the quota charges on serve, not on session completion). `coach_quota` row is UPSERTed.
- Mode value for Coach sessions is `"coach"` — the `mode` union in `validatePersistSessionInput` (`src/server/persistSessionHelpers.ts`) must accept it.
- UI copy is flat, no hype (CLAUDE.md §B3). No "AI" branding anywhere in user-facing copy.
- New server env vars are read lazily in `src/server/coach/llm.ts` (NOT added to `src/server/env.ts` — that module throws in production at import time if required vars are missing, which would break deploys that don't run Coach yet).

---

### Task 1: Mechanism classifier (domain)

**Files:**
- Create: `src/domain/coach/mechanisms.ts`
- Test: `src/domain/coach/mechanisms.test.ts`

**Interfaces:**
- Consumes: `FingerTable`, `KeyAssignment` from `#/domain/finger/types`.
- Produces:
  - `export type MechanismKey = "space/timing" | "same-finger" | "adjacent-finger" | "row-cross" | "cross-hand" | "non-alpha"`
  - `export function classifyMechanism(target: string, actual: string, fingerTable: FingerTable): MechanismKey | null` — `null` when the pair is not classifiable (both non-alpha, or keys absent from the table).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { classifyMechanism } from "./mechanisms";

describe("classifyMechanism", () => {
  it("classifies space involvement as space/timing", () => {
    expect(classifyMechanism(" ", "e", SOFLE_BASE_LAYER)).toBe("space/timing");
    expect(classifyMechanism("e", " ", SOFLE_BASE_LAYER)).toBe("space/timing");
  });

  it("classifies same-finger transitions (t and r are both left index)", () => {
    expect(classifyMechanism("t", "r", SOFLE_BASE_LAYER)).toBe("same-finger");
  });

  it("classifies adjacent-finger same-row slips (r -> e)", () => {
    expect(classifyMechanism("r", "e", SOFLE_BASE_LAYER)).toBe("adjacent-finger");
  });

  it("classifies same-hand row crosses (e -> s)", () => {
    expect(classifyMechanism("e", "s", SOFLE_BASE_LAYER)).toBe("row-cross");
  });

  it("classifies cross-hand confusions (i -> e)", () => {
    expect(classifyMechanism("i", "e", SOFLE_BASE_LAYER)).toBe("cross-hand");
  });

  it("classifies digits typed for letters as non-alpha", () => {
    expect(classifyMechanism("a", "1", SOFLE_BASE_LAYER)).toBe("non-alpha");
  });

  it("returns null for unclassifiable pairs", () => {
    expect(classifyMechanism("2", "3", SOFLE_BASE_LAYER)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/domain/coach/mechanisms.test.ts`
Expected: FAIL — `Cannot find module './mechanisms'`

- [ ] **Step 3: Write the implementation**

```ts
import type { FingerTable } from "#/domain/finger/types";

export type MechanismKey =
  | "space/timing"
  | "same-finger"
  | "adjacent-finger"
  | "row-cross"
  | "cross-hand"
  | "non-alpha";

const FINGER_ORDER: Record<string, number> = { pinky: 0, ring: 1, middle: 2, index: 3 };

/**
 * Classify an (target, actual) error pair by which finger mechanics failed.
 * Layout-aware: uses the provided FingerTable (sofle/lily58 base layers).
 * Returns null when the pair is not classifiable (e.g. both non-alpha).
 */
export function classifyMechanism(
  target: string,
  actual: string,
  fingerTable: FingerTable,
): MechanismKey | null {
  if (target === " " || actual === " ") return "space/timing";

  const t = fingerTable[target];
  const a = fingerTable[actual];
  if (!t || !a) return null; // one of the keys is not in the base layer
  const isAlpha = t.row >= 1 && a.row >= 1;
  if (!isAlpha) return "non-alpha";

  if (t.hand === a.hand && t.finger === a.finger) return "same-finger";

  if (t.hand === a.hand) {
    if (t.finger === a.finger) return "same-finger";
    const adjacent =
      Math.abs((FINGER_ORDER[t.finger] ?? 0) - (FINGER_ORDER[a.finger] ?? 0)) === 1;
    if (adjacent && t.row === a.row) return "adjacent-finger";
    if (adjacent && t.row !== a.row) return "row-cross";
    if (!adjacent) return "row-cross"; // non-adjacent same-hand: aim drift
  }

  return "cross-hand";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/domain/coach/mechanisms.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/coach/mechanisms.ts src/domain/coach/mechanisms.test.ts
git commit -m "feat(coach): mechanism classifier from finger tables"
```

---

### Task 2: Why-report computation (domain)

**Files:**
- Create: `src/domain/coach/whyReport.ts`
- Test: `src/domain/coach/whyReport.test.ts`

**Interfaces:**
- Consumes: `KeystrokeEvent` from `#/domain/stats/types`, `classifyMechanism` + `MechanismKey` from `./mechanisms`, `FingerTable` from `#/domain/finger/types`.
- Produces:
  - `export type MechanismStat = { mechanism: MechanismKey; count: number; sharePct: number; avgMs: number; p95Ms: number; topConfusions: { target: string; typedAs: string; count: number }[]; topBigrams: { bigram: string; count: number }[] }`
  - `export type WhyReport = { totalTrueConfusions: number; mechanisms: MechanismStat[] }`
  - `export function computeWhyReport(events: KeystrokeEvent[], fingerTable: FingerTable): WhyReport`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { computeWhyReport } from "./whyReport";

const event = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  sessionId: "s1",
  sequence: 0,
  targetChar: "e",
  actualChar: "s",
  isError: true,
  keystrokeMs: 150,
  prevChar: "a",
  positionInWord: 2,
  isRetype: false,
  ...over,
});

describe("computeWhyReport", () => {
  it("counts only true confusions (isError and actual != target)", () => {
    const events = [
      event({ sequence: 0, targetChar: "e", actualChar: "s" }),
      event({ sequence: 1, targetChar: "e", actualChar: "e", isRetype: true }), // correction noise
      event({ sequence: 2, targetChar: "t", actualChar: "r" }),
    ];
    const report = computeWhyReport(events, SOFLE_BASE_LAYER);
    expect(report.totalTrueConfusions).toBe(2);
  });

  it("aggregates per-mechanism counts, shares, and avg timing", () => {
    const events = [
      event({ sequence: 0, targetChar: "e", actualChar: "s", keystrokeMs: 100 }),
      event({ sequence: 1, targetChar: "t", actualChar: "r", keystrokeMs: 200 }),
      event({ sequence: 2, targetChar: "i", actualChar: "e", keystrokeMs: 150 }),
    ];
    const report = computeWhyReport(events, SOFLE_BASE_LAYER);
    const byName = Object.fromEntries(report.mechanisms.map((m) => [m.mechanism, m]));
    expect(byName["row-cross"].count).toBe(1);
    expect(byName["row-cross"].sharePct).toBeCloseTo(33.3, 0);
    expect(byName["same-finger"].avgMs).toBe(200);
    expect(byName["cross-hand"].count).toBe(1);
  });

  it("records top confusions per mechanism with counts", () => {
    const events = [
      event({ sequence: 0, targetChar: "e", actualChar: "s" }),
      event({ sequence: 1, targetChar: "e", actualChar: "s" }),
    ];
    const report = computeWhyReport(events, SOFLE_BASE_LAYER);
    const rowCross = report.mechanisms.find((m) => m.mechanism === "row-cross");
    expect(rowCross?.topConfusions).toEqual([{ target: "e", typedAs: "s", count: 2 }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/domain/coach/whyReport.test.ts`
Expected: FAIL — `Cannot find module './whyReport'`

- [ ] **Step 3: Write the implementation**

```ts
import type { FingerTable } from "#/domain/finger/types";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { classifyMechanism, type MechanismKey } from "./mechanisms";

export type MechanismStat = {
  mechanism: MechanismKey;
  count: number;
  sharePct: number;
  avgMs: number;
  p95Ms: number;
  topConfusions: { target: string; typedAs: string; count: number }[];
  topBigrams: { bigram: string; count: number }[];
};

export type WhyReport = {
  totalTrueConfusions: number;
  mechanisms: MechanismStat[];
};

/**
 * Compute the deterministic "why" report: classify true confusions
 * (isError && actual !== target) into finger-mechanism buckets.
 * Correction/retype events (isRetype, or actual === target) are noise.
 */
export function computeWhyReport(
  events: KeystrokeEvent[],
  fingerTable: FingerTable,
): WhyReport {
  const counters = new Map<
    MechanismKey,
    { count: number; ms: number[]; confusions: Map<string, number>; bigrams: Map<string, number> }
  >();
  const bump = (m: MechanismKey) => {
    let c = counters.get(m);
    if (!c) {
      c = { count: 0, ms: [], confusions: new Map(), bigrams: new Map() };
      counters.set(m, c);
    }
    c.count += 1;
    return c;
  };

  let total = 0;
  for (const e of events) {
    if (!e.isError || e.actualChar === e.targetChar || e.isRetype) continue;
    const m = classifyMechanism(e.targetChar, e.actualChar, fingerTable);
    if (!m) continue;
    total += 1;
    const c = bump(m);
    c.ms.push(e.keystrokeMs);
    const key = `${e.targetChar}\u0000${e.actualChar}`;
    c.confusions.set(key, (c.confusions.get(key) ?? 0) + 1);
    if (e.prevChar) {
      const bg = e.prevChar + e.targetChar;
      c.bigrams.set(bg, (c.bigrams.get(bg) ?? 0) + 1);
    }
  }

  const mechanisms: MechanismStat[] = [];
  for (const [mechanism, c] of counters) {
    const msSorted = [...c.ms].sort((a, b) => a - b);
    const p95 = msSorted.length
      ? msSorted[Math.min(msSorted.length - 1, Math.floor(msSorted.length * 0.95))]
      : 0;
    const topConfusions = [...c.confusions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, n]) => {
        const [target, typedAs] = k.split("\u0000");
        return { target, typedAs, count: n };
      });
    const topBigrams = [...c.bigrams.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([bigram, n]) => ({ bigram, count: n }));
    mechanisms.push({
      mechanism,
      count: c.count,
      sharePct: total ? Math.round((c.count / total) * 1000) / 10 : 0,
      avgMs: c.ms.length ? Math.round(c.ms.reduce((a, b) => a + b, 0) / c.ms.length) : 0,
      p95Ms: p95,
      topConfusions,
      topBigrams,
    });
  }

  mechanisms.sort((a, b) => b.count - a.count);
  return { totalTrueConfusions: total, mechanisms };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/domain/coach/whyReport.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/coach/whyReport.ts src/domain/coach/whyReport.test.ts
git commit -m "feat(coach): deterministic why-report from keystroke events"
```

---

### Task 3: Trigger-density profiler + gate (domain)

**Files:**
- Create: `src/domain/coach/triggerDensity.ts`, `src/domain/coach/gate.ts`
- Test: `src/domain/coach/triggerDensity.test.ts`, `src/domain/coach/gate.test.ts`

**Interfaces:**
- Consumes: `FingerTable` from `#/domain/finger/types`.
- Produces:
  - `export type TransitionProfile = { sameFinger: number; rowCross: number; crossHand: number; nTransitions: number; wordsEndingEst: number; vowelInitialWords: number; avgWordLen: number; nWords: number }`
  - `export function profileText(text: string, fingerTable: FingerTable): TransitionProfile`
  - `export const BASELINE_PROFILE: TransitionProfile` — normal-English baselines measured in the PoC (sameFinger 0.216, rowCross 0.345, crossHand 0.439, wordsEndingEst 0.36, vowelInitialWords 0.177, avgWordLen 4.8). Same values for both layouts at MVP (layout-specific calibration is post-MVP).
  - `export type GateResult = { passed: boolean; mechanism: MechanismKey; measured: TransitionProfile; violations: string[] }`
  - `export function evaluateGate(mechanism: MechanismKey, text: string, fingerTable: FingerTable, baseline: TransitionProfile = BASELINE_PROFILE): GateResult`

Thresholds per mechanism (from the PoC validation — a passage must EXCEED baseline by at least the multiplier, or it is not deliberate practice):
- cross-hand: measured.crossHand >= baseline.crossHand * 1.2
- row-cross: measured.rowCross >= baseline.rowCross * 1.1
- same-finger: measured.sameFinger >= baseline.sameFinger * 0.9 (natural English under-supplies it; modest under-saturation accepted)
- space/timing: measured.vowelInitialWords >= baseline.vowelInitialWords * 1.5
- adjacent-finger, non-alpha: no threshold (adjacent-finger practice content is hard to isolate; non-alpha is dropped) — always pass on density, still gated by naturalness.

Additional universal gate rules (violations when broken):
- text length: 120 <= words <= 350
- paragraphs: 1..3 by double-newline count (if the text has no double newlines, count single newlines + 1; cap at 3)
- meta-word scan: lowercase word list `["sequence", "bigram", "transition", "finger", "typing", "practice", "drill", "pattern", "rhythm", "mistake", "error", "letter", "exercise", "keyboard", "keystroke"]` — any present = violation.

- [ ] **Step 1: Write the failing tests**

`src/domain/coach/triggerDensity.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { profileText } from "./triggerDensity";

describe("profileText", () => {
  it("profiles a text's transition mix", () => {
    // "tr" = left index index (same-finger); "es" = middle->ring same hand (row-cross)
    const profile = profileText("trees and seas", SOFLE_BASE_LAYER);
    expect(profile.nTransitions).toBeGreaterThan(0);
    expect(profile.sameFinger).toBeGreaterThan(0);
    expect(profile.rowCross).toBeGreaterThan(0);
    expect(profile.nWords).toBe(3);
  });

  it("computes word boundary stats", () => {
    const profile = profileText("the sea is vast", SOFLE_BASE_LAYER);
    expect(profile.wordsEndingEst).toBe(0.75); // the, sea, vast end in e/s/t
    expect(profile.vowelInitialWords).toBe(0.25); // "is"
  });
});
```

`src/domain/coach/gate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { evaluateGate, BASELINE_PROFILE } from "./gate";

const crossHandHeavy = [
  "data time world base", // every word alternates hands
  "quiet theme water mind",
  "The wide world of data time and mind is a base of quiet theme.",
].join("\n\n");

const metaSalad =
  "The sequence of practice and rhythm mistakes is a finger typing error letter.";

describe("evaluateGate", () => {
  it("passes a cross-hand heavy passage for the cross-hand mechanism", () => {
    const result = evaluateGate("cross-hand", crossHandHeavy, SOFLE_BASE_LAYER);
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("rejects meta-commentary", () => {
    const result = evaluateGate("cross-hand", metaSalad, SOFLE_BASE_LAYER);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("meta"))).toBe(true);
  });

  it("rejects under-saturated passages", () => {
    const plain = "the cat sat on a mat and the dog ran to it";
    const result = evaluateGate("cross-hand", plain, SOFLE_BASE_LAYER);
    expect(result.passed).toBe(false);
  });

  it("rejects too-short passages", () => {
    const result = evaluateGate("row-cross", "one two", SOFLE_BASE_LAYER);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes("length"))).toBe(true);
  });

  it("exports a baseline profile with PoC values", () => {
    expect(BASELINE_PROFILE.sameFinger).toBeGreaterThan(0.1);
    expect(BASELINE_PROFILE.rowCross).toBeGreaterThan(0.3);
    expect(BASELINE_PROFILE.crossHand).toBeGreaterThan(0.4);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/domain/coach/triggerDensity.test.ts src/domain/coach/gate.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

`src/domain/coach/triggerDensity.ts`:

```ts
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
    ? words.filter((w) => "est".includes(w[w.length - 1])).length / nWords
    : 0;
  const vowelInitialWords = nWords
    ? words.filter((w) => VOWELS.has(w[0])).length / nWords
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
```

`src/domain/coach/gate.ts`:

```ts
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

  const paragraphs = (text.match(/\n\n/g)?.length ?? 0) + 1;
  if (paragraphs < 1 || paragraphs > 3) {
    violations.push(`paragraphs: ${paragraphs} (need 1-3)`);
  }

  const metaFound = META_WORDS.filter((w) =>
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/domain/coach/triggerDensity.test.ts src/domain/coach/gate.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/coach/triggerDensity.ts src/domain/coach/triggerDensity.test.ts src/domain/coach/gate.ts src/domain/coach/gate.test.ts
git commit -m "feat(coach): trigger-density profiler and quality gate"
```

---

### Task 4: DB schema + migration (passages, coach_quota, sessions.passageId)

**Files:**
- Modify: `src/server/db/schema.ts`
- Create (generated): `src/server/db/migrations/0006_*.sql`

**Interfaces:**
- Produces (drizzle tables used by Tasks 6-7):
  - `export const passages = pgTable("passages", { id: uuid pk default gen_random_uuid(), title: text notNull, topic: text notNull, difficulty: text notNull, mechanisms: jsonb notNull, triggerTargets: jsonb, measuredDensity: jsonb, qualityGate: jsonb notNull, text: text notNull, wordCount: integer notNull, paragraphs: integer notNull, source: text notNull, status: text notNull default "active", targetKey: text notNull, usageCount: integer notNull default 0, createdAt: timestamp withTimezone notNull defaultNow() }, (t) => [uniqueIndex("passages_target_key_topic_difficulty_idx").on(t.targetKey, t.topic, t.difficulty)])`
  - `export const coachQuota = pgTable("coach_quota", { userId: uuid notNull references users.id onDelete cascade, date: text notNull, sessionsUsed: integer notNull default 0 }, (t) => [primaryKey({ columns: [t.userId, t.date] })])`
  - `sessions` gains `passageId: uuid("passage_id").references(() => passages.id, { onDelete: "set null" })`

- [ ] **Step 1: Add the tables to the schema**

Append to `src/server/db/schema.ts` (after `wordCorpus`):

```ts
// ── passages (Coach catalog) ─────────────────────────────────────────────────

export const passages = pgTable(
  "passages",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    title: text("title").notNull(),
    topic: text("topic").notNull(),
    difficulty: text("difficulty").notNull(), // 'easy' | 'medium' | 'hard'
    mechanisms: jsonb("mechanisms").notNull(), // MechanismKey[]
    triggerTargets: jsonb("trigger_targets"),
    measuredDensity: jsonb("measured_density"),
    qualityGate: jsonb("quality_gate").notNull(), // GateResult
    text: text("text").notNull(),
    wordCount: integer("word_count").notNull(),
    paragraphs: integer("paragraphs").notNull(),
    source: text("source").notNull(), // 'ai:deepseek-v4-flash:v6'
    status: text("status").notNull().default("active"), // 'active' | 'retired' | 'needs_review'
    targetKey: text("target_key").notNull(),
    usageCount: integer("usage_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("passages_key_topic_diff_idx").on(t.targetKey, t.topic, t.difficulty),
    index("passages_status_idx").on(t.status),
  ],
);

// ── coach_quota (daily free tier) ────────────────────────────────────────────

export const coachQuota = pgTable(
  "coach_quota",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(), // 'YYYY-MM-DD' UTC
    sessionsUsed: integer("sessions_used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);
```

Add `passageId` to the `sessions` table definition (after `filterConfig`):

```ts
  passageId: uuid("passage_id").references(() => passages.id, { onDelete: "set null" }),
```

Add `primaryKey` to the existing drizzle import list at the top of the file:

```ts
import { pgTable, uuid, text, boolean, timestamp, integer, bigint, real, jsonb, bigserial, index, uniqueIndex, numeric, primaryKey } from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Generate the migration**

Run: `pnpm db:generate`
Expected: a new file `src/server/db/migrations/0006_*.sql` containing `CREATE TABLE "passages"`, `CREATE TABLE "coach_quota"`, and `ALTER TABLE "sessions" ADD COLUMN "passage_id"`.

- [ ] **Step 3: Review the generated SQL**

Open the generated file and verify:
- `passages` has the unique index on `(target_key, topic, difficulty)` and the status index.
- `coach_quota` has a primary key on `(user_id, date)`.
- `sessions.passage_id` references `passages(id)` with `ON DELETE SET NULL`.
Fix any deviations by hand before committing.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no unresolved `passages`/`coachQuota` references yet — schema exports compile).

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/migrations/0006_*.sql src/server/db/migrations/meta/_journal.json
git commit -m "feat(coach): passages + coach_quota tables, sessions.passage_id"
```

---

### Task 5: DeepSeek LLM client (server)

**Files:**
- Create: `src/server/coach/llm.ts`
- Create: `src/server/coach/prompts/analysis.md`, `src/server/coach/prompts/generation.md`
- Test: `src/server/coach/llm.test.ts`

**Interfaces:**
- Consumes: `WhyReport` from `#/domain/coach/whyReport`; env vars `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` (default `deepseek-v4-flash`), `DEEPSEEK_BASE_URL` (default `https://api.deepseek.com/v1/chat/completions`).
- Produces:
  - `export type LlmResponse = { content: string; usage: { promptTokens: number; completionTokens: number } }`
  - `export type LlmClient = (messages: { role: "system" | "user"; content: string }[], opts?: { thinkingOff?: boolean; maxTokens?: number }) => Promise<LlmResponse>`
  - `export function createLlmClient(fetchImpl: typeof fetch = fetch, apiKey?: string): LlmClient` — reads env lazily when `apiKey` not passed; throws `CoachError` with `code: "LLM_CONFIG"` if the key is missing; retries on 429/5xx up to 4 times with backoff.
  - `export function buildAnalysisMessages(whyReportJson: string, digest: string, verbatim: string[]): { role: "system" | "user"; content: string }[]` — assembles the analysis call from `prompts/analysis.md` (system = prompt file's system section; user = file's user section with `<WHY_REPORT>`, `<VERBATIM_1..3>`, `<DIGEST>` substituted).
  - `export function buildGenerationMessages(analysisContent: string): { role: "system" | "user"; content: string }[]` — assembles the generation call from `prompts/generation.md` with `<ROOT_CAUSE_RESULT>` substituted.
  - `export function extractJsonObject(content: string): unknown` — strips code fences, slices first `{`..last `}`, `JSON.parse`s; throws `CoachError` `code: "LLM_PARSE"` on failure.
- Prompt files are copied VERBATIM from the private PoC repo: `~/Work/kerf-adaptive-poc/prompts/V6_mechanism_topic.md` sections "Call A — root cause (system)"/"(user)" → `analysis.md`, and "Call B — mechanism-targeted, topic-seeded generation (system)"/"(user)" → `generation.md`. Keep the em-dash section headers and `##`/`---` structure intact so `parsePromptFile` (below) works.

- [ ] **Step 1: Copy the prompt files from the private PoC repo**

```bash
mkdir -p src/server/coach/prompts
python3 - <<'EOF'
import re, pathlib
src = pathlib.Path.home() / "Work/kerf-adaptive-poc/prompts/V6_mechanism_topic.md"
text = src.read_text()
def section(header, end=None):
    start = text.index(header) + len(header)
    end = text.index(end, start) if end else len(text)
    return text[start:end].strip()
analysis = f"""# analysis

## system

{section("## Call A — root cause (system)", "## Call A — root cause (user)")}

## user

{section("## Call A — root cause (user)", "---").split("---")[0].strip()}
"""
generation = f"""# generation

## system

{section("## Call B — mechanism-targeted, topic-seeded generation (system)", "## Call B — generation (user)")}

## user

{section("## Call B — generation (user)")}
"""
pathlib.Path("src/server/coach/prompts/analysis.md").write_text(analysis)
pathlib.Path("src/server/coach/prompts/generation.md").write_text(generation)
print("copied", len(analysis), len(generation))
EOF
```

Verify the files contain the full V6 prompt text (spot-check: `suggested_topics`, `trigger_targets`, `NO meta-commentary`).

- [ ] **Step 2: Write the failing tests**

`src/server/coach/llm.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  buildAnalysisMessages,
  buildGenerationMessages,
  createLlmClient,
  extractJsonObject,
} from "./llm";

describe("extractJsonObject", () => {
  it("parses bare JSON", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips markdown fences", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("slices surrounding prose", () => {
    expect(extractJsonObject('Here you go: {"a":1} thanks!')).toEqual({ a: 1 });
  });
  it("throws CoachError LLM_PARSE on garbage", () => {
    expect(() => extractJsonObject("no json here")).toThrowError(/LLM_PARSE/);
  });
});

describe("createLlmClient", () => {
  it("throws LLM_CONFIG when no api key and env unset", async () => {
    const client = createLlmClient(fetch, "");
    await expect(client([{ role: "user", content: "hi" }])).rejects.toThrowError(/LLM_CONFIG/);
  });

  it("calls the API and returns parsed content", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{\"ok\":true}" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });
    const client = createLlmClient(fakeFetch as unknown as typeof fetch, "sk-test");
    const res = await client([{ role: "user", content: "hi" }]);
    expect(res.content).toBe('{"ok":true}');
    expect(res.usage.promptTokens).toBe(10);
    expect(fakeFetch).toHaveBeenCalledWith(
      expect.stringContaining("chat/completions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retries on 503 then succeeds", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{}" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      });
    const client = createLlmClient(fakeFetch as unknown as typeof fetch, "sk-test");
    const res = await client([{ role: "user", content: "hi" }]);
    expect(res.content).toBe("{}");
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });
});

describe("prompt assembly", () => {
  it("builds analysis messages with data substituted", () => {
    const msgs = buildAnalysisMessages('{"total":1}', "digest", ["v1", "v2", "v3"]);
    const user = msgs[1].content;
    expect(user).toContain('"total":1');
    expect(user).toContain("digest");
    expect(user).toContain("v1");
    expect(user).toContain("v3");
    expect(msgs[0].role).toBe("system");
  });

  it("builds generation messages with the analysis result injected", () => {
    const msgs = buildGenerationMessages('{"root_causes":[]}');
    expect(msgs[1].content).toContain('{"root_causes":[]}');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run src/server/coach/llm.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

`src/server/coach/llm.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export class CoachError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type LlmResponse = {
  content: string;
  usage: { promptTokens: number; completionTokens: number };
};

export type LlmClient = (
  messages: { role: "system" | "user"; content: string }[],
  opts?: { thinkingOff?: boolean; maxTokens?: number },
) => Promise<LlmResponse>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadPromptFile(name: "analysis.md" | "generation.md"): string {
  return readFileSync(path.join(__dirname, "prompts", name), "utf8");
}

function parsePromptFile(text: string): { system: string; user: string } {
  const parts = text.split("\n## system\n");
  if (parts.length < 2) throw new CoachError("LLM_PROMPT", `bad prompt file: ${text.slice(0, 40)}`);
  const [beforeSystem, rest] = parts;
  const userParts = rest.split("\n## user\n");
  if (userParts.length < 2) throw new CoachError("LLM_PROMPT", "bad prompt file: no user section");
  return { system: beforeSystem.replace(/^# .*\n/, "").trim(), user: userParts[1].trim() };
}

export function buildAnalysisMessages(
  whyReportJson: string,
  digest: string,
  verbatim: string[],
): { role: "system" | "user"; content: string }[] {
  const { system, user } = parsePromptFile(loadPromptFile("analysis.md"));
  let content = user.replace("<WHY_REPORT>", whyReportJson).replace("<DIGEST>", digest);
  for (let i = 0; i < 3; i++) {
    content = content.replace(`<VERBATIM_${i + 1}>`, verbatim[i] ?? "");
  }
  return [
    { role: "system", content: system },
    { role: "user", content },
  ];
}

export function buildGenerationMessages(
  analysisContent: string,
): { role: "system" | "user"; content: string }[] {
  const { system, user } = parsePromptFile(loadPromptFile("generation.md"));
  return [
    { role: "system", content: system },
    { role: "user", content: user.replace("<ROOT_CAUSE_RESULT>", analysisContent) },
  ];
}

export function extractJsonObject(content: string): unknown {
  let c = content.trim();
  if (c.startsWith("```")) {
    c = c.replace(/^```(?:json)?\s*|\s*```$/g, "");
  }
  const start = c.indexOf("{");
  const end = c.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new CoachError("LLM_PARSE", `no JSON object in content: ${c.slice(0, 120)}`);
  }
  try {
    return JSON.parse(c.slice(start, end + 1));
  } catch {
    throw new CoachError("LLM_PARSE", `invalid JSON: ${c.slice(start, end + 1).slice(0, 120)}`);
  }
}

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1/chat/completions";

export function createLlmClient(
  fetchImpl: typeof fetch = fetch,
  apiKey?: string,
): LlmClient {
  const key = apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  if (!key) {
    return async () => {
      throw new CoachError("LLM_CONFIG", "DEEPSEEK_API_KEY is not set");
    };
  }
  const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL;

  return async (messages, opts = {}) => {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: opts.maxTokens ?? 16000,
      response_format: { type: "json_object" },
    };
    if (opts.thinkingOff) body.thinking = { type: "disabled" };

    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetchImpl(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(300_000),
        });
        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) {
            await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
            continue;
          }
          throw new CoachError("LLM_HTTP", `DeepSeek HTTP ${res.status}: ${await res.text()}`);
        }
        const data = (await res.json()) as {
          choices: { message: { content: string } }[];
          usage: { prompt_tokens: number; completion_tokens: number };
        };
        const content = data.choices[0]?.message?.content ?? "";
        if (!content) {
          throw new CoachError("LLM_EMPTY", "empty content from model (reasoning budget?)");
        }
        return {
          content,
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          },
        };
      } catch (e) {
        if (e instanceof CoachError && e.code === "LLM_HTTP" && e.message.startsWith("DeepSeek HTTP 5")) {
          lastError = e;
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run src/server/coach/llm.test.ts`
Expected: PASS

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/coach/llm.ts src/server/coach/llm.test.ts src/server/coach/prompts/analysis.md src/server/coach/prompts/generation.md
git commit -m "feat(coach): DeepSeek LLM client with V6 prompts"
```

---

### Task 6: Catalog + quota services (server)

**Files:**
- Create: `src/server/coach/catalog.ts`, `src/server/coach/quota.ts`
- Test: `src/server/coach/catalog.test.ts`, `src/server/coach/quota.test.ts`

**Interfaces:**
- Consumes: `passages`, `coachQuota` from `#/server/db/schema`; `db` from `#/server/db`; `GateResult` from `#/domain/coach/gate`; `MechanismKey` from `#/domain/coach/mechanisms`.
- Produces:
  - `export type PassageRecord = { id: string; title: string; topic: string; difficulty: string; mechanisms: MechanismKey[]; triggerTargets: Record<string, number> | null; measuredDensity: Record<string, number> | null; qualityGate: GateResult; text: string; wordCount: number; paragraphs: number; source: string; status: string; targetKey: string; usageCount: number }`
  - `export function targetKeyFor(mechanisms: MechanismKey[], difficulty: string): string` — md5 of `sortedMechanisms.join("|") + "#" + difficulty`.
  - `export async function findPassage(tx: Database, targetKey: string, topic: string, difficulty: string): Promise<PassageRecord | null>`
  - `export async function insertPassage(tx: Database, passage: Omit<PassageRecord, "id" | "usageCount" | "status">): Promise<PassageRecord>`
  - `export async function incrementUsage(tx: Database, passageId: string): Promise<void>`
  - `export async function coachQuotaUsed(tx: Database, userId: string, date: string): Promise<number>`
  - `export async function incrementQuota(tx: Database, userId: string, date: string): Promise<void>` — UPSERT.
  - `export function utcDateString(now: Date = new Date()): string` — `YYYY-MM-DD` in UTC.

- [ ] **Step 1: Write the failing tests**

`src/server/coach/catalog.test.ts` (pure function test — md5 + key stability):

```ts
import { describe, expect, it } from "vitest";
import { targetKeyFor } from "./catalog";

describe("targetKeyFor", () => {
  it("is stable regardless of mechanism order", () => {
    expect(targetKeyFor(["cross-hand", "row-cross"], "hard")).toBe(
      targetKeyFor(["row-cross", "cross-hand"], "hard"),
    );
  });
  it("differs by difficulty", () => {
    expect(targetKeyFor(["cross-hand"], "hard")).not.toBe(targetKeyFor(["cross-hand"], "easy"));
  });
});
```

`src/server/coach/quota.test.ts` (pure function test):

```ts
import { describe, expect, it } from "vitest";
import { utcDateString } from "./quota";

describe("utcDateString", () => {
  it("formats UTC date", () => {
    expect(utcDateString(new Date("2026-08-04T23:30:00Z"))).toBe("2026-08-04");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/server/coach/catalog.test.ts src/server/coach/quota.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

`src/server/coach/catalog.ts`:

```ts
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Database } from "#/server/db";
import { passages } from "#/server/db/schema";
import type { GateResult } from "#/domain/coach/gate";
import type { MechanismKey } from "#/domain/coach/mechanisms";

export type PassageRecord = {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  mechanisms: MechanismKey[];
  triggerTargets: Record<string, number> | null;
  measuredDensity: Record<string, number> | null;
  qualityGate: GateResult;
  text: string;
  wordCount: number;
  paragraphs: number;
  source: string;
  status: string;
  targetKey: string;
  usageCount: number;
};

export function targetKeyFor(mechanisms: MechanismKey[], difficulty: string): string {
  const canonical = [...mechanisms].sort().join("|");
  return createHash("md5").update(`${canonical}#${difficulty}`).digest("hex");
}

export async function findPassage(
  tx: Database,
  targetKey: string,
  topic: string,
  difficulty: string,
): Promise<PassageRecord | null> {
  const rows = await tx
    .select()
    .from(passages)
    .where(
      and(
        eq(passages.targetKey, targetKey),
        eq(passages.topic, topic),
        eq(passages.difficulty, difficulty),
        eq(passages.status, "active"),
      ),
    )
    .limit(1);
  return (rows[0] as PassageRecord | undefined) ?? null;
}

export async function insertPassage(
  tx: Database,
  passage: Omit<PassageRecord, "id" | "usageCount" | "status">,
): Promise<PassageRecord> {
  const [row] = await tx
    .insert(passages)
    .values({
      title: passage.title,
      topic: passage.topic,
      difficulty: passage.difficulty,
      mechanisms: passage.mechanisms,
      triggerTargets: passage.triggerTargets,
      measuredDensity: passage.measuredDensity,
      qualityGate: passage.qualityGate,
      text: passage.text,
      wordCount: passage.wordCount,
      paragraphs: passage.paragraphs,
      source: passage.source,
      targetKey: passage.targetKey,
    })
    .onConflictDoNothing({
      target: [passages.targetKey, passages.topic, passages.difficulty],
    })
    .returning();
  return row as PassageRecord;
}

export async function incrementUsage(tx: Database, passageId: string): Promise<void> {
  await tx
    .update(passages)
    .set({ usageCount: passages.usageCount + 1 })
    .where(eq(passages.id, passageId));
}
```

`src/server/coach/quota.ts`:

```ts
import { eq } from "drizzle-orm";
import type { Database } from "#/server/db";
import { coachQuota } from "#/server/db/schema";

export const DAILY_COACH_LIMIT = 1;

export function utcDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function coachQuotaUsed(tx: Database, userId: string, date: string): Promise<number> {
  const [row] = await tx
    .select({ sessionsUsed: coachQuota.sessionsUsed })
    .from(coachQuota)
    .where(eq(coachQuota.userId, userId));
  return row?.sessionsUsed ?? 0;
}

export async function incrementQuota(tx: Database, userId: string, date: string): Promise<void> {
  await tx
    .insert(coachQuota)
    .values({ userId, date, sessionsUsed: 1 })
    .onConflictDoUpdate({
      target: [coachQuota.userId, coachQuota.date],
      set: { sessionsUsed: coachQuota.sessionsUsed + 1 },
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/server/coach/catalog.test.ts src/server/coach/quota.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/server/coach/catalog.ts src/server/coach/catalog.test.ts src/server/coach/quota.ts src/server/coach/quota.test.ts
git commit -m "feat(coach): passage catalog and daily quota services"
```

---

### Task 7: Coach session orchestrator (server)

**Files:**
- Create: `src/server/coach.ts`
- Create: `src/server/coach/prompts/digest.ts` (or fold into coach.ts — keep in `coach.ts` if < 200 lines)
- Modify: `src/server/coach/llm.ts` (no change needed — reuses exports)

**Interfaces:**
- Consumes: `db` from `#/server/db`; `auth` from `./auth`; `getRequest` from `@tanstack/react-start/server`; `keyboardProfiles`, `sessions`, `keystrokeEvents` from `#/server/db/schema`; `SOFLE_BASE_LAYER`/`LILY58_BASE_LAYER` from `#/domain/finger/*`; `computeWhyReport`, `WhyReport` from `#/domain/coach/whyReport`; `profileText` + `BASELINE_PROFILE` from `#/domain/coach/triggerDensity`; `evaluateGate` from `#/domain/coach/gate`; `targetKeyFor`, `findPassage`, `insertPassage`, `incrementUsage` from `./coach/catalog`; `coachQuotaUsed`, `incrementQuota`, `DAILY_COACH_LIMIT`, `utcDateString` from `./coach/quota`; `createLlmClient`, `buildAnalysisMessages`, `buildGenerationMessages`, `extractJsonObject`, `CoachError` from `./coach/llm`; `computeStats` and `HESITATION_MULTIPLIER`/`PHASE_BASELINES` from `#/domain/stats/*`; `KeyboardLayout` from `#/domain/finger/types`.
- Produces (server fn):
  - `export const getCoachSession = createServerFn({ method: "POST" }).inputValidator(getCoachSessionSchema).handler(...)`
  - `getCoachSessionSchema = z.object({ keyboardProfileId: z.string().uuid() })`
  - Response shape: `{ quota: { usedToday: number; remaining: number }; report: WhyReport; passage: PassageRecord }` — or throws `CoachError`-style errors surfaced as HTTP 402 (quota exceeded) / 503 (LLM unavailable) with `{ error: { code, message } }` body.

Flow inside the handler:
1. Auth via `auth.api.getSession({ headers })` — throw 401 if absent.
2. Load the profile (belongs to user) → `layout = profile.keyboardType as KeyboardLayout`, `fingerTable = layout === "sofle" ? SOFLE_BASE_LAYER : LILY58_BASE_LAYER`.
3. Load the user's recent events: last 50 sessions' keystroke events (join `sessions` on user + profile, `ORDER BY started_at DESC LIMIT 50`, then `keystrokeEvents` for those session ids).
4. `report = computeWhyReport(events, fingerTable)`; pick top 3 mechanisms by count (non-alpha dropped) → `mechanisms`.
5. `today = utcDateString()`; `used = await coachQuotaUsed(db, userId, today)`; if `used >= DAILY_COACH_LIMIT` → 402.
6. Build the compact digest string for the LLM: per-character and per-bigram aggregates (reuse `computeStats`-style aggregation over the events — compute attempts/errors/avgMs per char and per prev+target bigram, top 60; plus totals). If `report.totalTrueConfusions < 20`, use a MINIMAL digest (see below) — small data degrades the LLM analysis.
7. `targetKey = targetKeyFor(mechanisms, difficulty)` for difficulty = "hard" (MVP serves one difficulty; catalog retains the column for future).
8. Try `findPassage(db, targetKey, topic="general", "hard")`; if found → serve (skip LLM).
9. Miss → `llm = createLlmClient()`; call A: `buildAnalysisMessages(...)` (thinking ON, maxTokens 16000) → parse analysis JSON via `extractJsonObject`; extract `priority_order` + `root_causes`; pick topic for the passage from analysis `suggested_topics[0]`.
10. Call B: `buildGenerationMessages(analysisContent)` with `{ thinkingOff: true, maxTokens: 16000 }` → parse `test_cases[0]`.
11. Gate: `evaluateGate(mechanism, text, fingerTable)` — if not passed, retry call B up to 2 more times (each retry re-submits the same generation prompt); if still failing, throw 503 with `COACH_GATE` code.
12. Persist: `insertPassage` + `incrementQuota` + `incrementUsage` in one transaction.
13. Return `{ quota, report, passage }`.

Digest construction (`buildLlmDigest(events)` — pure, exported for tests): returns a JSON string with `user_profile` (totals), `character_stats` (top 35 by attempts), `bigram_stats` (top 80 by attempts), `worst_bigrams` (top 25 by error rate, min 60 attempts), `confusions` (top 20), `position_patterns`, `monthly_trend` (group by `YYYY-MM` of session start). MINIMAL fallback when `totalTrueConfusions < 20`: `user_profile` + `character_stats` only.

- [ ] **Step 1: Write the failing tests**

Create `src/server/coach.test.ts` — server-fn orchestration is integration-heavy; test the pure digest builder:

```ts
import { describe, expect, it } from "vitest";
import { buildLlmDigest } from "./coach";
import type { KeystrokeEvent } from "#/domain/stats/types";

const ev = (over: Partial<KeystrokeEvent>): KeystrokeEvent => ({
  sessionId: "s", sequence: 0, targetChar: "e", actualChar: "e",
  isError: false, keystrokeMs: 100, prevChar: "a", positionInWord: 1, isRetype: false, ...over,
});

describe("buildLlmDigest", () => {
  it("renders a compact JSON digest with profile and stats", () => {
    const events = [
      ev({ sequence: 0, targetChar: "e", prevChar: null }),
      ev({ sequence: 1, targetChar: "s", prevChar: "e" }),
      ev({ sequence: 2, targetChar: "t", actualChar: "r", isError: true, prevChar: "s" }),
    ];
    const digest = JSON.parse(buildLlmDigest(events));
    expect(digest.user_profile.keystrokes).toBe(3);
    expect(digest.character_stats.length).toBeGreaterThan(0);
    expect(digest.worst_bigrams).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/server/coach.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

`src/server/coach.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "./auth";
import { db } from "./db";
import { keyboardProfiles, sessions, keystrokeEvents } from "./db/schema";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { LILY58_BASE_LAYER } from "#/domain/finger/lily58";
import type { KeyboardLayout, FingerTable } from "#/domain/finger/types";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { computeWhyReport, type WhyReport } from "#/domain/coach/whyReport";
import { evaluateGate } from "#/domain/coach/gate";
import { HESITATION_MULTIPLIER, PHASE_BASELINES } from "#/domain/stats/baselines";
import {
  targetKeyFor, findPassage, insertPassage, incrementUsage, type PassageRecord,
} from "./coach/catalog";
import {
  coachQuotaUsed, incrementQuota, DAILY_COACH_LIMIT, utcDateString,
} from "./coach/quota";
import {
  createLlmClient, buildAnalysisMessages, buildGenerationMessages,
  extractJsonObject, CoachError,
} from "./coach/llm";

const RECENT_SESSION_LIMIT = 50;
const TOP_MECHANISMS = 3;

export const getCoachSessionSchema = z.object({
  keyboardProfileId: z.string().uuid(),
});

type CoachResponse = {
  quota: { usedToday: number; remaining: number };
  report: WhyReport;
  passage: PassageRecord;
};

function fingerTableFor(layout: KeyboardLayout): FingerTable {
  return layout === "sofle" ? SOFLE_BASE_LAYER : LILY58_BASE_LAYER;
}

function phaseBaselineFor(phase: string) {
  return phase === "refining" ? PHASE_BASELINES.refining : PHASE_BASELINES.transitioning;
}

export function buildLlmDigest(events: KeystrokeEvent[]): string {
  const charAttempts = new Map<string, number>();
  const charErrors = new Map<string, number>();
  const charMs = new Map<string, number[]>();
  const bgAttempts = new Map<string, number>();
  const bgErrors = new Map<string, number>();
  const bgMs = new Map<string, number[]>();
  const confusions = new Map<string, number>();

  for (const e of events) {
    charAttempts.set(e.targetChar, (charAttempts.get(e.targetChar) ?? 0) + 1);
    if (e.isError) charErrors.set(e.targetChar, (charErrors.get(e.targetChar) ?? 0) + 1);
    (charMs.get(e.targetChar) ?? charMs.set(e.targetChar, []).get(e.targetChar)!).push(e.keystrokeMs);
    if (e.prevChar) {
      const bg = e.prevChar + e.targetChar;
      bgAttempts.set(bg, (bgAttempts.get(bg) ?? 0) + 1);
      if (e.isError) bgErrors.set(bg, (bgErrors.get(bg) ?? 0) + 1);
      (bgMs.get(bg) ?? bgMs.set(bg, []).get(bg)!).push(e.keystrokeMs);
    }
    if (e.isError && e.actualChar !== e.targetChar) {
      const k = `${e.targetChar}->${e.actualChar}`;
      confusions.set(k, (confusions.get(k) ?? 0) + 1);
    }
  }

  const avg = (ms: number[]) => (ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0);
  const charStats = [...charAttempts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 35)
    .map(([c, n]) => ({
      char: c,
      attempts: n,
      err_rate: Math.round(((charErrors.get(c) ?? 0) / n) * 10000) / 10000,
      avg_ms: avg(charMs.get(c) ?? []),
    }));
  const bgRows = [...bgAttempts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([bg, n]) => ({
      bigram: bg,
      attempts: n,
      err_rate: Math.round(((bgErrors.get(bg) ?? 0) / n) * 10000) / 10000,
      avg_ms: avg(bgMs.get(bg) ?? []),
    }));
  const worstBigrams = bgRows
    .filter((r) => r.attempts >= 60 && r.err_rate > 0)
    .sort((a, b) => b.err_rate - a.err_rate)
    .slice(0, 25);

  return JSON.stringify({
    user_profile: {
      keystrokes: events.length,
      errors: events.filter((e) => e.isError).length,
      true_confusions: events.filter((e) => e.isError && e.actualChar !== e.targetChar).length,
    },
    character_stats: charStats,
    bigram_stats: bgRows,
    worst_bigrams: worstBigrams,
    confusions: [...confusions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k, n]) => ({ pair: k, count: n })),
  });
}

export const getCoachSession = createServerFn({ method: "POST" })
  .inputValidator(getCoachSessionSchema)
  .handler(async ({ data }): Promise<CoachResponse> => {
    const request = getRequest();
    const authSession = await auth.api.getSession({ headers: request.headers });
    if (!authSession) throw new CoachError("UNAUTHORIZED", "not signed in");
    const userId = authSession.user.id;

    const [profile] = await db
      .select({ id: keyboardProfiles.id, keyboardType: keyboardProfiles.keyboardType })
      .from(keyboardProfiles)
      .where(and(eq(keyboardProfiles.id, data.keyboardProfileId), eq(keyboardProfiles.userId, userId)))
      .limit(1);
    if (!profile) throw new CoachError("PROFILE_NOT_FOUND", "profile not found");

    const layout = profile.keyboardType as KeyboardLayout;
    const fingerTable = fingerTableFor(layout);

    const recent = await db
      .select({ id: sessions.id, startedAt: sessions.startedAt, phase: sessions.phaseAtSession })
      .from(sessions)
      .where(and(eq(sessions.userId, userId), eq(sessions.keyboardProfileId, profile.id)))
      .orderBy(sessions.startedAt, "desc")
      .limit(RECENT_SESSION_LIMIT);
    const sessionIds = recent.map((s) => s.id);
    const events = sessionIds.length
      ? ((await db
          .select()
          .from(keystrokeEvents)
          .where(inArray(keystrokeEvents.sessionId, sessionIds))) as KeystrokeEvent[])
      : [];

    const report = computeWhyReport(events, fingerTable);
    const topMechanisms = report.mechanisms
      .filter((m) => m.mechanism !== "non-alpha")
      .slice(0, TOP_MECHANISMS)
      .map((m) => m.mechanism);
    if (topMechanisms.length === 0) {
      throw new CoachError("INSUFFICIENT_DATA", "not enough typing data yet");
    }

    const today = utcDateString();
    const usedToday = await coachQuotaUsed(db, userId, today);
    if (usedToday >= DAILY_COACH_LIMIT) {
      throw new CoachError("QUOTA_EXCEEDED", `daily coach limit reached (${DAILY_COACH_LIMIT})`);
    }

    const difficulty = "hard";
    const targetKey = targetKeyFor(topMechanisms, difficulty);
    const existing = await findPassage(db, targetKey, "general", difficulty);
    if (existing) {
      await db.transaction(async (tx) => {
        await incrementUsage(tx, existing.id);
        await incrementQuota(tx, userId, today);
      });
      return {
        quota: { usedToday: usedToday + 1, remaining: 0 },
        report,
        passage: existing,
      };
    }

    const digest = buildLlmDigest(events);
    const llm = createLlmClient();
    const analysisMsgs = buildAnalysisMessages(
      JSON.stringify(report),
      digest,
      [
        events.filter((e) => e.sequence < 500).slice(0, 305),
        [],
        [],
      ].map(() => ""), // verbatim sessions are post-MVP; analysis call gets digest + report only
    );
    const analysisRes = await llm(analysisMsgs);
    const analysis = extractJsonObject(analysisRes.content) as {
      suggested_topics?: string[];
      priority_order?: string[];
    };
    const topic = analysis.suggested_topics?.[0] ?? "general knowledge";

    let gateResult;
    let passageText = "";
    let generationRaw = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const genMsgs = buildGenerationMessages(analysisRes.content);
      const genRes = await llm(genMsgs, { thinkingOff: true });
      generationRaw = genRes.content;
      const gen = extractJsonObject(generationRaw) as {
        test_cases?: { mechanism?: string; title?: string; topic?: string; text?: string }[];
      };
      const tc = gen.test_cases?.[0];
      if (!tc?.text) throw new CoachError("LLM_PARSE", "generation missing test_cases[0].text");
      passageText = tc.text;
      const mech = (tc.mechanism ?? topMechanisms[0]) as (typeof topMechanisms)[number];
      gateResult = evaluateGate(mech, passageText, fingerTable);
      if (gateResult.passed) break;
    }
    if (!gateResult?.passed) {
      throw new CoachError("GATE_REJECTED", `passage failed gate: ${gateResult?.violations.join("; ")}`);
    }

    const parsed = extractJsonObject(generationRaw) as {
      test_cases?: { mechanism?: string; title?: string; topic?: string; text?: string }[];
    };
    const tc = parsed.test_cases?.[0];
    const passage = {
      title: tc?.title ?? "Coach passage",
      topic: tc?.topic ?? topic,
      difficulty,
      mechanisms: topMechanisms,
      triggerTargets: null,
      measuredDensity: gateResult.measured as unknown as Record<string, number>,
      qualityGate: gateResult,
      text: passageText,
      wordCount: passageText.split(/\s+/).filter(Boolean).length,
      paragraphs: Math.min((passageText.match(/\n\n/g)?.length ?? 0) + 1, 3),
      source: "ai:deepseek-v4-flash:v6",
      targetKey,
    } satisfies Omit<PassageRecord, "id" | "usageCount" | "status">;

    let passageId: string;
    await db.transaction(async (tx) => {
      const inserted = await insertPassage(tx, passage);
      passageId =
        inserted?.id ??
        (await findPassage(tx, passage.targetKey, passage.topic, passage.difficulty))!.id;
      await incrementQuota(tx, userId, today);
      await incrementUsage(tx, passageId);
    });

    return {
      quota: { usedToday: usedToday + 1, remaining: 0 },
      report,
      passage: { ...passage, id: passageId, usageCount: 1, status: "active" } as PassageRecord,
    };
  });
```

Note: the `[].map` verbatim placeholder above is intentional — verbatim session text is omitted in MVP (the digest carries the stats); the prompt files' `<VERBATIM_1..3>` placeholders get replaced with the empty string by `buildAnalysisMessages`. The orchestrator keeps the call count at 2 (analysis + generation). Remove the verbatim block comment when verbatim support is added post-MVP.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/server/coach.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the error mapping**

Add to `src/server/coach.ts` (bottom):

```ts
export function coachErrorStatus(code: string): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "QUOTA_EXCEEDED":
      return 402;
    case "INSUFFICIENT_DATA":
      return 422;
    default:
      return 503;
  }
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/server/coach.ts src/server/coach.test.ts
git commit -m "feat(coach): getCoachSession orchestrator (why-report + catalog + LLM + gate)"
```

---

### Task 8: persistSession passage_id + mode "coach"

**Files:**
- Modify: `src/server/persistSessionHelpers.ts` (MODES set + `passageId` in input type/validator)
- Modify: `src/server/persistSession.ts` (write `passageId`)

**Interfaces:**
- Consumes: `getCoachSession` response passage id (client passes it back); `passages` table.
- Produces: `validatePersistSessionInput` accepts `mode: "coach"` and optional `passageId: string | null`; the session row stores `passage_id`. The exported `PersistSessionInput` type gains `passageId?: string | null` so `persistSessionWithRetry` callers typecheck.

- [ ] **Step 1: Extend the MODES set**

In `src/server/persistSessionHelpers.ts` line 64:

```ts
const MODES = new Set(["adaptive", "targeted_drill", "diagnostic", "coach"]);
```

- [ ] **Step 2: Add passageId to the input type and validator**

Find the `PersistSessionInput` type in the same file and add the field:

```ts
export type PersistSessionInput = {
  sessionId: string;
  keyboardProfileId: string;
  mode: string;
  phase: string;
  target: string;
  startedAt: string;
  endedAt: string;
  events: KeystrokeEventDto[];
  filterConfig?: Record<string, unknown> | null;
  sessionTarget?: {
    type: string;
    value: string;
    keys: string[];
    label: string;
    selectionScore: string | number | null;
    declaredAt: string;
    attempts: number;
    errors: number;
    accuracy: number | null;
  } | null;
  passageId?: string | null;
};
```

In `validatePersistSessionInput`, after the `phase` validation block (line ~103):

```ts
  let passageId: string | null = null;
  if (i.passageId !== undefined && i.passageId !== null) {
    passageId = requireUuid("passageId");
  }
```

And include `passageId` in the returned validated object (where `sessionId`, `keyboardProfileId`, etc. are returned).

- [ ] **Step 3: Write the session row with passageId**

In `src/server/persistSession.ts`, add to the insert values:

```ts
          passageId: data.passageId ?? null,
```

(placed after `filterConfig: data.filterConfig,`)

- [ ] **Step 4: Tests + typecheck**

Run: `pnpm vitest run src/server/persistSessionHelpers.test.ts && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/server/persistSessionHelpers.ts src/server/persistSession.ts
git commit -m "feat(coach): persist coach sessions with passage_id"
```

---

### Task 9: Coach route (frontend)

**Files:**
- Create: `src/routes/practice_.coach.tsx`
- Create: `src/components/coach/CoachPreSessionStage.tsx`, `src/components/coach/CoachPostSessionStage.tsx`
- Modify: `src/routes/practice.tsx` (entry card — Task 10)
- Test: `src/components/coach/CoachPreSessionStage.test.tsx`

**Interfaces:**
- Consumes: `getCoachSession` from `#/server/coach` (server fn); `ActiveSessionStage` from `#/components/practice` with props `{ keyboardType, showKeyboard, expectedLetterHint, capture, typingSize, targetKeys?, isFirstSession? }`; `PauseOverlay`, `ShortcutHints` from `#/components/practice`; `useSessionStore` from `#/stores/sessionStore` (dispatch `{ type: "start", target, now, targetKeys: [] }` to begin, `status` for completion); `persistSessionWithRetry` from `#/lib/persistSessionWithRetry`; `useIdleAutoPause`, `useBeforeUnloadWarning`, `useOtherTabActive` (mirror `practice_.drill.tsx` usage); `getAuthSession` + `noindexHead`; `getActiveProfile` from `#/server/profile`; `summarizeSession` from `#/domain/session/summarize`; `PauseSettings` + `PresetKey` types from `#/components/practice`.
- Produces:
  - Route `/practice/coach` with search params `{}`; screens: loading → pre-session (why-report + quota state) → typing → post-session summary.
  - `CoachPreSessionStage` props: `{ report: WhyReport; quota: { usedToday: number; remaining: number }; onStart: () => void }`.

- [ ] **Step 1: Write the failing component test**

`src/components/coach/CoachPreSessionStage.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachPreSessionStage } from "./CoachPreSessionStage";
import type { WhyReport } from "#/domain/coach/whyReport";

const report: WhyReport = {
  totalTrueConfusions: 100,
  mechanisms: [
    {
      mechanism: "space/timing",
      count: 40,
      sharePct: 40,
      avgMs: 327,
      p95Ms: 520,
      topConfusions: [{ target: "e", typedAs: " ", count: 5 }],
      topBigrams: [{ bigram: "t ", count: 3 }],
    },
  ],
};

describe("CoachPreSessionStage", () => {
  it("renders the top mechanism with its share and timing", () => {
    render(
      <CoachPreSessionStage report={report} quota={{ usedToday: 0, remaining: 1 }} onStart={() => {}} />,
    );
    expect(screen.getByText(/space\/timing/i)).toBeTruthy();
    expect(screen.getByText(/40%/i)).toBeTruthy();
  });

  it("shows quota exhaustion state", () => {
    render(
      <CoachPreSessionStage report={report} quota={{ usedToday: 1, remaining: 0 }} onStart={() => {}} />,
    );
    expect(screen.getByText(/come back tomorrow/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/components/coach/CoachPreSessionStage.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the component**

`src/components/coach/CoachPreSessionStage.tsx`:

```tsx
import type { WhyReport } from "#/domain/coach/whyReport";

type Props = {
  report: WhyReport;
  quota: { usedToday: number; remaining: number };
  onStart: () => void;
};

export function CoachPreSessionStage({ report, quota, onStart }: Props) {
  const top = report.mechanisms[0];
  const exhausted = quota.remaining <= 0;

  return (
    <section className="kerf-coach-pre" aria-label="Coach session briefing">
      <h2 className="kerf-coach-title">Coach</h2>
      <p className="kerf-coach-subtitle">
        One personalized session per day. Based on your last {report.totalTrueConfusions} slips.
      </p>

      {top ? (
        <div className="kerf-coach-brief">
          <p className="kerf-coach-mechanism">
            <strong>{top.mechanism}</strong> — {top.sharePct}% of your slips,
            averaging {top.avgMs}ms per keystroke.
          </p>
          {top.topConfusions[0] && (
            <p className="kerf-coach-detail">
              Most common: typed <code>{top.topConfusions[0].typedAs}</code> instead of{" "}
              <code>{top.topConfusions[0].target}</code> ({top.topConfusions[0].count} times).
            </p>
          )}
        </div>
      ) : (
        <p className="kerf-coach-mechanism">Not enough data yet to diagnose your typing.</p>
      )}

      {exhausted ? (
        <p className="kerf-coach-quota">You have used today's session. Come back tomorrow.</p>
      ) : (
        <button type="button" className="kerf-btn-primary" onClick={onStart}>
          Start session
        </button>
      )}
    </section>
  );
}
```

Add minimal styles to `src/styles.css` following the `kerf-` class conventions of the existing mode cards (search `kerf-mode-card` and mirror its tokens).

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/components/coach/CoachPreSessionStage.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the route**

`src/routes/practice_.coach.tsx` — mirror `practice_.drill.tsx` exactly for the typing loop (dispatch-start, status effect, PauseOverlay, persist-on-complete with the same event DTO mapping), with these differences: target comes from the fetched passage, mode is `"coach"`, `passageId` is attached to the persist payload, and the pre-session stage is the Coach brief:

```tsx
import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import { noindexHead } from "#/lib/seo-head";
import { getActiveProfile, type KeyboardType, type DominantHand } from "#/server/profile";
import type { TransitionPhase } from "#/domain/profile/initialPhase";
import { getCoachSession } from "#/server/coach";
import type { WhyReport } from "#/domain/coach/whyReport";
import type { PassageRecord } from "#/server/coach/catalog";
import { ActiveSessionStage, PauseOverlay } from "#/components/practice";
import { CoachPreSessionStage } from "#/components/coach/CoachPreSessionStage";
import { CoachPostSessionStage } from "#/components/coach/CoachPostSessionStage";
import { useSessionStore, sessionStore } from "#/stores/sessionStore";
import { useIdleAutoPause } from "#/hooks/useIdleAutoPause";
import { useBeforeUnloadWarning } from "#/hooks/useBeforeUnloadWarning";
import { useOtherTabActive } from "#/hooks/useOtherTabActive";
import { summarizeSession } from "#/domain/session/summarize";
import { flushSessionQueue, persistSessionWithRetry } from "#/lib/persistSessionWithRetry";
import { AppFooter } from "#/components/nav/AppFooter";

type LoadedProfile = {
  id: string;
  keyboardType: KeyboardType;
  dominantHand: DominantHand;
  transitionPhase: TransitionPhase;
};

type Stage = "loading" | "pre" | "typing" | "post" | "error";

export const Route = createFileRoute("/practice/coach")({
  beforeLoad: () => {
    if (!getAuthSession()) throw redirect({ to: "/login" });
  },
  head: () => ({ meta: [...noindexHead()] }),
  component: CoachRoute,
});

function CoachRoute() {
  const navigate = useNavigate();
  const router = useRouter();
  const [profile, setProfile] = useState<LoadedProfile | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [report, setReport] = useState<WhyReport | null>(null);
  const [passage, setPassage] = useState<PassageRecord | null>(null);
  const [quota, setQuota] = useState<{ usedToday: number; remaining: number }>({
    usedToday: 0,
    remaining: 1,
  });
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [pauseSettings] = useState({
    showKeyboard: true,
    expectedLetterHint: true,
    typingSize: "M" as const,
    focusedKeyHint: false,
    preset: undefined as undefined,
  });
  const passageRef = useRef<PassageRecord | null>(null);

  const status = useSessionStore((s) => s.status);
  const sessionState = useSessionStore();

  useEffect(() => {
    getActiveProfile()
      .then(setProfile)
      .catch(() => navigate({ to: "/welcome" }));
  }, [navigate]);

  useEffect(() => {
    if (!profile || stage !== "loading") return;
    getCoachSession({ keyboardProfileId: profile.id })
      .then((res) => {
        setReport(res.report);
        setQuota(res.quota);
        setPassage(res.passage);
        passageRef.current = res.passage;
        setStage(res.quota.remaining > 0 ? "pre" : "error");
        if (res.quota.remaining <= 0) setError("You have used today's session. Come back tomorrow.");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setStage("error");
      });
  }, [profile, stage, navigate]);

  useBeforeUnloadWarning(stage === "typing");
  useOtherTabActive(stage === "typing");
  useIdleAutoPause(stage === "typing");

  const startSession = () => {
    const target = passage?.text ?? "";
    if (!target) return;
    sessionStore.getState().dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
    setPaused(false);
    setStage("typing");
  };

  const restartSamePassage = () => {
    const target = passage?.text ?? "";
    if (!target) return;
    sessionStore.getState().dispatch({ type: "start", target, now: performance.now(), targetKeys: [] });
    setPaused(false);
  };

  // Persist on completion — mirror the drill route's status effect.
  useEffect(() => {
    if (status !== "complete" || stage !== "typing") return;
    const state = sessionStore.getState();
    if (state.completedAt === null || state.startedAt === null || !profile) return;
    const elapsedMs = Math.max(0, state.completedAt - state.startedAt);
    const endedAt = new Date();
    const startedAt = new Date(endedAt.getTime() - elapsedMs);
    const p = passageRef.current;
    void persistSessionWithRetry({
      sessionId: crypto.randomUUID(),
      keyboardProfileId: profile.id,
      mode: "coach",
      phase: profile.transitionPhase,
      target: state.target,
      events: state.events.map((e) => ({
        targetChar: e.targetChar,
        actualChar: e.actualChar,
        isError: e.isError,
        keystrokeMs: e.keystrokeMs,
        prevChar: e.prevChar,
        timestamp: e.timestamp.toISOString(),
      })),
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      filterConfig: { coachPassage: p?.id ?? null },
      passageId: p?.id ?? null,
      sessionTarget: null,
    }).finally(() => {
      void router.invalidate();
    });
  }, [status, stage, profile, router, sessionStore]);

  const finishSession = () => {
    setStage("post");
  };

  // --- render branches (mirror drill route) ---
  if (stage === "typing" && (status === "active" || status === "paused")) {
    const idleAutoPaused = status === "paused" && !paused;
    return (
      <main id="main-content" className="kerf-practice-main kerf-practice-main--active kerf-stage-fade-in">
        <ActiveSessionStage
          keyboardType={profile!.keyboardType}
          showKeyboard={pauseSettings.showKeyboard}
          expectedLetterHint={pauseSettings.expectedLetterHint}
          capture={!paused}
          typingSize={pauseSettings.typingSize}
        />
        {idleAutoPaused && <p className="kerf-idle-chip">Paused — keep typing to resume</p>}
        {paused && (
          <PauseOverlay
            paused={paused}
            onResume={() => setPaused(false)}
            settings={pauseSettings}
            onUpdateSettings={() => {}}
          />
        )}
      </main>
    );
  }

  return (
    <main id="main-content" className="kerf-practice-main kerf-stage-fade-in">
      {stage === "loading" && <p className="kerf-loading">Preparing your session…</p>}
      {stage === "pre" && report && passage && (
        <CoachPreSessionStage report={report} quota={quota} onStart={startSession} />
      )}
      {stage === "post" && (
        <CoachPostSessionStage
          summary={summarizeSession({
            events: sessionStore.getState().events,
            startedAt: sessionStore.getState().startedAt ?? Date.now(),
            endedAt: sessionStore.getState().completedAt ?? Date.now(),
            phase: profile?.transitionPhase ?? "transitioning",
          })}
          onAgain={restartSamePassage}
          onDone={() => {
            sessionStore.getState().dispatch({ type: "reset" });
            setStage("pre");
          }}
        />
      )}
      {stage === "error" && <p className="kerf-error">{error}</p>}
      <AppFooter />
    </main>
  );
}
```

Verify against the drill route at implementation time: `PauseOverlay`'s exact props (the drill route passes `paused`, `onResume`, `settings`, `onUpdateSettings` — confirm the `PauseSettings` shape) and `summarizeSession`'s exact input shape (`src/domain/session/summarize.ts` — the drill route uses `summarizeDrill`; the practice route uses `summarizeSession`, mirror THAT call site). `CoachPostSessionStage` is a thin wrapper around the existing `PostSessionStage`/`DrillPostSessionStage` from `#/components/practice` with flat copy (WPM, accuracy, errors).

- [ ] **Step 6: Verify route registration + typecheck + tests**

Run: `pnpm typecheck && pnpm vitest run src/components/coach`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/routes/practice_.coach.tsx src/components/coach/CoachPreSessionStage.tsx src/components/coach/CoachPreSessionStage.test.tsx src/components/coach/CoachPostSessionStage.tsx src/styles.css
git commit -m "feat(coach): Coach route with why-report, typing, and post-session stages"
```

---

### Task 10: Practice page entry + deploy docs

**Files:**
- Modify: `src/routes/practice.tsx` (add Coach ModeCard)
- Modify: `.env.production.example`, `DEPLOYMENT.md` (DeepSeek env vars)

**Interfaces:**
- Consumes: `ModeCard` from `#/components/practice`.
- Produces: a Coach mode card on the practice pre-session screen that navigates to `/practice/coach`.

- [ ] **Step 1: Add the mode card**

In `src/routes/practice.tsx`, inside the mode-card grid (where the existing Drill card renders), add:

```tsx
<ModeCard
  icon="🎯"
  name="Coach"
  description="One personalized session a day, built around how you actually type"
  onSelect={() => navigate({ to: "/practice/coach" })}
/>
```

Check the existing grid's disabled/`coming soon` usage — Coach is enabled, so no `disabled` prop. If the grid renders two cards today, add Coach as the third. Verify `useNavigate` is already imported in the file.

- [ ] **Step 2: Document env vars**

Append to `.env.production.example`:

```bash
# Coach (AI adaptive) — DeepSeek API. Coach is a paid feature rolled out
# progressively; these are read lazily and only required when Coach is used.
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1/chat/completions
```

Add a "Coach" section to `DEPLOYMENT.md` (runtime env, quota model: 1 session/day/user, catalog table, migration step) following the file's existing structure.

- [ ] **Step 3: Verify**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS (full suite green)

- [ ] **Step 4: Commit**

```bash
git add src/routes/practice.tsx .env.production.example DEPLOYMENT.md
git commit -m "feat(coach): practice page entry card and deployment docs"
```

---

## Self-review notes (run before execution)

- **Spec coverage:** why-report (T1-T2), trigger/gate (T3), catalog+quota schema (T4), LLM client + V6 prompts (T5), catalog/quota services (T6), orchestrator with generate-and-gate retry (T7), persistence attribution (T8), route/UI (T9-T10), env/docs (T10). Billing, prefetch, verbatim-session LLM input, topic personalization, layout-specific baselines, and closed-source prompt extraction are deliberately post-MVP.
- **Type consistency:** `PassageRecord` is the single passage shape across T6/T7/T9. `MechanismKey` flows T1→T2→T3→T7. `GateResult` flows T3→T7. `buildLlmDigest` is exported from `coach.ts` and consumed only by its test. `PersistSessionInput.passageId` is added in T8 and consumed by T9's persist payload.
- **Quota semantics:** charged at serve time (catalog hit or generation), not at session completion; `coach_quota` UPSERT in both paths.
- **Verified against source at plan time:** `MODES` set at `persistSessionHelpers.ts:64` (`["adaptive", "targeted_drill", "diagnostic"]`); validator is hand-rolled (no zod) with `requireUuid`; `ActiveSessionStage` props are `{ keyboardType, showKeyboard, expectedLetterHint, capture, typingSize, targetKeys?, isFirstSession? }`; drill route dispatches `{ type: "start", target, now, targetKeys }` via `sessionStore.getState().dispatch`, persists with event DTOs `{ targetChar, actualChar, isError, keystrokeMs, prevChar, timestamp }`, and composes `PauseOverlay` with `paused/onResume/settings/onUpdateSettings`. Task 9's remaining "verify at implementation time" items: `PauseOverlay`'s `PauseSettings` shape and `summarizeSession`'s exact input (mirror the practice route's call site, not the drill's `summarizeDrill`).
- **Gate thresholds:** cross-hand 1.2x, row-cross 1.1x, same-finger 0.9x, space/timing vowel-init 1.5x, from the PoC validation (REPORT.md §8.3).
- **Known simplification in T7:** verbatim session text is not sent to the LLM in MVP (empty-string placeholders) — the digest carries the stats. Revisit after catalog v1 ships.
