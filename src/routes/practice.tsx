import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import { getActiveProfile } from "#/server/profile";

export const Route = createFileRoute("/practice")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
    const profile = await getActiveProfile();
    if (!profile) throw redirect({ to: "/onboarding" });
  },
  component: PracticePage,
});

function PracticePage() {
  return (
    <main className="min-h-screen bg-kerf-bg-base flex items-center justify-center px-6">
      <p
        className="text-kerf-text-secondary text-center"
        style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
      >
        Practice — coming in Task 2.4.
      </p>
    </main>
  );
}
