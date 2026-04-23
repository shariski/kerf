/**
 * Smoke test for ADR-003 engine-core (Tasks 4–8). Constructs synthetic
 * stats and runs selectTarget under both journeys to show how journey
 * weighting flips the chosen target. No DB, no network, no UI.
 *
 * Run:  npx tsx scripts/demo-target-selection.ts
 */

import { selectTarget } from "../src/domain/adaptive/targetSelection";
import type { ComputedStats, UserBaseline } from "../src/domain/stats/types";

const baseline = (journey: UserBaseline["journey"]): UserBaseline => ({
  meanErrorRate: 0.08,
  meanKeystrokeTime: 280,
  meanHesitationRate: 0.1,
  journey,
});

const freq = (_unit: string) => 0.5; // uniform — keeps comparisons clean

// Synthetic user: weak on inner-column ('g') AND on top-row ('q', 'w').
// Goal: show that conventional journey picks a vertical-column target
// (because of top-row pain) while columnar picks an inner-column target.
const stats: ComputedStats = {
  characters: [
    { character: "g", attempts: 100, errors: 22, sumTime: 30_000, hesitationCount: 5 },
    { character: "t", attempts: 100, errors: 18, sumTime: 30_000, hesitationCount: 4 },
    { character: "b", attempts: 100, errors: 16, sumTime: 30_000, hesitationCount: 4 },
    { character: "q", attempts: 100, errors: 17, sumTime: 30_000, hesitationCount: 3 },
    { character: "w", attempts: 100, errors: 14, sumTime: 30_000, hesitationCount: 3 },
    { character: "a", attempts: 100, errors: 2, sumTime: 28_000, hesitationCount: 0 },
  ],
  bigrams: [],
};

const lowConfidenceStats: ComputedStats = {
  characters: [{ character: "g", attempts: 2, errors: 1, sumTime: 500, hesitationCount: 0 }],
  bigrams: [],
};

console.log("──────── ADR-003 selectTarget smoke test ────────\n");

for (const journey of ["conventional", "columnar", "unsure"] as const) {
  const target = selectTarget(stats, baseline(journey), "transitioning", freq);
  console.log(`journey: ${journey.padEnd(13)} → ${target.type.padEnd(16)} value=${target.value.padEnd(14)} score=${target.score?.toFixed(3) ?? "—"}`);
  console.log(`  label : ${target.label}`);
  console.log(`  keys  : [${target.keys.join(", ")}]\n`);
}

console.log("──── low-confidence fallback ────");
const dx = selectTarget(lowConfidenceStats, baseline("conventional"), "transitioning", freq);
console.log(`(2 attempts on 'g', below threshold)`);
console.log(`→ ${dx.type} value=${dx.value} label="${dx.label}" keys=[${dx.keys.join(", ")}]\n`);

console.log("──── refining phase: same data, no journey bonus ────");
const refConv = selectTarget(stats, baseline("conventional"), "refining", freq);
const refCol = selectTarget(stats, baseline("columnar"), "refining", freq);
console.log(`conventional → ${refConv.type}/${refConv.value} score=${refConv.score?.toFixed(3) ?? "—"}`);
console.log(`columnar     → ${refCol.type}/${refCol.value} score=${refCol.score?.toFixed(3) ?? "—"}`);
