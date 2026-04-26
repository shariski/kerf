import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `env.ts` evaluates at module load — every test re-imports it via
 * `vi.resetModules()` to re-trigger validation against a freshly
 * mutated process.env. Vitest is configured with forks + isolate so
 * cross-file env mutation can't leak; the per-test reset handles
 * within-file isolation.
 */

const REQUIRED_KEYS = ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL"] as const;

describe("env validator", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("returns dev fallbacks and warns when required vars are unset and NODE_ENV is not production", async () => {
    process.env.NODE_ENV = "development";
    for (const k of REQUIRED_KEYS) delete process.env[k];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { env } = await import("./env");

    expect(env.authSecret).toBe("dev-secret-change-me");
    expect(env.authUrl).toBe("http://localhost:3000");
    expect(env.databaseUrl).toBe("postgresql://kerf:kerf_dev@localhost:5432/kerf_dev");
    expect(warnSpy).toHaveBeenCalledTimes(REQUIRED_KEYS.length);
    for (const k of REQUIRED_KEYS) {
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining(k));
    }
  });

  it("throws in production when AUTH_SECRET is missing", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.AUTH_SECRET;
    process.env.DATABASE_URL = "postgresql://prod";
    process.env.AUTH_URL = "https://example.com";

    await expect(import("./env")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("throws in production when DATABASE_URL is missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_SECRET = "real-secret";
    delete process.env.DATABASE_URL;
    process.env.AUTH_URL = "https://example.com";

    await expect(import("./env")).rejects.toThrow(/DATABASE_URL/);
  });

  it("throws in production when AUTH_URL is missing", async () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_SECRET = "real-secret";
    process.env.DATABASE_URL = "postgresql://prod";
    delete process.env.AUTH_URL;

    await expect(import("./env")).rejects.toThrow(/AUTH_URL/);
  });

  it("treats empty-string env values as unset", async () => {
    // Some deployment platforms (Docker, k8s) inject empty strings
    // when an env var is declared but no value is provided. Treat
    // those identically to unset — otherwise prod could boot with
    // secret = "".
    process.env.NODE_ENV = "production";
    process.env.AUTH_SECRET = "";
    process.env.DATABASE_URL = "postgresql://prod";
    process.env.AUTH_URL = "https://example.com";

    await expect(import("./env")).rejects.toThrow(/AUTH_SECRET/);
  });

  it("uses provided values when set", async () => {
    process.env.NODE_ENV = "development";
    process.env.AUTH_SECRET = "real-secret";
    process.env.DATABASE_URL = "postgresql://test";
    process.env.AUTH_URL = "https://kerf.test";

    const { env } = await import("./env");

    expect(env.authSecret).toBe("real-secret");
    expect(env.databaseUrl).toBe("postgresql://test");
    expect(env.authUrl).toBe("https://kerf.test");
  });
});
