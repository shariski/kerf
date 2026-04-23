import { LILY58_BASE_LAYER } from "./lily58";
import { SOFLE_BASE_LAYER } from "./sofle";
import type { FingerTable, KeyAssignment, KeyboardLayout } from "./types";

const LAYOUTS: Record<KeyboardLayout, FingerTable> = {
  sofle: SOFLE_BASE_LAYER,
  lily58: LILY58_BASE_LAYER,
};

export function getFingerForKey(layout: KeyboardLayout, char: string): KeyAssignment | undefined {
  return LAYOUTS[layout][char.toLowerCase()];
}
