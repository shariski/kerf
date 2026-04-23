import { useState } from "react";
import type { JourneyCode } from "#/domain/adaptive/journey";

type Props = {
  onSubmit: (journey: JourneyCode) => void;
};

const OPTIONS = [
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
    description: "We'll make a good guess based on how you type. You can change this in Settings.",
  },
] as const satisfies ReadonlyArray<{
  value: JourneyCode;
  label: string;
  description: string;
}>;

export function JourneyCaptureCard({ onSubmit }: Props) {
  const [choice, setChoice] = useState<JourneyCode | null>(null);

  return (
    <div
      className="w-full max-w-[700px] mx-auto flex flex-col gap-6 rounded-2xl border border-kerf-border-subtle bg-kerf-bg-surface"
      style={{ padding: "32px 36px" }}
    >
      <div>
        <p
          className="text-kerf-amber-base mb-3"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          a quick question
        </p>
        <h2
          className="text-kerf-text-primary mb-2 tracking-tight"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "24px",
            fontWeight: 700,
            lineHeight: 1.2,
          }}
        >
          How do you type on your split keyboard?
        </h2>
        <p
          className="text-kerf-text-secondary"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "14px",
            lineHeight: 1.6,
          }}
        >
          We recently updated the engine to adapt to how you've set up your fingers. This helps it
          weight targets correctly from the start.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3 border-0 p-0 m-0">
        <legend className="sr-only">Finger assignment style</legend>
        {OPTIONS.map((opt) => {
          const isSelected = choice === opt.value;
          const descId = `capture-desc-${opt.value}`;
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
                name="journey"
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

      <button
        type="button"
        disabled={choice === null}
        onClick={() => {
          if (choice !== null) onSubmit(choice);
        }}
        className="self-start px-5 py-2 rounded-lg text-kerf-bg-surface font-semibold bg-kerf-amber-base disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ fontSize: "14px" }}
      >
        Save
      </button>
    </div>
  );
}
