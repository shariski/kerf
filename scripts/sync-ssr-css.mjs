// Tanstack Start + Tailwind v4 SSR/client CSS-hash drift workaround.
//
// The SSR Vite pass and the client Vite pass emit content-hashed
// stylesheet filenames independently. When Tailwind v4's JIT observes
// a slightly different module graph between passes, the two hashes
// diverge: the SSR bundle bakes "/assets/styles-<ssr>.css" as a string
// literal into dist/server/assets/router-*.js, but only the client's
// "/assets/styles-<client>.css" is actually written to disk. The SSR-
// rendered HTML then references a 404, and the page paints unstyled
// until client hydration injects the correct link.
//
// This post-build step reads the real client-emitted CSS filename and
// rewrites every drifted "/assets/styles-*.css" reference under
// dist/server/ to match. Idempotent — when hashes already align it
// touches no files.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientAssets = join(root, "dist/client/assets");
const serverDir = join(root, "dist/server");

const cssFiles = readdirSync(clientAssets).filter((f) => /^styles-.*\.css$/.test(f));
if (cssFiles.length !== 1) {
  throw new Error(
    `sync-ssr-css: expected exactly one styles-*.css in ${clientAssets}, got ${cssFiles.length}`,
  );
}
const correctUrl = `/assets/${cssFiles[0]}`;

let patched = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(js|mjs|cjs)$/.test(entry.name)) continue;
    const before = readFileSync(full, "utf8");
    const after = before.replace(/\/assets\/styles-[A-Za-z0-9_.-]+\.css/g, correctUrl);
    if (after !== before) {
      writeFileSync(full, after);
      patched += 1;
      console.log(`  patched ${full.replace(`${root}/`, "")}`);
    }
  }
};

console.log(`sync-ssr-css: target = ${correctUrl}`);
walk(serverDir);
console.log(
  patched > 0
    ? `sync-ssr-css: rewrote ${patched} file(s)`
    : "sync-ssr-css: nothing to patch (hashes already aligned)",
);
