/**
 * Seeded PRNG for deterministic adaptive-engine tests.
 *
 * mulberry32 — 32-bit, ~2^32 period, good statistical distribution for
 * our use (weighted sampling over ~10k words, a few hundred draws per
 * exercise). Not cryptographic. The entire point is that the same seed
 * yields the same exercise, so test assertions about "which word gets
 * picked" stay stable across machines and runs.
 *
 * Credit: Tommy Ettinger / public domain. ~5 lines, no dep.
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
