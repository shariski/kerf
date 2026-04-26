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
