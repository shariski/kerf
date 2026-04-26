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
