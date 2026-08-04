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
 * Correction/retype events (actual === target) are noise.
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
    if (!e.isError || e.actualChar === e.targetChar) continue;
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
      ? (msSorted[Math.min(msSorted.length - 1, Math.floor(msSorted.length * 0.95))] ?? 0)
      : 0;
    const topConfusions = [...c.confusions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k, n]) => {
        const [target = "", typedAs = ""] = k.split("\u0000");
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
