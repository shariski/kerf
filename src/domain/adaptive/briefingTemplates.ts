import type { JourneyCode } from "./journey";
import type { SessionTarget } from "./targetSelection";
import type { TransitionPhase } from "../stats/types";

export type Briefing = { text: string; keys: string[] };

/**
 * Briefing copy templates V1–V7 per ADR-003 §4. Journey-specific for
 * vertical-column and inner-column; shared for thumb-cluster, hand-
 * isolation, cross-hand-bigram, character, bigram, diagnostic.
 *
 * Every string self-checks against CLAUDE.md §B3: no hype, no verdict,
 * no declared pass/fail thresholds, quietly affirming tone.
 */

type FingerLabel = "pinky" | "ring" | "middle" | "index";

function fingerFromColumnValue(value: string): FingerLabel {
  if (value.includes("pinky")) return "pinky";
  if (value.includes("ring")) return "ring";
  if (value.includes("middle")) return "middle";
  return "index";
}

function v1Vertical(target: SessionTarget, journey: JourneyCode): string {
  const topKey = target.keys[0] ?? "?";
  const homeKey = target.keys[1] ?? "?";
  const bottomKey = target.keys[2] ?? "?";
  const finger = fingerFromColumnValue(target.value);
  if (journey === "columnar") {
    return (
      `Column practice — ${finger}, keys ${topKey.toUpperCase()} ${homeKey.toUpperCase()} ${bottomKey.toUpperCase()}.\n` +
      `Clean vertical transitions build the finger's sense of its own column.\n` +
      `Focus on smoothness, not speed.`
    );
  }
  return (
    `Your ${finger} column runs vertical on this board: ${topKey.toUpperCase()} on top, ${homeKey.toUpperCase()} on home, ${bottomKey.toUpperCase()} below.\n` +
    `Row-staggered muscle memory expects diagonal reach — columnar boards want straight vertical motion.\n` +
    `This session trains the shift.`
  );
}

function v2Inner(target: SessionTarget, journey: JourneyCode): string {
  const keys = target.keys.map((k) => k.toUpperCase()).join(", ");
  if (journey === "columnar") {
    return (
      `Inner column reach — ${keys}.\n` +
      `The stretch from home row into the inner column is where new columnar fingers build memory.\n` +
      `Take your time; clean reaches count more than fast ones.`
    );
  }
  return (
    `Inner column focus — ${keys}.\n` +
    `These are a stretch for your index finger on any keyboard; the split gap makes them less forgiving.\n` +
    `Accuracy leads, speed follows.`
  );
}

function v3Thumb(): string {
  return (
    `Short words, lots of spaces.\n` +
    `Your thumb is learning a new job — activating the space key without pulling your hand out of position.\n` +
    `Notice how your thumb feels after each word.`
  );
}

function v4HandIsolation(target: SessionTarget): string {
  const hand = target.value.includes("left") ? "left" : "right";
  return (
    `This session isolates your ${hand} hand — the other hand stays at rest.\n` +
    `Isolated practice trains clean hand separation: each hand moves on its own.\n` +
    `Watch for your resting hand creeping toward the keys.`
  );
}

function v5CrossHand(): string {
  return (
    `Cross-hand transitions — key pairs where one hand hands off to the other.\n` +
    `Smooth hand-to-hand bigrams are the foundation of flow.\n` +
    `When one hand lags, the other waits.`
  );
}

function v6Character(target: SessionTarget): string {
  const t = target.value.toUpperCase();
  return (
    `This session leans on ${t} — one of your current weaknesses.\n` +
    `The words you'll type are weighted to give ${t} extra reps.\n` +
    `Accuracy on ${t} is what we're watching.`
  );
}

function v7Diagnostic(): string {
  return (
    `Capturing your baseline on this split keyboard.\n` +
    `No specific focus yet — we'll build the plan from what this session reveals.\n` +
    `Type naturally; don't over-think accuracy.`
  );
}

export function buildBriefing(
  target: SessionTarget,
  journey: JourneyCode,
  _phase: TransitionPhase,
): Briefing {
  let text: string;
  switch (target.type) {
    case "vertical-column":
      text = v1Vertical(target, journey);
      break;
    case "inner-column":
      text = v2Inner(target, journey);
      break;
    case "thumb-cluster":
      text = v3Thumb();
      break;
    case "hand-isolation":
      text = v4HandIsolation(target);
      break;
    case "cross-hand-bigram":
      text = v5CrossHand();
      break;
    case "character":
    case "bigram":
      text = v6Character(target);
      break;
    case "diagnostic":
      text = v7Diagnostic();
      break;
  }
  return { text, keys: target.keys };
}
