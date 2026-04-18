import type { FingerTable } from "./types";

/**
 * Lily58 base layer — alphanumeric + common punctuation + space.
 *
 * Row convention matches sofle.ts. Lily58 has a 3-key thumb cluster per
 * side (vs Sofle's 4) but the alpha base layer follows the same QWERTY
 * columnar mapping; differences are in modifier/symbol layers, not here.
 *
 * Source: standard touch-typing convention applied to Lily58's columnar
 * stagger. Must be validated against the developer's physical Lily58
 * before being treated as ground truth — see docs/03-task-breakdown.md §1.1.
 */
export const LILY58_BASE_LAYER: FingerTable = {
  // Row 0 — number row
  "1": { hand: "left", finger: "pinky", row: 0, col: 0 },
  "2": { hand: "left", finger: "ring", row: 0, col: 1 },
  "3": { hand: "left", finger: "middle", row: 0, col: 2 },
  "4": { hand: "left", finger: "index", row: 0, col: 3 },
  "5": { hand: "left", finger: "index", row: 0, col: 4 },
  "6": { hand: "right", finger: "index", row: 0, col: 0 },
  "7": { hand: "right", finger: "index", row: 0, col: 1 },
  "8": { hand: "right", finger: "middle", row: 0, col: 2 },
  "9": { hand: "right", finger: "ring", row: 0, col: 3 },
  "0": { hand: "right", finger: "pinky", row: 0, col: 4 },

  // Row 1 — top alpha
  q: { hand: "left", finger: "pinky", row: 1, col: 0 },
  w: { hand: "left", finger: "ring", row: 1, col: 1 },
  e: { hand: "left", finger: "middle", row: 1, col: 2 },
  r: { hand: "left", finger: "index", row: 1, col: 3 },
  t: { hand: "left", finger: "index", row: 1, col: 4 },
  y: { hand: "right", finger: "index", row: 1, col: 0 },
  u: { hand: "right", finger: "index", row: 1, col: 1 },
  i: { hand: "right", finger: "middle", row: 1, col: 2 },
  o: { hand: "right", finger: "ring", row: 1, col: 3 },
  p: { hand: "right", finger: "pinky", row: 1, col: 4 },

  // Row 2 — home row
  a: { hand: "left", finger: "pinky", row: 2, col: 0 },
  s: { hand: "left", finger: "ring", row: 2, col: 1 },
  d: { hand: "left", finger: "middle", row: 2, col: 2 },
  f: { hand: "left", finger: "index", row: 2, col: 3 },
  g: { hand: "left", finger: "index", row: 2, col: 4 },
  h: { hand: "right", finger: "index", row: 2, col: 0 },
  j: { hand: "right", finger: "index", row: 2, col: 1 },
  k: { hand: "right", finger: "middle", row: 2, col: 2 },
  l: { hand: "right", finger: "ring", row: 2, col: 3 },
  ";": { hand: "right", finger: "pinky", row: 2, col: 4 },
  "'": { hand: "right", finger: "pinky", row: 2, col: 5 },

  // Row 3 — bottom alpha
  z: { hand: "left", finger: "pinky", row: 3, col: 0 },
  x: { hand: "left", finger: "ring", row: 3, col: 1 },
  c: { hand: "left", finger: "middle", row: 3, col: 2 },
  v: { hand: "left", finger: "index", row: 3, col: 3 },
  b: { hand: "left", finger: "index", row: 3, col: 4 },
  n: { hand: "right", finger: "index", row: 3, col: 0 },
  m: { hand: "right", finger: "index", row: 3, col: 1 },
  ",": { hand: "right", finger: "middle", row: 3, col: 2 },
  ".": { hand: "right", finger: "ring", row: 3, col: 3 },
  "/": { hand: "right", finger: "pinky", row: 3, col: 4 },
  "-": { hand: "right", finger: "pinky", row: 1, col: 5 },

  // Row 4 — thumb cluster. Space lives on the LEFT thumb on the developer's
  // keymap (innermost-left position), matching the Sofle assignment.
  " ": { hand: "left", finger: "thumb", row: 4, col: 0 },
};
