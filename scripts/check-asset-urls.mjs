// Build-time guard: every "/assets/<file>" URL referenced from
// dist/server/**/*.js must correspond to a file that physically exists
// either in dist/client/assets/ (browser-bound, served by serveStatic)
// or in dist/server/assets/ (SSR-internal chunks resolved by Node's
// import path). A URL that exists in neither is a dangling reference
// that will 404 at runtime — exactly the class of bug that produces
// SSR/client hash drift (e.g. the Tailwind v4 styles-*.css case that
// sync-ssr-css.mjs patches).
//
// Runs after sync-ssr-css.mjs in the build pipeline so a successful
// patch passes the check; an unpatchable drift fails the build.

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientAssets = join(root, "dist/client/assets");
const serverAssets = join(root, "dist/server/assets");
const serverDir = join(root, "dist/server");

const existing = new Set([...readdirSync(clientAssets), ...readdirSync(serverAssets)]);
const referenced = new Set();
const missing = new Set();

const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(js|mjs|cjs)$/.test(entry.name)) continue;
    const content = readFileSync(full, "utf8");
    const matches = content.match(/\/assets\/[A-Za-z0-9_.-]+\.[A-Za-z0-9]+/g) ?? [];
    for (const url of matches) {
      referenced.add(url);
      const file = url.slice("/assets/".length);
      if (!existing.has(file)) missing.add(url);
    }
  }
};
walk(serverDir);

if (missing.size > 0) {
  console.error(`check-asset-urls: ${missing.size} dangling /assets/ URL(s) in dist/server/:`);
  for (const url of missing) console.error(`  ✘ ${url}`);
  console.error(
    `check-asset-urls: ${existing.size} files exist across dist/{client,server}/assets/; ${referenced.size} referenced from dist/server/.`,
  );
  process.exit(1);
}

console.log(`check-asset-urls: all ${referenced.size} referenced /assets/ URL(s) resolve.`);
