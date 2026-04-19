import type { KeyboardGeometry, KeyGeometry } from "./types";

/**
 * Sofle v2 visual layout — 6×4 matrix + 5-key thumb cluster (incl. encoder)
 * per side. Extracted verbatim from design/keyboard-svg-preview.html (lines
 * 298–631). Coordinates are in half-local space before the half's translate.
 *
 * Char ids are canonical typable characters where possible (letters,
 * digits, punctuation, " " for space); non-typable keys use short tags
 * (tab, esc, mute, lwr, rse, enter, bsp, del, bsp_thumb, space_r).
 * Right-thumb spacebar uses "space_r" because the developer's keymap
 * binds " " to the left thumb (see src/domain/finger/sofle.ts).
 */

const W = 32;
const H = 32;

const leftKeys: KeyGeometry[] = [
  // Row 0 — number row
  { char: "1", label: "1", x: 0,   y: 6,  width: W, height: H },
  { char: "2", label: "2", x: 34,  y: -6, width: W, height: H },
  { char: "3", label: "3", x: 68,  y: -2, width: W, height: H },
  { char: "4", label: "4", x: 102, y: 4,  width: W, height: H },
  { char: "5", label: "5", x: 136, y: 4,  width: W, height: H },
  { char: "6", label: "6", x: 170, y: 10, width: W, height: H },

  // Row 1 — top alpha
  { char: "q",   label: "q",   x: 0,   y: 42, width: W, height: H },
  { char: "w",   label: "w",   x: 34,  y: 30, width: W, height: H },
  { char: "e",   label: "e",   x: 68,  y: 34, width: W, height: H },
  { char: "r",   label: "r",   x: 102, y: 40, width: W, height: H },
  { char: "t",   label: "t",   x: 136, y: 40, width: W, height: H },
  { char: "tab", label: "tab", x: 170, y: 46, width: W, height: H },

  // Row 2 — home row
  { char: "a",   label: "a",   x: 0,   y: 78, width: W, height: H },
  { char: "s",   label: "s",   x: 34,  y: 66, width: W, height: H },
  { char: "d",   label: "d",   x: 68,  y: 70, width: W, height: H },
  { char: "f",   label: "f",   x: 102, y: 76, width: W, height: H },
  { char: "g",   label: "g",   x: 136, y: 76, width: W, height: H },
  { char: "esc", label: "esc", x: 170, y: 82, width: W, height: H },

  // Row 3 — bottom alpha
  { char: "z",    label: "z",    x: 0,   y: 114, width: W, height: H },
  { char: "x",    label: "x",    x: 34,  y: 102, width: W, height: H },
  { char: "c",    label: "c",    x: 68,  y: 106, width: W, height: H },
  { char: "v",    label: "v",    x: 102, y: 112, width: W, height: H },
  { char: "b",    label: "b",    x: 136, y: 112, width: W, height: H },
  { char: "mute", label: "mute", x: 170, y: 118, width: W, height: H },

  // Thumb cluster — inner two extend from row 3, outer two+encoder angled
  { char: "lwr_l", label: "lwr",   x: 136, y: 148, width: W,  height: H },
  { char: "rse_l", label: "rse",   x: 170, y: 154, width: W,  height: H },
  { char: " ",     label: "spc",   x: 206, y: 172, width: W,  height: H, rotate: 18 },
  { char: "enter", label: "enter", x: 244, y: 182, width: 48, height: H, rotate: 18 },
];

const rightKeys: KeyGeometry[] = [
  // Row 0 — numbers + symbols
  { char: "7", label: "7", x: 0,   y: 10, width: W, height: H },
  { char: "8", label: "8", x: 34,  y: 4,  width: W, height: H },
  { char: "9", label: "9", x: 68,  y: 4,  width: W, height: H },
  { char: "0", label: "0", x: 102, y: -2, width: W, height: H },
  { char: "-", label: "-", x: 136, y: -6, width: W, height: H },
  { char: "=", label: "=", x: 170, y: 6,  width: W, height: H },

  // Row 1 — bsp + top alpha
  { char: "bsp", label: "bsp", x: 0,   y: 46, width: W, height: H },
  { char: "y",   label: "y",   x: 34,  y: 40, width: W, height: H },
  { char: "u",   label: "u",   x: 68,  y: 40, width: W, height: H },
  { char: "i",   label: "i",   x: 102, y: 34, width: W, height: H },
  { char: "o",   label: "o",   x: 136, y: 30, width: W, height: H },
  { char: "p",   label: "p",   x: 170, y: 42, width: W, height: H },

  // Row 2 — del + home row right
  { char: "del", label: "del", x: 0,   y: 82, width: W, height: H },
  { char: "h",   label: "h",   x: 34,  y: 76, width: W, height: H },
  { char: "j",   label: "j",   x: 68,  y: 76, width: W, height: H },
  { char: "k",   label: "k",   x: 102, y: 70, width: W, height: H },
  { char: "l",   label: "l",   x: 136, y: 66, width: W, height: H },
  { char: ";",   label: ";",   x: 170, y: 78, width: W, height: H },

  // Row 3 — apostrophe + bottom alpha right
  { char: "'", label: "'", x: 0,   y: 118, width: W, height: H },
  { char: "n", label: "n", x: 34,  y: 112, width: W, height: H },
  { char: "m", label: "m", x: 68,  y: 112, width: W, height: H },
  { char: ",", label: ",", x: 102, y: 106, width: W, height: H },
  { char: ".", label: ".", x: 136, y: 102, width: W, height: H },
  { char: "/", label: "/", x: 170, y: 114, width: W, height: H },

  // Right thumb cluster — true VISUAL mirror of the left cluster
  // across the keyboard's SVG center (x=331). Getting this right is
  // more than a sign-flip on x: a left key rotated +18° CW has its
  // top-left corner as the anchor (rotation origin), while its top-
  // right slips down+right (relative to origin) by (w*cos18, w*sin18).
  // The mirror right key rotates -18° — its top-left anchor must land
  // at the mirror of the LEFT key's TOP-RIGHT (not top-left), which
  // introduces a y offset of w*sin18 ≈ 10 for w=32, ≈ 15 for w=48.
  //
  // Previous attempts got x right but forgot the y compensation,
  // which made the right thumb sit ~10-15px too HIGH and read as
  // "scattered" even though x values matched.
  //
  //   spc   (x=206, y=172, w=32, rot=+18)  →  bsp_thumb (x=-34, y=182, w=32, rot=-18)
  //   enter (x=244, y=182, w=48, rot=+18)  →  space_r   (x=-88, y=197, w=48, rot=-18)
  { char: "rse_r",     label: "rse",   x: 0,   y: 154, width: W,  height: H },
  { char: "lwr_r",     label: "lwr",   x: 34,  y: 148, width: W,  height: H },
  { char: "bsp_thumb", label: "bsp",   x: -34, y: 182, width: W,  height: H, rotate: -18 },
  { char: "space_r",   label: "space", x: -88, y: 197, width: 48, height: H, rotate: -18 },
];

/* ViewBox width trimmed from the design-source 780 to 662: the rightmost
   matrix key sits at x=642 after translate, so 780 left ~138px of empty
   right-side space that made the keyboard look pushed left in practice. */
export const SOFLE_GEOMETRY: KeyboardGeometry = {
  layout: "sofle",
  viewBox: [0, 0, 662, 260] as const,
  halves: {
    left: {
      translateX: 20,
      translateY: 30,
      keys: leftKeys,
      encoders: [
        // Per the developer's real Sofle hardware (photo confirmed),
        // the rotary encoder sits beside the row-3 inner-column key
        // (`mute` on this half), not at the top and not in the thumb
        // cluster where the original design-source wireframe placed
        // it. Row-3 inner-column `mute` is at y=118, so the encoder
        // circle centers at the same row height. No rotation — the
        // knob is sideways-mounted; the visual circle represents the
        // knob face as seen from above.
        { id: "sofle-encoder-left", x: 206, y: 118, cx: 16, cy: 16, r: 14 },
      ],
    },
    right: {
      translateX: 440,
      translateY: 30,
      keys: rightKeys,
      encoders: [
        // Mirror of the left encoder: beside the right-half row-3
        // inner-column key (`'` / apostrophe). x=-36 puts the
        // circle's center at absolute x=420, which is the mirror of
        // the left encoder's center (242) across the keyboard's SVG
        // center 331.
        { id: "sofle-encoder-right", x: -36, y: 118, cx: 16, cy: 16, r: 14 },
      ],
    },
  },
};
