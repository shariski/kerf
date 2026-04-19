import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";

/**
 * Placeholder for Phase 3 Task 3.2. The AppNav links here, so we need
 * a typed route to exist even though the real dashboard implementation
 * lands later.
 */
export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  return (
    <main className="kerf-placeholder-page">
      <div className="kerf-placeholder-content">
        <h1 className="kerf-placeholder-title">Dashboard</h1>
        <p className="kerf-placeholder-body">
          Detailed stats, heatmap, weakness ranking, and engine insights land
          with Phase 3 Task 3.2.
        </p>
      </div>
    </main>
  );
}
