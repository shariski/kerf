import { beforeEach, describe, expect, it, vi } from "vitest";

describe("DAILY_COACH_LIMIT env override", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to 5 when COACH_DAILY_LIMIT is unset", async () => {
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(5);
  });

  it("reads a positive COACH_DAILY_LIMIT (staging test lift)", async () => {
    vi.stubEnv("COACH_DAILY_LIMIT", "999");
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(999);
  });

  it("falls back to 5 on non-numeric values", async () => {
    vi.stubEnv("COACH_DAILY_LIMIT", "unlimited");
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(5);
  });

  it("falls back to 5 on values below 1", async () => {
    vi.stubEnv("COACH_DAILY_LIMIT", "0");
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(5);
  });
});

describe("DAILY_GENERATION_LIMIT env override", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to 30 generation attempts per UTC day", async () => {
    const { DAILY_GENERATION_LIMIT } = await import("./quota");
    expect(DAILY_GENERATION_LIMIT).toBe(30);
  });

  it("allows operators to lower the cap or disable new generations", async () => {
    vi.stubEnv("COACH_DAILY_GENERATION_LIMIT", "0");
    const { DAILY_GENERATION_LIMIT } = await import("./quota");
    expect(DAILY_GENERATION_LIMIT).toBe(0);
  });
});
