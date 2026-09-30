import type { MechanismKey } from "./mechanisms";

const COPY: Record<MechanismKey, { label: string; tip: string }> = {
  "space/timing": {
    label: "spacing and timing",
    tip: "Give each word boundary a deliberate space before moving on.",
  },
  "same-finger": {
    label: "same-finger moves",
    tip: "Let one key finish before that finger moves to the next.",
  },
  "adjacent-finger": {
    label: "nearby fingers",
    tip: "Notice which nearby finger should press the next key.",
  },
  "row-cross": {
    label: "moving between rows",
    tip: "Notice your hand position when moving to another row.",
  },
  "cross-hand": {
    label: "switching hands",
    tip: "Keep the hand changes steady before increasing speed.",
  },
  "non-alpha": {
    label: "symbols and modifiers",
    tip: "Slow down around symbols and modifiers.",
  },
};

export function coachMechanismCopy(mechanism: MechanismKey) {
  return COPY[mechanism];
}
