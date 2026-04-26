/**
 * Pre-renders the kerf "kerf." wordmark as a PNG for use in transactional
 * email templates. Email clients (Outlook desktop, Gmail web in many
 * configurations) strip @font-face / web fonts, so the wordmark must
 * ship as a raster image to render the same as the in-app brand mark.
 *
 * Renders with the exact app styling — Fraunces wght 700 + opsz 144 +
 * SOFT 100, matching the AppNav/MobileGate wordmark CSS in src/styles.css.
 * opentype.js (used by extract-favicon-glyphs.mjs) cannot apply variable-
 * font axis settings, so Playwright is used here for full-fidelity rendering.
 *
 * Output:
 *   - public/email-logo.png — the asset, ~4x retina source so the ~30px
 *     CSS display height stays crisp on retina + 4K inboxes. Served
 *     statically by the app (see src/server/email/send.ts: EMAIL_LOGO_URL
 *     env var or the AUTH_URL-derived fallback). The renderer references
 *     it by absolute URL — Gmail strips inline data: URIs in <img> tags
 *     as an anti-phishing measure, so hosting is required.
 *
 * Run: `node scripts/generate-email-logo.mjs`
 *
 * Re-run whenever the wordmark spec changes (font, weight, axes, colors).
 */
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const FONT_PATH = join(ROOT, "public/fonts/Fraunces-Variable.woff2");
const PNG_OUT = join(ROOT, "public/email-logo.png");

// CSS pixel size we want the wordmark to render at in the email body.
// Matches the visual weight of the prior text wordmark (font-size: 30px).
const DISPLAY_FONT_SIZE_PX = 30;

// Browser-side render scale. 4x source so retina (2x) and high-DPI mobile
// (3x) clients both stay crisp without upsample blur. Larger source costs
// a few extra KB per email — acceptable for a transactional flow.
const RENDER_SCALE = 4;

const fontBase64 = readFileSync(FONT_PATH).toString("base64");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: "Fraunces";
    src: url("data:font/woff2;base64,${fontBase64}") format("woff2-variations");
    font-weight: 100 900;
    font-display: block;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
  }
  body { display: inline-block; }
  .wordmark {
    font-family: "Fraunces", Georgia, serif;
    font-weight: 700;
    font-variation-settings: "opsz" 144, "SOFT" 100;
    font-size: ${DISPLAY_FONT_SIZE_PX * RENDER_SCALE}px;
    letter-spacing: -0.01em;
    line-height: 1;
    color: #211a14;
    /* Asymmetric padding gives the descenderless "kerf." enough room
       for caps-top + period-bottom without ballooning the bbox. */
    padding: 4px 12px 16px 8px;
    display: inline-block;
  }
  .period { color: #F59E0B; }
</style>
</head>
<body>
  <span class="wordmark">kerf<span class="period">.</span></span>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage({
  deviceScaleFactor: 1,
  viewport: { width: 1600, height: 400 },
});
await page.setContent(html);
// Wait for the embedded font to actually load — without this, Playwright
// occasionally screenshots the Georgia fallback before the woff2 finishes
// decoding from the data URI.
await page.evaluate(() => document.fonts.ready);

mkdirSync(dirname(PNG_OUT), { recursive: true });

const wordmark = page.locator(".wordmark").first();
await wordmark.screenshot({
  path: PNG_OUT,
  omitBackground: true,
});

await browser.close();

// Echo dimensions so the operator can keep the LOGO_WIDTH_PX / LOGO_HEIGHT_PX
// constants in src/server/email/magicLinkEmail.ts in sync (the renderer ships
// width/height attrs on the <img> tag so email clients downscale correctly
// when CSS is stripped).
const pngBuf = readFileSync(PNG_OUT);
const { width: srcW, height: srcH } = await sharp(pngBuf).metadata();
const displayW = Math.round(srcW / RENDER_SCALE);
const displayH = Math.round(srcH / RENDER_SCALE);

console.log(`wrote ${PNG_OUT} (${pngBuf.length} bytes, ${srcW}x${srcH}px source)`);
console.log(`display dimensions: ${displayW}x${displayH}px`);
console.log(
  `→ verify LOGO_WIDTH_PX=${displayW} and LOGO_HEIGHT_PX=${displayH} in src/server/email/magicLinkEmail.ts`,
);
