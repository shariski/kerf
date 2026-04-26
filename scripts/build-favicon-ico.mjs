/**
 * Renders public/favicon.svg into public/favicon.ico at the standard
 * favicon raster sizes (16/32/48). Run once after editing the SVG to
 * keep legacy browsers and Chrome's sticky favicon-cache in sync with
 * the modern SVG icon.
 *
 * Run: `node scripts/build-favicon-ico.mjs`
 */
import sharp from "sharp";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync } from "node:fs";

const svg = readFileSync("public/favicon.svg");

// Standard favicon raster sizes. 16 covers tab strip; 32 covers retina
// tabs and most macOS dock previews; 48 covers Windows taskbar.
const sizes = [16, 32, 48];

const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(svg, { density: 384 }) // 384 DPI rasterizes at 4x of 96 baseline; high enough that 48px output stays crisp
      .resize(size, size)
      .png()
      .toBuffer(),
  ),
);

const ico = await pngToIco(pngs);
writeFileSync("public/favicon.ico", ico);
console.log(`wrote public/favicon.ico (${ico.length} bytes, ${sizes.join("/")}px)`);
