// Production HTTP entrypoint for kerf.
//
// TanStack Start's vite build emits a fetch-style handler at
// dist/server/server.js — it does not start an HTTP listener and
// does not serve the static client bundle. This script wraps the
// handler with a Node listener (via srvx, already installed as a
// transitive of h3) and mounts srvx's serveStatic middleware over
// dist/client/. Requires a prior `pnpm build`.
//
// srvx reads PORT from env (default 3000). Hostname is pinned to
// 0.0.0.0 so containers and reverse proxies can reach it.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "srvx";
import { serveStatic } from "srvx/static";
import handler from "../dist/server/server.js";

const distRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");

// /corpus.json is a 1.6 MB build artifact whose contents are pinned by
// the runtime's CORPUS_VERSION (see src/domain/corpus/loader.ts). The
// client fetches it as `/corpus.json?v=${CORPUS_VERSION}`, so a long-
// lived browser cache is always invalidated by a version bump — making
// the response safely `immutable`. srvx.serveStatic doesn't expose a
// cache-headers hook, so we wrap it with a small post-response
// middleware. Without this, refreshes pay the full ~4s download
// (Cloudflare doesn't cache .json by default; cf-cache-status: DYNAMIC).
const IMMUTABLE_PATHS = new Set(["/corpus.json"]);
const immutableCacheHeaders = async (req, next) => {
  const res = await next();
  if (res.status !== 200) return res;
  const pathname = new URL(req.url).pathname;
  if (!IMMUTABLE_PATHS.has(pathname)) return res;
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

// HTML responses must revalidate on every navigation. Without this,
// browsers cache the SSR document and on subsequent visits replay it
// against bundle hashes from a stale deploy — JS chunks 404, React
// fails to hydrate, and pages render visually but with no event
// handlers wired up (symptom: buttons un-clickable until hard refresh).
// `no-cache` allows the browser to keep the document but forces a
// conditional revalidation request; `must-revalidate` forbids serving
// stale on network error. Static assets are unaffected — they're
// served with content-hashed filenames and are safe to cache long.
const htmlNoCacheHeaders = async (_req, next) => {
  const res = await next();
  if (res.status !== 200) return res;
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return res;
  const headers = new Headers(res.headers);
  headers.set("Cache-Control", "no-cache, must-revalidate");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};

serve({
  hostname: "0.0.0.0",
  middleware: [
    htmlNoCacheHeaders,
    immutableCacheHeaders,
    serveStatic({ dir: join(distRoot, "client") }),
  ],
  fetch: (req) => handler.fetch(req),
});
