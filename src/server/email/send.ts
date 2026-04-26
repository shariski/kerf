import { writeFile } from "node:fs/promises";
import { Resend } from "resend";
import { renderMagicLinkEmail } from "./magicLinkEmail";

/**
 * Transport-level input — narrower than the renderer's input. The
 * renderer also needs `logoUrl`, but better-auth (the caller in
 * src/server/auth.ts) only knows email + url. The logo URL is composed
 * from env inside this module so callers don't have to plumb it through.
 */
export type SendMagicLinkInput = {
  email: string;
  url: string;
};

const PREVIEW_FILE_PATH = "/tmp/kerf-last-email.html";
const DEFAULT_FROM = "kerf <onboarding@resend.dev>";

/**
 * Default fallback when EMAIL_LOGO_URL and AUTH_URL are both unset.
 * Points at the committed asset on the main branch — once the kerf
 * domain is live, set EMAIL_LOGO_URL=https://typekerf.com/email-logo.png
 * in the production env (see DEPLOYMENT.md and .env.example).
 */
const DEFAULT_LOGO_URL =
  "https://raw.githubusercontent.com/shariski/kerf/main/public/email-logo.png";

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

function getEmailLogoUrl(): string {
  // Explicit override always wins. Use this in production with your
  // own CDN URL or a /email-logo.png served by the app domain.
  if (process.env.EMAIL_LOGO_URL) return process.env.EMAIL_LOGO_URL;
  // Auto-derive from AUTH_URL — works once the app is reachable from
  // the public internet (the recipient's mail client must be able to
  // load the image src). In dev with localhost, Gmail can't reach the
  // local asset, so the rendered email shows a broken-image icon
  // unless EMAIL_LOGO_URL overrides this. The DEFAULT_LOGO_URL is the
  // last-resort fallback (the committed asset on GitHub raw).
  const base = process.env.AUTH_URL;
  if (base && !base.includes("localhost") && !base.includes("127.0.0.1")) {
    return `${base.replace(/\/$/, "")}/email-logo.png`;
  }
  return DEFAULT_LOGO_URL;
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
  input: SendMagicLinkInput,
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
    // result is a discriminated union: { data, error: null } | { data: null, error: ErrorResponse }
    // ErrorResponse has a .message string property.
    if (result.error) {
      throw new Error(`Resend returned error: ${result.error.message}`);
    }
  } catch (err) {
    console.error("[magic-link] Resend send failed:", err);
    throw err;
  }
}

export async function sendMagicLinkEmail(input: SendMagicLinkInput): Promise<void> {
  const rendered = renderMagicLinkEmail({ ...input, logoUrl: getEmailLogoUrl() });
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
