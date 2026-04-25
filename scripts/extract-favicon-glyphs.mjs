/**
 * One-shot script — extracts the Fraunces lowercase "k" and "." glyphs
 * and writes them as raw SVG paths to stdout. The output is hand-pasted
 * into public/favicon.svg so the favicon glyph matches the page
 * wordmark exactly without loading the woff2 at favicon-render time.
 *
 * Run: `node scripts/extract-favicon-glyphs.mjs`
 *
 * Caveat: opentype.js doesn't apply variable-font axis settings; we get
 * the font's default instance. For the favicon's purpose (matching the
 * brand "kerf." wordmark glyph shape rather than the full SOFT 100
 * treatment) the default instance is close enough.
 */
import opentype from "opentype.js";
import { decompress } from "wawoff2";
import { readFileSync } from "node:fs";

const woff2 = readFileSync("public/fonts/Fraunces-Variable.woff2");
const ttf = await decompress(woff2);
const font = opentype.parse(ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));

for (const ch of ["k", "."]) {
  const glyph = font.charToGlyph(ch);
  const size = 48;
  const scale = size / font.unitsPerEm;
  const path = glyph.getPath(0, 44, size);
  console.log(`/* ${ch} */ ${path.toPathData(2)}`);
  console.log(`  advance=${(glyph.advanceWidth * scale).toFixed(2)}`);
}
