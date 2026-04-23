import type { KeyboardGeometry, KeyGeometry } from "./types";

/**
 * Lily58 visual layout — 6×4 matrix + 4-key thumb cluster per side,
 * no encoder. Extracted verbatim from design/keyboard-svg-preview.html
 * (lines 645–961). Coordinates are in half-local space before the half's
 * translate.
 *
 * Char ids mirror the Sofle convention: canonical typable characters where
 * possible; short tags for non-typable keys (tab, esc, lshift, ctrl_l/ctrl_r,
 * lwr_l/lwr_r, rse_l/rse_r, bsp, del, space_r). The " " canonical space
 * sits on the left thumb to match the domain table
 * (src/domain/finger/lily58.ts); the right-thumb spacebar is decorative
 * ("space_r").
 *
 * Lily58's angled thumbs rotate around their own center (SVG source uses
 * `rotate(±15 16 16)`), so they set rotateOrigin: [16, 16]. Compare with
 * Sofle, whose thumbs rotate around the corner — the shared renderer
 * reads rotateOrigin to apply the correct pivot.
 */

const W = 32;
const H = 32;
const CENTER: readonly [number, number] = [16, 16];

const leftKeys: KeyGeometry[] = [
  // Row 0 — number row
  { char: "1", label: "1", x: 0, y: 6, width: W, height: H },
  { char: "2", label: "2", x: 34, y: -4, width: W, height: H },
  { char: "3", label: "3", x: 68, y: -2, width: W, height: H },
  { char: "4", label: "4", x: 102, y: 4, width: W, height: H },
  { char: "5", label: "5", x: 136, y: 4, width: W, height: H },
  { char: "6", label: "6", x: 170, y: 10, width: W, height: H },

  // Row 1 — top alpha
  { char: "q", label: "q", x: 0, y: 42, width: W, height: H },
  { char: "w", label: "w", x: 34, y: 32, width: W, height: H },
  { char: "e", label: "e", x: 68, y: 34, width: W, height: H },
  { char: "r", label: "r", x: 102, y: 40, width: W, height: H },
  { char: "t", label: "t", x: 136, y: 40, width: W, height: H },
  { char: "tab", label: "tab", x: 170, y: 46, width: W, height: H },

  // Row 2 — home row
  { char: "a", label: "a", x: 0, y: 78, width: W, height: H },
  { char: "s", label: "s", x: 34, y: 68, width: W, height: H },
  { char: "d", label: "d", x: 68, y: 70, width: W, height: H },
  { char: "f", label: "f", x: 102, y: 76, width: W, height: H },
  { char: "g", label: "g", x: 136, y: 76, width: W, height: H },
  { char: "esc", label: "esc", x: 170, y: 82, width: W, height: H },

  // Row 3 — bottom alpha + left shift
  { char: "z", label: "z", x: 0, y: 114, width: W, height: H },
  { char: "x", label: "x", x: 34, y: 104, width: W, height: H },
  { char: "c", label: "c", x: 68, y: 106, width: W, height: H },
  { char: "v", label: "v", x: 102, y: 112, width: W, height: H },
  { char: "b", label: "b", x: 136, y: 112, width: W, height: H },
  { char: "lshift", label: "⇧", x: 170, y: 118, width: W, height: H },

  // Thumb cluster — inner two straight, outer two angled 15° (center pivot)
  { char: "ctrl_l", label: "ctrl", x: 102, y: 154, width: W, height: H },
  { char: "lwr_l", label: "lwr", x: 136, y: 154, width: W, height: H },
  {
    char: " ",
    label: "spc",
    x: 174,
    y: 158,
    width: W,
    height: H,
    rotate: 15,
    rotateOrigin: CENTER,
  },
  {
    char: "rse_l",
    label: "rse",
    x: 214,
    y: 170,
    width: W,
    height: H,
    rotate: 15,
    rotateOrigin: CENTER,
  },
];

const rightKeys: KeyGeometry[] = [
  // Row 0 — numbers + symbols
  { char: "7", label: "7", x: 0, y: 10, width: W, height: H },
  { char: "8", label: "8", x: 34, y: 4, width: W, height: H },
  { char: "9", label: "9", x: 68, y: 4, width: W, height: H },
  { char: "0", label: "0", x: 102, y: -2, width: W, height: H },
  { char: "-", label: "-", x: 136, y: -4, width: W, height: H },
  { char: "=", label: "=", x: 170, y: 6, width: W, height: H },

  // Row 1 — bsp + top alpha
  { char: "bsp", label: "bsp", x: 0, y: 46, width: W, height: H },
  { char: "y", label: "y", x: 34, y: 40, width: W, height: H },
  { char: "u", label: "u", x: 68, y: 40, width: W, height: H },
  { char: "i", label: "i", x: 102, y: 34, width: W, height: H },
  { char: "o", label: "o", x: 136, y: 32, width: W, height: H },
  { char: "p", label: "p", x: 170, y: 42, width: W, height: H },

  // Row 2 — del + home row right
  { char: "del", label: "del", x: 0, y: 82, width: W, height: H },
  { char: "h", label: "h", x: 34, y: 76, width: W, height: H },
  { char: "j", label: "j", x: 68, y: 76, width: W, height: H },
  { char: "k", label: "k", x: 102, y: 70, width: W, height: H },
  { char: "l", label: "l", x: 136, y: 68, width: W, height: H },
  { char: ";", label: ";", x: 170, y: 78, width: W, height: H },

  // Row 3 — apostrophe + bottom alpha right
  { char: "'", label: "'", x: 0, y: 118, width: W, height: H },
  { char: "n", label: "n", x: 34, y: 112, width: W, height: H },
  { char: "m", label: "m", x: 68, y: 112, width: W, height: H },
  { char: ",", label: ",", x: 102, y: 106, width: W, height: H },
  { char: ".", label: ".", x: 136, y: 104, width: W, height: H },
  { char: "/", label: "/", x: 170, y: 114, width: W, height: H },

  // Right thumb cluster (mirror of left, 4 keys, no encoder)
  {
    char: "rse_r",
    label: "rse",
    x: -40,
    y: 170,
    width: W,
    height: H,
    rotate: -15,
    rotateOrigin: CENTER,
  },
  {
    char: "space_r",
    label: "spc",
    x: 0,
    y: 158,
    width: W,
    height: H,
    rotate: -15,
    rotateOrigin: CENTER,
  },
  { char: "lwr_r", label: "lwr", x: 34, y: 154, width: W, height: H },
  { char: "ctrl_r", label: "ctrl", x: 68, y: 154, width: W, height: H },
];

/* ViewBox width trimmed from the design-source 760 to 662 so the keyboard
   sits centered: rightmost matrix key is at x=642 after translate, so 760
   left ~118px of empty right-side space. Matches Sofle's trimmed width. */
export const LILY58_GEOMETRY: KeyboardGeometry = {
  layout: "lily58",
  viewBox: [0, 0, 662, 260] as const,
  halves: {
    left: {
      translateX: 20,
      translateY: 30,
      keys: leftKeys,
    },
    right: {
      translateX: 440,
      translateY: 30,
      keys: rightKeys,
    },
  },
};
