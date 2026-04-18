export type Hand = "left" | "right";

export type Finger = "thumb" | "index" | "middle" | "ring" | "pinky";

export type KeyAssignment = {
  hand: Hand;
  finger: Finger;
  row: number;
  col: number;
};

export type KeyboardLayout = "sofle" | "lily58";

export type FingerTable = Record<string, KeyAssignment>;
