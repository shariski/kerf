import { DECAY_WINDOW_DAYS } from "./baselines";
import type { KeystrokeEvent, WeightedKeystrokeEvent } from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Linear decay: an event at asOf has weight 1.0; an event at or beyond
 * DECAY_WINDOW_DAYS old has weight 0.0; in between, weight ramps
 * linearly. Future-dated events (clock skew) get full weight rather
 * than being clamped negative.
 */
export function decayWeight(eventAt: Date, asOf: Date): number {
  const ageDays = (asOf.getTime() - eventAt.getTime()) / MS_PER_DAY;
  if (ageDays <= 0) return 1;
  if (ageDays >= DECAY_WINDOW_DAYS) return 0;
  return 1 - ageDays / DECAY_WINDOW_DAYS;
}

/** Returns a parallel array of events with decay weights attached.
 * Inputs are not mutated. */
export function decayStats(events: KeystrokeEvent[], asOf: Date): WeightedKeystrokeEvent[] {
  return events.map((e) => ({ ...e, weight: decayWeight(e.timestamp, asOf) }));
}
