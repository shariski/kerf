import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import { getActiveProfile } from "#/server/profile";
import { TypingArea } from "#/components/TypingArea";
import { useSessionStore } from "#/stores/sessionStore";

export const Route = createFileRoute("/practice")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
    const profile = await getActiveProfile();
    if (!profile) throw redirect({ to: "/onboarding" });
  },
  component: PracticePage,
});

const SCAFFOLD_TARGET =
  "the quick brown fox jumps over the lazy dog and then the nimble cat naps";

function PracticePage() {
  const status = useSessionStore((s) => s.status);
  const dispatch = useSessionStore((s) => s.dispatch);

  return (
    <main className="min-h-screen bg-kerf-bg-base px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <p
          className="text-kerf-text-tertiary mb-6"
          style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
        >
          Typing area preview — Task 2.3 (full page lands in 2.4)
        </p>
        <TypingArea target={SCAFFOLD_TARGET} />
        {status === "complete" && (
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "start",
                target: SCAFFOLD_TARGET,
                now: performance.now(),
              })
            }
            className="mt-8 border border-kerf-amber-base px-4 py-2 text-kerf-amber-base hover:bg-kerf-amber-subtle"
            style={{ fontFamily: "var(--font-mono)", fontSize: "13px" }}
          >
            restart
          </button>
        )}
      </div>
    </main>
  );
}
