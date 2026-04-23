import { describe, expect, it } from "vitest";
import { SOFLE_BASE_LAYER } from "./sofle";
import type { Finger, Hand } from "./types";

const VALID_HANDS: ReadonlySet<Hand> = new Set(["left", "right"]);
const VALID_FINGERS: ReadonlySet<Finger> = new Set(["thumb", "index", "middle", "ring", "pinky"]);

describe("SOFLE_BASE_LAYER", () => {
  describe("coverage", () => {
    it("assigns every lowercase letter a–z", () => {
      const missing: string[] = [];
      for (let code = 0x61; code <= 0x7a; code++) {
        const ch = String.fromCharCode(code);
        if (!SOFLE_BASE_LAYER[ch]) missing.push(ch);
      }
      expect(missing).toEqual([]);
    });

    it("assigns every digit 0–9", () => {
      const missing: string[] = [];
      for (let code = 0x30; code <= 0x39; code++) {
        const ch = String.fromCharCode(code);
        if (!SOFLE_BASE_LAYER[ch]) missing.push(ch);
      }
      expect(missing).toEqual([]);
    });

    it("assigns space, comma, period, semicolon, apostrophe, slash, and hyphen", () => {
      for (const ch of [" ", ",", ".", ";", "'", "/", "-"]) {
        expect(SOFLE_BASE_LAYER[ch]).toBeDefined();
      }
    });
  });

  describe("invariants", () => {
    it("uses only valid hand + finger values and non-negative row/col", () => {
      for (const [ch, a] of Object.entries(SOFLE_BASE_LAYER)) {
        expect(VALID_HANDS.has(a.hand), `bad hand for ${ch}`).toBe(true);
        expect(VALID_FINGERS.has(a.finger), `bad finger for ${ch}`).toBe(true);
        expect(a.row, `bad row for ${ch}`).toBeGreaterThanOrEqual(0);
        expect(a.col, `bad col for ${ch}`).toBeGreaterThanOrEqual(0);
      }
    });

    it("places home-row index keys f and j at row 2", () => {
      expect(SOFLE_BASE_LAYER["f"]?.row).toBe(2);
      expect(SOFLE_BASE_LAYER["j"]?.row).toBe(2);
    });
  });

  describe("home row anchors", () => {
    it("'a' is left pinky home row", () => {
      expect(SOFLE_BASE_LAYER["a"]).toMatchObject({
        hand: "left",
        finger: "pinky",
        row: 2,
      });
    });

    it("'f' is left index home row", () => {
      expect(SOFLE_BASE_LAYER["f"]).toMatchObject({
        hand: "left",
        finger: "index",
        row: 2,
      });
    });

    it("'j' is right index home row", () => {
      expect(SOFLE_BASE_LAYER["j"]).toMatchObject({
        hand: "right",
        finger: "index",
        row: 2,
      });
    });

    it("';' is right pinky home row", () => {
      expect(SOFLE_BASE_LAYER[";"]).toMatchObject({
        hand: "right",
        finger: "pinky",
        row: 2,
      });
    });
  });

  describe("inner column (the columnar-stagger trouble zone)", () => {
    it("'b' is left index, inner column", () => {
      expect(SOFLE_BASE_LAYER["b"]).toMatchObject({
        hand: "left",
        finger: "index",
      });
    });

    it("'n' is right index, inner column", () => {
      expect(SOFLE_BASE_LAYER["n"]).toMatchObject({
        hand: "right",
        finger: "index",
      });
    });

    it("'g' and 't' are left index", () => {
      expect(SOFLE_BASE_LAYER["g"]?.finger).toBe("index");
      expect(SOFLE_BASE_LAYER["g"]?.hand).toBe("left");
      expect(SOFLE_BASE_LAYER["t"]?.finger).toBe("index");
      expect(SOFLE_BASE_LAYER["t"]?.hand).toBe("left");
    });

    it("'h' and 'y' are right index", () => {
      expect(SOFLE_BASE_LAYER["h"]?.finger).toBe("index");
      expect(SOFLE_BASE_LAYER["h"]?.hand).toBe("right");
      expect(SOFLE_BASE_LAYER["y"]?.finger).toBe("index");
      expect(SOFLE_BASE_LAYER["y"]?.hand).toBe("right");
    });
  });

  describe("thumb cluster", () => {
    it("space is on the LEFT thumb (validated against developer's keymap)", () => {
      expect(SOFLE_BASE_LAYER[" "]).toMatchObject({
        hand: "left",
        finger: "thumb",
      });
    });
  });

  describe("outer pinky column (validated against developer's keymap)", () => {
    it("'-' is on the right pinky, top alpha row (next to P)", () => {
      expect(SOFLE_BASE_LAYER["-"]).toMatchObject({
        hand: "right",
        finger: "pinky",
        row: 1,
        col: 5,
      });
    });

    it("'\\'' is on the right pinky, home row (next to ;)", () => {
      expect(SOFLE_BASE_LAYER["'"]).toMatchObject({
        hand: "right",
        finger: "pinky",
        row: 2,
        col: 5,
      });
    });
  });
});
