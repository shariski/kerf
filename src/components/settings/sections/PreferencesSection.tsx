import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import type { JourneyCode } from "#/domain/adaptive/journey";
import { updateFingerAssignment } from "#/server/profile";
import { FieldRow } from "../FieldRow";
import { PillGroup } from "../PillGroup";
import { ToggleSwitch } from "../ToggleSwitch";

type PreferencesSectionProps = {
  activeProfile: {
    keyboardType: string;
    fingerAssignment: JourneyCode;
  };
};

const FA_OPTIONS = [
  { value: "conventional" as const, label: "Conventional" },
  { value: "columnar" as const, label: "Columnar" },
  { value: "unsure" as const, label: "Unsure" },
] as const;

const MODE_OPTIONS = [
  { value: "adaptive" as const, label: "Adaptive" },
  { value: "drill" as const, label: "Drill" },
  { value: "ask" as const, label: "Ask each time" },
] as const;

const KB_VISIBILITY_OPTIONS = [
  { value: "visible" as const, label: "Visible" },
  { value: "hidden" as const, label: "Hidden" },
] as const;

export function PreferencesSection({ activeProfile }: PreferencesSectionProps) {
  const router = useRouter();
  const [savingFA, setSavingFA] = useState(false);
  const [faError, setFAError] = useState<string | null>(null);

  const handleFAChange = async (next: JourneyCode) => {
    if (next === activeProfile.fingerAssignment || savingFA) return;
    setSavingFA(true);
    setFAError(null);
    try {
      await updateFingerAssignment({ data: { journey: next } });
      await router.invalidate();
    } catch (err) {
      setFAError(err instanceof Error ? err.message : "Could not save — try again.");
    } finally {
      setSavingFA(false);
    }
  };

  return (
    <section
      id="preferences"
      aria-labelledby="preferences-heading"
      style={{ padding: "32px 0", borderBottom: "1px solid var(--lr-border-subtle)" }}
    >
      <header style={{ marginBottom: "20px" }}>
        <h2
          id="preferences-heading"
          className="text-kerf-text-primary"
          style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px" }}
        >
          Preferences
        </h2>
        <p className="text-kerf-text-secondary" style={{ fontSize: "13px" }}>
          How practice sessions behave by default.
        </p>
      </header>

      <FieldRow
        labelName="Finger assignment"
        labelHint={`for active profile · ${activeProfile.keyboardType}`}
      >
        <div className="flex items-center" style={{ gap: "12px" }}>
          <PillGroup
            options={FA_OPTIONS}
            value={activeProfile.fingerAssignment}
            onChange={handleFAChange}
            disabled={savingFA}
            ariaLabel="Finger assignment"
          />
          {faError ? (
            <span role="alert" className="text-kerf-text-primary" style={{ fontSize: "12px" }}>
              {faError}
            </span>
          ) : null}
        </div>
      </FieldRow>

      <FieldRow labelName="Default practice mode" labelHint="what loads when opening /practice">
        <PillGroup
          options={MODE_OPTIONS}
          value="adaptive"
          disabled
          ariaLabel="Default practice mode"
        />
      </FieldRow>

      <FieldRow labelName="Visual keyboard default" labelHint="per-session override via Ctrl+K">
        <PillGroup
          options={KB_VISIBILITY_OPTIONS}
          value="visible"
          disabled
          ariaLabel="Visual keyboard default"
        />
      </FieldRow>

      <FieldRow labelName="Reduce motion" labelHint="disable animations & flashing feedback">
        <div className="flex items-center" style={{ gap: "12px" }}>
          <span
            className="text-kerf-text-tertiary"
            style={{ fontSize: "12px", fontFamily: "var(--font-mono)" }}
          >
            off
          </span>
          <ToggleSwitch on={false} disabled ariaLabel="Reduce motion" />
        </div>
      </FieldRow>

      <FieldRow labelName="Sound effects" labelHint="subtle click on keypress">
        <div className="flex items-center" style={{ gap: "12px" }}>
          <span
            className="text-kerf-text-tertiary"
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              fontStyle: "italic",
            }}
          >
            coming in v2
          </span>
          <ToggleSwitch on={false} disabled ariaLabel="Sound effects" />
        </div>
      </FieldRow>
    </section>
  );
}
