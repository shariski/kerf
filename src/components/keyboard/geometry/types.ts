import type { KeyboardLayout } from "#/domain/finger/types";

export type { KeyboardLayout };

export type FlashStatus = "correct" | "error" | "hesitation";

/**
 * A single key's visual placement within a keyboard half.
 * Rect origin is (x, y) post-transform; when `rotate` is set, the
 * renderer wraps the key in <g transform="translate(x,y) rotate(rotate)">
 * with the rect drawn at (0, 0).
 */
export type KeyGeometry = {
  /** Unique id for this visual key within the layout. Typable keys use
   *  the canonical character ("a", "1", " ", "/"); non-typable keys use
   *  short labels ("tab", "esc", "mute", "lwr", "rse", "enter"). Must be
   *  unique across the whole KeyboardGeometry. */
  char: string;
  /** Text rendered inside the key. */
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Rotation in degrees. When set, rect sits at (0, 0) inside a
   *  translate(x, y) rotate(rotate) group — matches the design HTML. */
  rotate?: number;
  /** Rotation pivot within the key's translate-local frame. Defaults to
   *  (0, 0) — corner rotation, as used by Sofle's angled thumb cluster.
   *  Lily58's angled thumbs rotate around their own center, so they set
   *  [width/2, height/2]. Ignored when `rotate` is undefined. */
  rotateOrigin?: readonly [number, number];
};

/** Sofle rotary encoder. Circle with amber stroke, not a typable key. */
export type EncoderGeometry = {
  id: string;
  /** Translate anchor for the encoder group, in half-local coords. */
  x: number;
  y: number;
  /** Rotation in degrees, applied after translate. */
  rotate?: number;
  /** Circle center within the rotated group (typically 16, 16). */
  cx: number;
  cy: number;
  r: number;
};

export type KeyboardHalf = {
  /** Translate applied to the half's <g> wrapper, in viewBox coords. */
  translateX: number;
  translateY: number;
  keys: KeyGeometry[];
  encoders?: EncoderGeometry[];
};

export type KeyboardGeometry = {
  layout: KeyboardLayout;
  viewBox: readonly [number, number, number, number];
  halves: {
    left: KeyboardHalf;
    right: KeyboardHalf;
  };
};
