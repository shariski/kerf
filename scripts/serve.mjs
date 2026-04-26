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

serve({
  hostname: "0.0.0.0",
  middleware: [serveStatic({ dir: join(distRoot, "client") })],
  fetch: (req) => handler.fetch(req),
});
