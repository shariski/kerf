import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";

/**
 * Placeholder for Phase 3 Task 3.5 (multi-keyboard switcher). AppNav
 * links here; real profile management UI lands with the dashboard
 * work.
 */
export const Route = createFileRoute("/keyboards")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: KeyboardsPlaceholder,
});

function KeyboardsPlaceholder() {
  return (
    <main className="kerf-placeholder-page">
      <div className="kerf-placeholder-content">
        <h1 className="kerf-placeholder-title">Keyboards</h1>
        <p className="kerf-placeholder-body">
          Profile switcher and per-keyboard stats arrive with Phase 3 Task 3.5.
        </p>
      </div>
    </main>
  );
}
