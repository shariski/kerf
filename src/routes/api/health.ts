import { createFileRoute } from "@tanstack/react-router";

// Liveness probe for the reverse proxy / orchestrator. Static JSON
// rather than a DB ping — a failing DB will manifest in real traffic
// regardless, and probing every few seconds against Postgres adds
// load and lets transient connection saturation flap the upstream
// off. If we ever need a deeper readiness check, add a second
// /api/ready route instead of overloading this one.
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () => Response.json({ ok: true }),
    },
  },
});
