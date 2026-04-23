import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import { getActiveProfile, updateFingerAssignment } from "#/server/profile";
import type { JourneyCode } from "#/domain/adaptive/journey";
import { toJourneyCode } from "#/domain/adaptive/journey";
import { AppFooter } from "#/components/nav/AppFooter";

const JOURNEY_OPTIONS = [
  {
    value: "conventional" as const,
    label: "Like QWERTY, just on a split board",
    description:
      "Fingers reach diagonally the way they did on your old keyboard; F and J are home.",
  },
  {
    value: "columnar" as const,
    label: "One finger per column",
    description:
      "Each finger stays on its own column. Inner columns (B, N) are new reach territory.",
  },
  {
    value: "unsure" as const,
    label: "I'm not sure",
    description: "We'll make a good guess based on how you type.",
  },
] as const satisfies ReadonlyArray<{
  value: JourneyCode;
  label: string;
  description: string;
}>;

function labelFor(journey: JourneyCode): string {
  return JOURNEY_OPTIONS.find((o) => o.value === journey)?.label ?? journey;
}

type LoadedSettings = {
  fingerAssignment: JourneyCode;
};

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<LoadedSettings> => {
    const profile = await getActiveProfile();
    if (!profile) throw redirect({ to: "/onboarding" });
    return {
      fingerAssignment: toJourneyCode(profile.fingerAssignment),
    };
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { fingerAssignment } = Route.useLoaderData();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [choice, setChoice] = useState<JourneyCode>(fingerAssignment);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateFingerAssignment({ data: { journey: choice } });
      await router.invalidate();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save — try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <main
        id="main-content"
        style={{
          minHeight: "100vh",
          maxWidth: "700px",
          margin: "0 auto",
          padding: "48px 24px 80px",
        }}
      >
        <header style={{ marginBottom: "40px" }}>
          <h1
            className="text-kerf-text-primary tracking-tight"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "28px",
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            Settings
          </h1>
        </header>

        <section aria-labelledby="finger-assignment-heading">
          <h2
            id="finger-assignment-heading"
            className="text-kerf-text-primary"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "16px",
              fontWeight: 600,
              marginBottom: "4px",
            }}
          >
            Finger assignment
          </h2>
          <p
            className="text-kerf-text-secondary"
            style={{ fontSize: "13px", lineHeight: 1.6, marginBottom: "16px" }}
          >
            How you position your fingers on the split board. The engine uses this to weight targets
            correctly.
          </p>

          {!editing ? (
            <div
              className="flex items-center justify-between rounded-xl border border-kerf-border-subtle bg-kerf-bg-surface"
              style={{ padding: "16px 20px" }}
            >
              <p className="text-kerf-text-primary" style={{ fontSize: "15px", fontWeight: 500 }}>
                {labelFor(fingerAssignment)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setChoice(fingerAssignment);
                  setEditing(true);
                }}
                className="text-kerf-amber-base"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "13px",
                  fontWeight: 600,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "0",
                }}
              >
                Change
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">
                <legend className="sr-only">Finger assignment style</legend>
                {JOURNEY_OPTIONS.map((opt) => {
                  const isSelected = choice === opt.value;
                  const descId = `settings-desc-${opt.value}`;
                  return (
                    <label
                      key={opt.value}
                      className={
                        "flex gap-4 items-start rounded-xl cursor-pointer transition-all duration-200 " +
                        (isSelected
                          ? "border-2 border-kerf-amber-base bg-kerf-amber-faint"
                          : "border-2 border-kerf-border-subtle bg-kerf-bg-surface hover:border-kerf-border-strong")
                      }
                      style={{ padding: "16px 20px" }}
                    >
                      <input
                        type="radio"
                        name="fingerAssignment"
                        value={opt.value}
                        checked={isSelected}
                        onChange={() => setChoice(opt.value)}
                        aria-describedby={descId}
                        className="mt-1 flex-shrink-0 accent-kerf-amber-base"
                        style={{ width: "16px", height: "16px" }}
                      />
                      <div className="flex-1">
                        <p
                          className="text-kerf-text-primary mb-1"
                          style={{ fontSize: "15px", fontWeight: 600, lineHeight: 1.3 }}
                        >
                          {opt.label}
                        </p>
                        <p
                          id={descId}
                          className="text-kerf-text-secondary"
                          style={{ fontSize: "13px", lineHeight: 1.6 }}
                        >
                          {opt.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </fieldset>

              {error ? (
                <p className="text-kerf-text-primary" role="alert" style={{ fontSize: "13px" }}>
                  {error}
                </p>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="px-5 py-2 rounded-lg text-kerf-bg-surface font-semibold bg-kerf-amber-base disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: "14px" }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditing(false)}
                  className="px-5 py-2 rounded-lg border border-kerf-border-subtle text-kerf-text-secondary disabled:opacity-40"
                  style={{ fontSize: "14px", background: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
      <AppFooter />
    </>
  );
}
