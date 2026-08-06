import { beforeEach, describe, expect, it, vi } from "vitest";

describe("DAILY_COACH_LIMIT env override", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("defaults to 1 when COACH_DAILY_LIMIT is unset", async () => {
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(1);
  });

  it("reads a positive COACH_DAILY_LIMIT (staging test lift)", async () => {
    vi.stubEnv("COACH_DAILY_LIMIT", "999");
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(999);
  });

  it("falls back to 1 on non-numeric values", async () => {
    vi.stubEnv("COACH_DAILY_LIMIT", "unlimited");
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(1);
  });

  it("falls back to 1 on values below 1", async () => {
    vi.stubEnv("COACH_DAILY_LIMIT", "0");
    const { DAILY_COACH_LIMIT } = await import("./quota");
    expect(DAILY_COACH_LIMIT).toBe(1);
  });
});
