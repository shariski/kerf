import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendSpy, writeFileSpy } = vi.hoisted(() => ({
  sendSpy: vi.fn(),
  writeFileSpy: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendSpy },
  })),
}));

vi.mock("node:fs/promises", () => ({
  writeFile: writeFileSpy,
}));

// Imports must come AFTER vi.mock calls (vitest hoists vi.mock to top).
import { sendMagicLinkEmail, __resetResendClientForTests } from "./send";

const PREVIEW_PATH = "/tmp/kerf-last-email.html";

beforeEach(() => {
  vi.unstubAllEnvs();
  sendSpy.mockReset();
  sendSpy.mockResolvedValue({ data: { id: "test-id" }, error: null });
  writeFileSpy.mockReset();
  writeFileSpy.mockResolvedValue(undefined);
  __resetResendClientForTests();
});

describe("sendMagicLinkEmail — production", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "test-key");
  });

  it("sends via Resend with EMAIL_FROM and rendered fields", async () => {
    vi.stubEnv("EMAIL_FROM", "kerf <hello@typekerf.com>");
    await sendMagicLinkEmail({ email: "user@example.com", url: "https://typekerf.com/x" });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const args = sendSpy.mock.calls[0]![0];
    expect(args).toMatchObject({
      from: "kerf <hello@typekerf.com>",
      to: "user@example.com",
      subject: "Your kerf sign-in link",
    });
    expect(args.html).toContain("https://typekerf.com/x");
    expect(args.text).toContain("https://typekerf.com/x");
  });

  it("defaults EMAIL_FROM to onboarding@resend.dev when unset", async () => {
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    expect(sendSpy.mock.calls[0]![0].from).toBe("kerf <onboarding@resend.dev>");
  });

  it("rethrows + console.errors when Resend network fails", async () => {
    sendSpy.mockRejectedValue(new Error("network down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" }),
    ).rejects.toThrow("network down");
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("rethrows when Resend returns {error: ...}", async () => {
    sendSpy.mockResolvedValue({ data: null, error: { message: "invalid from" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" }),
    ).rejects.toThrow(/invalid from/);
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });
});

describe("sendMagicLinkEmail — dev default", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("does not call Resend; logs URL + preview path", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendMagicLinkEmail({ email: "user@example.com", url: "https://typekerf.com/x" });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = String(logSpy.mock.calls[0]![0]);
    expect(logged).toContain("user@example.com");
    expect(logged).toContain("https://typekerf.com/x");
    expect(logged).toContain(PREVIEW_PATH);
    logSpy.mockRestore();
  });

  it("writes preview file with rendered HTML", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" });
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    const [path, content, encoding] = writeFileSpy.mock.calls[0]!;
    expect(path).toBe(PREVIEW_PATH);
    expect(encoding).toBe("utf8");
    expect(content).toContain("Sign in to kerf");
    expect(content).toContain("https://typekerf.com/x");
  });

  it("does not crash when RESEND_API_KEY is unset (lazy init)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    // RESEND_API_KEY explicitly NOT stubbed
    await expect(
      sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" }),
    ).resolves.toBeUndefined();
    expect(sendSpy).not.toHaveBeenCalled();
  });
});

describe("sendMagicLinkEmail — dev send opt-in", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("EMAIL_DEV_MODE", "send");
    vi.stubEnv("RESEND_API_KEY", "test-key");
  });

  it("calls Resend like prod when EMAIL_DEV_MODE=send", async () => {
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("still writes preview file in dev send mode", async () => {
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" });
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
  });
});

describe("sendMagicLinkEmail — preview file write failure", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("does not throw when preview file write fails; warns once", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    writeFileSpy.mockRejectedValueOnce(new Error("EROFS"));

    await expect(
      sendMagicLinkEmail({ email: "u@x.com", url: "https://typekerf.com/x" }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]![0])).toContain("preview file write failed");
    warnSpy.mockRestore();
  });
});
