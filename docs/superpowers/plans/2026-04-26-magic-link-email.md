# Magic-link email — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send a kerf-branded magic-link email via Resend in production; keep dev safe-by-default with an explicit opt-in for real-inbox testing and an always-written `/tmp/kerf-last-email.html` preview file.

**Architecture:** Two new files in a new `src/server/email/` folder. `magicLinkEmail.ts` is a **pure renderer** (string in → `{subject, html, text}` out, zero I/O, exhaustively unit-tested). `send.ts` is the **impure boundary** — owns the lazy Resend client, env branching, console logs, preview-file writes. `src/server/auth.ts` shrinks to a 1-line delegation. Zero new template deps; raw HTML with all CSS inline.

**Tech Stack:** TypeScript, better-auth (already wired), Resend Node SDK (new), Vitest 3 (existing), pnpm.

**Spec:** [`docs/superpowers/specs/2026-04-26-magic-link-email-design.md`](../specs/2026-04-26-magic-link-email-design.md)

**Branch:** `feat/email-magic-link` (already cut, spec already committed).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` + `pnpm-lock.yaml` | MODIFY | Add `resend` dependency |
| `src/server/email/magicLinkEmail.ts` | CREATE | Pure render: `({email, url}) → {subject, html, text}` |
| `src/server/email/magicLinkEmail.test.ts` | CREATE | Unit tests for the renderer |
| `src/server/email/send.ts` | CREATE | Resend transport + dev/prod switch + preview-file write |
| `src/server/email/send.test.ts` | CREATE | Behavior tests for transport (Resend + fs mocked) |
| `src/server/auth.ts` | MODIFY | Replace inline `sendMagicLink` stub with delegation; add import |
| `.env.example` | MODIFY | Drop Phase 4 marker; add `EMAIL_FROM` + `EMAIL_DEV_MODE` with explanatory comments |
| `DEPLOYMENT.md` | CREATE | Pre-deploy checklist (Resend domain verification, etc.) |

**Decomposition rationale:** Pure renderer separated from impure transport so the renderer is testable without any mocks (the §B1 domain/server discipline at smaller scale). All email-related code in one folder so future templates have a clear home — but no pre-built infrastructure (no template registry, no abstract sender) per §B6. `auth.ts` change is minimized — a single delegation line.

---

## Task 1: Install Resend SDK

**Files:**
- Modify: `package.json` (dependencies section)
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add the dependency**

Run:

```bash
pnpm add resend
```

Expected: `resend` appears under `"dependencies"` in `package.json`, version `^4.x.x` (or whatever pnpm resolves to latest). `pnpm-lock.yaml` updates.

⚠️ **Do not run `npm install`.** Per CLAUDE.md §B13, this repo is pnpm-only. A stray `package-lock.json` from `npm install` will silently fight `pnpm-lock.yaml`. If you accidentally created one, `rm package-lock.json` before continuing.

- [ ] **Step 2: Verify install**

Run:

```bash
ls node_modules/resend/package.json && cat node_modules/resend/package.json | grep '"version"'
```

Expected: prints a version string like `"version": "4.x.x"`.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(deps): add resend SDK for magic-link email

Phase 4 wiring — see docs/superpowers/specs/2026-04-26-magic-link-email-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Pure renderer — `magicLinkEmail.ts`

**Files:**
- Create: `src/server/email/magicLinkEmail.ts`
- Test: `src/server/email/magicLinkEmail.test.ts`

- [ ] **Step 1: Create the test file with the full test suite**

Create `src/server/email/magicLinkEmail.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { renderMagicLinkEmail } from "./magicLinkEmail";

const URL_INPUT = "https://kerf.app/api/auth/magic-link/verify?token=abc&id=1";
const EMAIL_INPUT = "user@example.com";

describe("renderMagicLinkEmail", () => {
  it("returns {subject, html, text} of non-empty strings", () => {
    const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
    expect(typeof r.subject).toBe("string");
    expect(typeof r.html).toBe("string");
    expect(typeof r.text).toBe("string");
    expect(r.subject.length).toBeGreaterThan(0);
    expect(r.html.length).toBeGreaterThan(0);
    expect(r.text.length).toBeGreaterThan(0);
  });

  it("uses the locked subject", () => {
    const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
    expect(r.subject).toBe("Your kerf sign-in link");
  });

  describe("html", () => {
    it("contains wordmark, heading, body phrase, and footer", () => {
      const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
      expect(r.html).toContain("kerf");
      expect(r.html).toContain("Sign in to kerf");
      expect(r.html).toContain("10 minutes");
      expect(r.html).toContain("If you didn't request this");
    });

    it("contains the URL twice — CTA href + visible fallback (HTML-escaped)", () => {
      const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
      // The & in the URL should be escaped to &amp; in HTML output.
      const escapedUrl = "https://kerf.app/api/auth/magic-link/verify?token=abc&amp;id=1";
      const occurrences = r.html.split(escapedUrl).length - 1;
      expect(occurrences).toBe(2);
    });

    it("has no <style>, <link>, or <script> blocks (CSS must be inline)", () => {
      const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
      expect(r.html).not.toMatch(/<style[\s>]/i);
      expect(r.html).not.toMatch(/<link[\s>]/i);
      expect(r.html).not.toMatch(/<script[\s>]/i);
    });
  });

  describe("text", () => {
    it("contains the URL on its own line (raw, unescaped)", () => {
      const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
      expect(r.text).toContain(`\n${URL_INPUT}\n`);
    });

    it("contains heading and disclaimer", () => {
      const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
      expect(r.text).toContain("Sign in to kerf");
      expect(r.text).toContain("If you didn't request this");
    });
  });

  describe("URL escaping", () => {
    it("HTML-escapes URLs containing scriptish characters", () => {
      const malicious = `https://example.com/?t="><script>alert(1)</script>`;
      const r = renderMagicLinkEmail({ email: EMAIL_INPUT, url: malicious });
      expect(r.html).not.toContain("<script>alert(1)</script>");
      expect(r.html).toContain("&lt;script&gt;");
      expect(r.html).toContain("&quot;");
    });
  });

  it("is idempotent (same input → deep-equal output)", () => {
    const a = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
    const b = renderMagicLinkEmail({ email: EMAIL_INPUT, url: URL_INPUT });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test src/server/email/magicLinkEmail.test.ts
```

Expected: FAIL — `Cannot find module './magicLinkEmail'`.

- [ ] **Step 3: Create the renderer module**

Create `src/server/email/magicLinkEmail.ts`:

```typescript
export type MagicLinkEmailInput = {
  email: string;
  url: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

const SUBJECT = "Your kerf sign-in link";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// All CSS is inline on every element — no <style>, <link>, or <script>.
// This is enforced by a unit test (see magicLinkEmail.test.ts) because
// email clients (Gmail web, Outlook desktop, Apple Mail) strip or mangle
// non-inline CSS unpredictably.
function renderHtml(rawUrl: string): string {
  const url = escapeHtml(rawUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${SUBJECT}</title>
</head>
<body style="margin:0;padding:0;background:#f5efe6;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5efe6;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" style="max-width:520px;width:100%;background:#f5efe6;">
        <tr>
          <td style="padding:36px 28px 32px;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#211a14;line-height:1.55;">
            <div style="font-family:'Fraunces',Georgia,'Times New Roman',serif;font-weight:300;font-variation-settings:&quot;SOFT&quot; 100;font-size:30px;letter-spacing:-0.02em;color:#211a14;margin-bottom:28px;">kerf</div>
            <div style="font-size:17px;font-weight:500;color:#211a14;margin-bottom:10px;">Sign in to kerf</div>
            <div style="font-size:14.5px;color:#4a3f33;margin-bottom:22px;">Click the button below to sign in. The link works once and expires in 10 minutes.</div>
            <a href="${url}" style="display:inline-block;background:#F59E0B;color:#211a14;padding:11px 22px;border-radius:6px;font-weight:500;font-size:14.5px;text-decoration:none;margin-bottom:24px;">Sign in to kerf</a>
            <div style="font-size:12.5px;color:#8a7f72;margin-bottom:8px;">Or paste this URL into your browser:</div>
            <div style="font-family:'JetBrains Mono',ui-monospace,'SF Mono',Consolas,monospace;font-size:11.5px;color:#8a7f72;background:rgba(0,0,0,0.04);padding:9px 11px;border-radius:4px;word-break:break-all;margin-bottom:22px;line-height:1.5;">${url}</div>
            <div style="font-size:11.5px;color:#8a7f72;border-top:1px solid rgba(0,0,0,0.08);padding-top:14px;margin-top:18px;line-height:1.55;">If you didn't request this, you can ignore this email — no account changes will be made.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderText(url: string): string {
  return `kerf

Sign in to kerf
───────────────

Open the link below to sign in. It works once and expires in 10 minutes.

${url}

If you didn't request this, you can ignore this email — no account changes will be made.
`;
}

export function renderMagicLinkEmail(input: MagicLinkEmailInput): RenderedEmail {
  return {
    subject: SUBJECT,
    html: renderHtml(input.url),
    text: renderText(input.url),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm test src/server/email/magicLinkEmail.test.ts
```

Expected: PASS — all 8 tests green.

If any fail, iterate on the renderer until green. Most likely culprit if "URL twice" fails: count whitespace or template literal newlines mismatching the expected string.

- [ ] **Step 5: Format and lint the new files**

Run:

```bash
./node_modules/.bin/biome format --write src/server/email/magicLinkEmail.ts src/server/email/magicLinkEmail.test.ts
./node_modules/.bin/biome lint src/server/email/magicLinkEmail.ts src/server/email/magicLinkEmail.test.ts
```

Expected: format applies (likely no-op since already formatted). Lint reports zero errors and zero warnings on these two files.

- [ ] **Step 6: Commit**

```bash
git add src/server/email/magicLinkEmail.ts src/server/email/magicLinkEmail.test.ts
git commit -m "$(cat <<'EOF'
feat(email): pure renderer for magic-link email (Paper template)

Pure function: renderMagicLinkEmail({email, url}) → {subject, html, text}.
No I/O, no Date/random — exhaustively unit-tested without mocks.

Light "Paper" template (cream background, espresso ink, Fraunces
wordmark, amber CTA, JetBrains Mono URL fallback). All CSS inline on
every element — no <style>, <link>, or <script> blocks. This is
enforced by a unit test because email clients (Gmail, Outlook, Apple
Mail) strip non-inline CSS unpredictably.

URLs are HTML-escaped before interpolation. Defense-in-depth — even
though better-auth controls the URL today.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Transport — `send.ts`

**Files:**
- Create: `src/server/email/send.ts`
- Test: `src/server/email/send.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/server/email/send.test.ts`:

```typescript
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
    vi.stubEnv("EMAIL_FROM", "kerf <hello@kerf.app>");
    await sendMagicLinkEmail({ email: "user@example.com", url: "https://kerf.app/x" });
    expect(sendSpy).toHaveBeenCalledTimes(1);
    const args = sendSpy.mock.calls[0][0];
    expect(args).toMatchObject({
      from: "kerf <hello@kerf.app>",
      to: "user@example.com",
      subject: "Your kerf sign-in link",
    });
    expect(args.html).toContain("https://kerf.app/x");
    expect(args.text).toContain("https://kerf.app/x");
  });

  it("defaults EMAIL_FROM to onboarding@resend.dev when unset", async () => {
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" });
    expect(sendSpy.mock.calls[0][0].from).toBe("kerf <onboarding@resend.dev>");
  });

  it("rethrows + console.errors when Resend network fails", async () => {
    sendSpy.mockRejectedValue(new Error("network down"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" }),
    ).rejects.toThrow("network down");
    expect(errSpy).toHaveBeenCalledTimes(1);
    errSpy.mockRestore();
  });

  it("rethrows when Resend returns {error: ...}", async () => {
    sendSpy.mockResolvedValue({ data: null, error: { message: "invalid from" } });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" }),
    ).rejects.toThrow(/invalid from/);
    errSpy.mockRestore();
  });
});

describe("sendMagicLinkEmail — dev default", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  it("does not call Resend; logs URL + preview path", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await sendMagicLinkEmail({ email: "user@example.com", url: "https://kerf.app/x" });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = String(logSpy.mock.calls[0][0]);
    expect(logged).toContain("user@example.com");
    expect(logged).toContain("https://kerf.app/x");
    expect(logged).toContain(PREVIEW_PATH);
    logSpy.mockRestore();
  });

  it("writes preview file with rendered HTML", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" });
    expect(writeFileSpy).toHaveBeenCalledTimes(1);
    const [path, content, encoding] = writeFileSpy.mock.calls[0];
    expect(path).toBe(PREVIEW_PATH);
    expect(encoding).toBe("utf8");
    expect(content).toContain("Sign in to kerf");
    expect(content).toContain("https://kerf.app/x");
  });

  it("does not crash when RESEND_API_KEY is unset (lazy init)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    // RESEND_API_KEY explicitly NOT stubbed
    await expect(
      sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" }),
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
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("still writes preview file in dev send mode", async () => {
    await sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" });
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
      sendMagicLinkEmail({ email: "u@x.com", url: "https://kerf.app/x" }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("preview file write failed");
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm test src/server/email/send.test.ts
```

Expected: FAIL — `Cannot find module './send'`.

- [ ] **Step 3: Create the transport module**

Create `src/server/email/send.ts`:

```typescript
import { writeFile } from "node:fs/promises";
import { Resend } from "resend";
import { type MagicLinkEmailInput, renderMagicLinkEmail } from "./magicLinkEmail";

const PREVIEW_FILE_PATH = "/tmp/kerf-last-email.html";
const DEFAULT_FROM = "kerf <onboarding@resend.dev>";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("RESEND_API_KEY not set");
  }
  resendClient = new Resend(key);
  return resendClient;
}

function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? DEFAULT_FROM;
}

function shouldSendInDev(): boolean {
  return process.env.EMAIL_DEV_MODE === "send";
}

async function writePreviewFile(html: string): Promise<void> {
  try {
    await writeFile(PREVIEW_FILE_PATH, html, "utf8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[magic-link] preview file write failed: ${message}`);
  }
}

async function sendViaResend(
  input: MagicLinkEmailInput,
  rendered: ReturnType<typeof renderMagicLinkEmail>,
): Promise<void> {
  const client = getResendClient();
  try {
    const result = await client.emails.send({
      from: getEmailFrom(),
      to: input.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    if (result.error) {
      const errMsg =
        typeof result.error === "object" && result.error !== null && "message" in result.error
          ? String((result.error as { message: unknown }).message)
          : JSON.stringify(result.error);
      throw new Error(`Resend returned error: ${errMsg}`);
    }
  } catch (err) {
    console.error("[magic-link] Resend send failed:", err);
    throw err;
  }
}

export async function sendMagicLinkEmail(input: MagicLinkEmailInput): Promise<void> {
  const rendered = renderMagicLinkEmail(input);
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    await writePreviewFile(rendered.html);
    if (!shouldSendInDev()) {
      console.log(
        `[MAGIC LINK] ${input.email}\n  url:     ${input.url}\n  preview: ${PREVIEW_FILE_PATH}`,
      );
      return;
    }
  }

  await sendViaResend(input, rendered);
}

// Test-only: reset the lazy Resend singleton between tests so env stubs take effect.
export function __resetResendClientForTests(): void {
  resendClient = null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm test src/server/email/send.test.ts
```

Expected: PASS — all 12 tests green.

Common failure mode: if "preview file write failure" test fails with "writeFileSpy is not a function", the `vi.hoisted` block isn't being hoisted correctly — verify the `vi.hoisted` call is at the very top of the file before any other code (vitest auto-hoists `vi.mock` calls but `vi.hoisted` needs the explicit positioning).

- [ ] **Step 5: Format + lint the new files**

Run:

```bash
./node_modules/.bin/biome format --write src/server/email/send.ts src/server/email/send.test.ts
./node_modules/.bin/biome lint src/server/email/send.ts src/server/email/send.test.ts
```

Expected: format applies. Lint reports zero errors and zero warnings on these two files.

- [ ] **Step 6: Commit**

```bash
git add src/server/email/send.ts src/server/email/send.test.ts
git commit -m "$(cat <<'EOF'
feat(email): Resend transport with dev/prod switch + preview file

sendMagicLinkEmail({email, url}) — owns the impure boundary:
  - lazy-init Resend client (dev default never instantiates it)
  - writes /tmp/kerf-last-email.html in dev (best-effort, swallows
    write failures with one console.warn so the user-facing flow
    never breaks because /tmp is unwritable)
  - dev default: console.log URL + preview path, no real send
  - dev + EMAIL_DEV_MODE=send: real send for inbox testing
  - prod: always real send; failures bubble after console.error

Resend's {data, error} response shape is checked — both network
failures (rejected promise) and API-error responses are normalized
to a thrown Error so better-auth surfaces them to the user.

EMAIL_FROM defaults to "kerf <onboarding@resend.dev>" — Resend's
sandbox sender. Swap to a verified custom domain in prod .env once
DNS verification (developer scope per §B9) is complete.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Wire the transport into `auth.ts`

**Files:**
- Modify: `src/server/auth.ts` (lines 1-3 for imports, lines 71-81 for `sendMagicLink`)

- [ ] **Step 1: Apply the auth.ts diff**

Open `src/server/auth.ts`. Make these two edits:

**Edit A — add the import after the existing `magicLink` import (line 3):**

Change:

```typescript
import { magicLink } from "better-auth/plugins";
import { db } from "./db/index";
```

To:

```typescript
import { magicLink } from "better-auth/plugins";
import { db } from "./db/index";
import { sendMagicLinkEmail } from "./email/send";
```

**Edit B — replace the `sendMagicLink` callback (currently lines 72-80):**

Change:

```typescript
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (process.env.NODE_ENV === "production") {
          // Phase 4: wire Resend here using process.env.RESEND_API_KEY
          throw new Error("Email sending not configured — wire Resend in Phase 4");
        }
        console.log(`\n[MAGIC LINK] Login link for ${email}:\n${url}\n`);
      },
    }),
```

To:

```typescript
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ email, url });
      },
    }),
```

The Phase 4 marker comment + the inline throw + the inline console.log all go away. All branching now lives in `send.ts`.

- [ ] **Step 2: Run the existing auth smoke test**

Run:

```bash
pnpm test src/server/auth.test.ts
```

Expected: PASS — the existing test only checks `auth.handler`, `auth.api.getSession`, `auth.api.signOut` exist as functions. The `sendMagicLink` body change does not affect those.

- [ ] **Step 3: Run the full email test suite to confirm no regression**

Run:

```bash
pnpm test src/server/email/
```

Expected: PASS — all renderer + transport tests still green.

- [ ] **Step 4: Format + lint the changed file**

Run:

```bash
./node_modules/.bin/biome format --write src/server/auth.ts
./node_modules/.bin/biome lint src/server/auth.ts
```

Expected: format applies (likely no-op). Lint diagnostics on `auth.ts` should be the same count as before (it's only a 3-line behavior change inside an existing block).

- [ ] **Step 5: Commit**

```bash
git add src/server/auth.ts
git commit -m "$(cat <<'EOF'
feat(auth): wire magic-link sender to Resend transport

Replaces the Phase 4 stub (console.log in dev, throw in prod) with a
one-line delegation to sendMagicLinkEmail. All env branching, transport,
logging, and preview-file logic lives in src/server/email/send.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Update `.env.example`

**Files:**
- Modify: `.env.example` (the `# ── Email (Resend) ── Phase 4 only ──` block at the bottom)

- [ ] **Step 1: Replace the existing Phase 4 block**

Open `.env.example`. Find the block:

```
# ── Email (Resend) ── Phase 4 only ─────────────────────────────────────────
# Not needed for local dev — magic links are logged to the server console.
# Sign up at https://resend.com and fill this in before production deploy.
# RESEND_API_KEY=re_xxxxxxxxxxxx
```

Replace it with:

```
# ── Email (Resend) ─────────────────────────────────────────────────────────
# Sign up at https://resend.com and paste your API key.
# In dev, this is only consulted when EMAIL_DEV_MODE=send (see below).
RESEND_API_KEY=

# Friendly-name + sender address. Until you verify your own domain in Resend,
# you must send from "onboarding@resend.dev". Once your domain is verified,
# swap to e.g. "kerf <hello@kerf.app>" — no code change needed.
EMAIL_FROM=kerf <onboarding@resend.dev>

# Dev-only: "send" actually sends real emails to your inbox (handy for
# checking how Gmail/Apple Mail render the template). "log" (default)
# just console-logs the magic-link URL. Ignored in production.
EMAIL_DEV_MODE=log
```

Two changes from the prior block: (a) the `Phase 4 only` marker is gone (Phase 4 is now), (b) two new env vars are documented.

- [ ] **Step 2: Verify the file is still valid shell-style env syntax**

Run:

```bash
grep -nE '^[A-Z_]+=' .env.example
```

Expected: lists every uncommented env var, including `RESEND_API_KEY=`, `EMAIL_FROM=kerf <onboarding@resend.dev>`, `EMAIL_DEV_MODE=log`.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "$(cat <<'EOF'
docs(env): document EMAIL_FROM + EMAIL_DEV_MODE; drop Phase 4 marker

Phase 4 is now (Resend transport just landed in src/server/email/).
Update .env.example to reflect the three relevant vars:
  - RESEND_API_KEY (required in prod, optional in dev unless
    EMAIL_DEV_MODE=send)
  - EMAIL_FROM (defaults to "kerf <onboarding@resend.dev>" — swap
    once a custom domain is verified in Resend)
  - EMAIL_DEV_MODE=log|send (dev-only opt-in for real sends)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Create `DEPLOYMENT.md`

**Files:**
- Create: `DEPLOYMENT.md` (repo root)

- [ ] **Step 1: Create the file**

Create `DEPLOYMENT.md` (at the repo root, alongside `README.md`):

````markdown
# Deployment checklist

This document tracks the **developer-scope** actions required before
deploying kerf to production. Per CLAUDE.md §B9, anything that touches
production secrets, the VPS, or external service dashboards lives here
— Claude Code generates artifacts but does not execute these steps.

---

## Email (Resend)

- [ ] Sign up at <https://resend.com> (free tier: 3,000 emails / month).
- [ ] Paste the API key into the production `.env` as `RESEND_API_KEY`.
- [ ] **Verify your sending domain** at <https://resend.com/domains>:
  add the SPF + DKIM TXT records to your DNS provider (Cloudflare,
  Route 53, Namecheap, etc.), then click "Verify" in the Resend
  dashboard. Until verified, sends are restricted to
  `onboarding@resend.dev`.
- [ ] Once verified, set `EMAIL_FROM` in the production `.env` to your
  branded address — e.g. `kerf <hello@kerf.app>`. No code change is
  needed; `src/server/email/send.ts` reads this env var with the
  sandbox sender as the default fallback.
- [ ] Smoke test after first deploy: trigger a magic-link send from the
  production `/login` page. Confirm the email arrives within ~30
  seconds and renders correctly in **at minimum** Gmail web + Apple
  Mail. (See `docs/superpowers/specs/2026-04-26-magic-link-email-design.md`
  §11 for the full manual test plan.)
````

- [ ] **Step 2: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "$(cat <<'EOF'
docs(deploy): add DEPLOYMENT.md with Resend domain-verification steps

First entry in the developer-scope deploy checklist (§B9). Tracks
the actions required to take the magic-link email from the sandbox
sender (onboarding@resend.dev) to a verified custom domain.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final verification sweep

**Files:** none modified. This is the §B12-mandated end-of-slice check.

- [ ] **Step 1: Capture pre-existing lint baseline from `origin/main`**

Run:

```bash
git fetch origin main
git stash --include-untracked 2>/dev/null || true
git checkout origin/main -- . 2>/dev/null
./node_modules/.bin/biome lint . --reporter=summary 2>&1 | tail -3 > /tmp/kerf-lint-baseline.txt
git checkout HEAD -- .
git stash pop 2>/dev/null || true
cat /tmp/kerf-lint-baseline.txt
```

Expected: prints summary line like `Found N errors, M warnings, K infos`. Record these numbers. (If the stash dance feels risky, simpler: `git diff origin/main..HEAD --stat` to see your changes haven't touched anything weird, and trust that you only added new files which lint clean.)

**Alternative simpler approach (recommended):** since this slice only ADDS new files plus a 3-line edit to `auth.ts`, just verify your new files lint clean:

```bash
./node_modules/.bin/biome lint src/server/email/ src/server/auth.ts --reporter=summary | tail -5
```

Expected: zero errors, zero warnings on these specific paths. (Pre-existing repo-wide diagnostics are out of scope per §A3 / §B12.)

- [ ] **Step 2: Format the entire repo**

Run:

```bash
./node_modules/.bin/biome format --write .
git status
```

Expected: `git status` shows no modified files (the per-task format steps already touched everything new). If there ARE modifications, those are pre-existing format drift on files this work didn't touch — **leave them alone**, do NOT commit them as part of this slice (per §A3 surgical-changes rule and §B12 dedicated-mechanical-commit rule).

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: all tests pass. New tests added: 8 in `magicLinkEmail.test.ts`, 12 in `send.test.ts`. The pre-existing `auth.test.ts` smoke test still passes.

If pre-existing tests fail (e.g. the typecheck-noise list from the brainstorm — `journey.test.ts`, `motionPatterns.test.ts`, etc.), those are **out of scope** for this slice. Document the count in your PR description so reviewers know what's pre-existing.

- [ ] **Step 4: Run typecheck**

Run:

```bash
pnpm typecheck 2>&1 | tail -30
```

Expected: zero errors **in `src/server/email/` and `src/server/auth.ts`**. Pre-existing typecheck errors elsewhere in the repo (per the brainstorm session diagnostic dump — `journey.test.ts`, `keyboards.tsx`, `KeyboardThumbnail.tsx`, etc.) are out of scope. Confirm none of your new files appear in the error output.

If your new files DO appear: fix them. Common cause: `as { message: unknown }` cast in `send.ts` may need adjustment if the `resend` SDK exports a more specific error type — let TypeScript guide you.

- [ ] **Step 5: Verify git history is clean**

Run:

```bash
git log --oneline -8
git status
```

Expected: 6 new commits on `feat/email-magic-link` (in addition to the 2 pre-existing — `b13b611` gitignore + `95e144c` spec):

1. `chore(deps): add resend SDK for magic-link email`
2. `feat(email): pure renderer for magic-link email (Paper template)`
3. `feat(email): Resend transport with dev/prod switch + preview file`
4. `feat(auth): wire magic-link sender to Resend transport`
5. `docs(env): document EMAIL_FROM + EMAIL_DEV_MODE; drop Phase 4 marker`
6. `docs(deploy): add DEPLOYMENT.md with Resend domain-verification steps`

`git status` should show only the unrelated `public/favicon-512.png` untracked file (which is not part of this work).

- [ ] **Step 6: Manual smoke test (developer)**

This is the final correctness check before opening the PR. Two flows:

**A. Dev default (no real send):**

```bash
# Make sure RESEND_API_KEY is unset OR EMAIL_DEV_MODE=log (default):
unset EMAIL_DEV_MODE
pnpm dev
```

In your browser: open `http://localhost:3000/login`, enter an email, click the magic-link button. In your terminal you should see:

```
[MAGIC LINK] you@example.com
  url:     http://localhost:3000/api/auth/magic-link/verify?token=...
  preview: /tmp/kerf-last-email.html
```

Then `open /tmp/kerf-last-email.html` and eyeball the rendered Paper template. It should look like the mockup approved during brainstorming (cream background, espresso text, amber CTA, Fraunces wordmark).

**B. Dev send (real inbox test) — only if you want to verify Gmail/Apple Mail rendering:**

```bash
EMAIL_DEV_MODE=send pnpm dev
```

Submit your real email at `/login`. Check your inbox within ~30 seconds. Verify:

- Subject is `Your kerf sign-in link`
- Wordmark renders (Fraunces if your client supports web fonts; Georgia/serif fallback otherwise)
- Amber CTA button is clickable and goes to `/api/auth/magic-link/verify?token=...`
- URL fallback box is monospaced and readable
- Footer disclaimer is present

If any of these are off, iterate on the inline CSS in `magicLinkEmail.ts`. Then re-run tests.

- [ ] **Step 7: Push and open PR**

```bash
git push origin feat/email-magic-link
```

Then open the PR. Suggested title:

> `feat(email): wire magic-link to Resend with kerf-branded HTML template`

Suggested body sections:

- **Summary** — 2-3 bullets covering: Resend transport added, kerf-branded Paper template, dev-mode safe defaults preserved.
- **Spec** — link `docs/superpowers/specs/2026-04-26-magic-link-email-design.md`.
- **Test plan** — checklist matching the manual smoke test above (both dev modes).
- **Out of scope** — note the pre-existing typecheck noise on main (per spec §12) is NOT addressed by this PR.
- **Status checklist** — per CLAUDE.md §B11, this work doesn't tick any specific numbered task in `README.md`'s `## Status` (Phase 4.6/4.7 are post-Phase-5 per `docs/03-task-breakdown.md`). Either leave the README unchanged OR add a new `Phase 4 / Email` line — confer with the user before pre-ticking.

---

## Done

That's the full plan. Once Task 7 step 7 is complete, `feat/email-magic-link` is ready for review. The branch contains 8 commits total (2 from brainstorming, 6 from implementation) and modifies/adds 8 files.
