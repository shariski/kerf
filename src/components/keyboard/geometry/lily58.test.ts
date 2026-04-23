import { describe, expect, it } from "vitest";
import { LILY58_BASE_LAYER } from "#/domain/finger/lily58";
import { LILY58_GEOMETRY } from "./lily58";

describe("LILY58_GEOMETRY", () => {
  const { left, right } = LILY58_GEOMETRY.halves;
  const allKeys = [...left.keys, ...right.keys];
  const allChars = allKeys.map((k) => k.char);

  it("declares layout and a viewBox trimmed to fit the content with symmetric 20px margin", () => {
    expect(LILY58_GEOMETRY.layout).toBe("lily58");
    expect(LILY58_GEOMETRY.viewBox).toEqual([0, 0, 662, 260]);
  });

  it("has 28 keys per half (24 matrix + 4 thumb)", () => {
    expect(left.keys).toHaveLength(28);
    expect(right.keys).toHaveLength(28);
  });

  it("has no encoders on either half", () => {
    expect(left.encoders).toBeUndefined();
    expect(right.encoders).toBeUndefined();
  });

  it("has unique char ids across both halves", () => {
    expect(new Set(allChars).size).toBe(allChars.length);
  });

  it("covers every typable character declared in LILY58_BASE_LAYER", () => {
    const missing = Object.keys(LILY58_BASE_LAYER).filter((char) => !allChars.includes(char));
    expect(missing).toEqual([]);
  });

  it("gives every key non-negative dimensions", () => {
    for (const k of allKeys) {
      expect(k.width).toBeGreaterThan(0);
      expect(k.height).toBeGreaterThan(0);
    }
  });

  it("places rotated keys only in the thumb cluster", () => {
    const rotated = allKeys.filter((k) => k.rotate !== undefined);
    const rotatedLabels = rotated.map((k) => k.label).sort();
    expect(rotatedLabels).toEqual(["rse", "rse", "spc", "spc"]);
  });

  it("rotates thumb keys around their center (rotateOrigin=[16,16])", () => {
    const rotated = allKeys.filter((k) => k.rotate !== undefined);
    for (const k of rotated) {
      expect(k.rotateOrigin).toEqual([16, 16]);
    }
  });

  it("binds canonical space character to the left thumb (matches domain table)", () => {
    const space = left.keys.find((k) => k.char === " ");
    expect(space).toBeDefined();
    expect(space?.label).toBe("spc");
    // No " " on the right half — right thumb spacebar is decorative ("space_r").
    expect(right.keys.find((k) => k.char === " ")).toBeUndefined();
  });
});
