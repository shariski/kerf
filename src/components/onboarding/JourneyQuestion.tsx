import type { JourneyCode } from "#/domain/adaptive/journey";

const JOURNEY_OPTIONS = [
  {
    value: "conventional" as const,
    label: "Like QWERTY, just on a split board",
    description:
      "Fingers reach diagonally the way they did on your old keyboard; F and J are home. Common for people coming directly from standard QWERTY. No re-learning of finger placements.",
  },
  {
    value: "columnar" as const,
    label: "One finger per column",
    description:
      "Each finger stays on its own column; you've retrained your fingers to the columnar layout. Common among people who took the full columnar plunge. Inner columns (B, N) are new reach territory.",
  },
  {
    value: "unsure" as const,
    label: "I'm not sure",
    description:
      "We'll make a good guess based on how you type and you can change this later.",
  },
] as const satisfies ReadonlyArray<{
  value: JourneyCode;
  label: string;
  description: string;
}>;

export function JourneyQuestion({
  selected,
  onSelect,
}: {
  selected: JourneyCode;
  onSelect: (v: JourneyCode) => void;
}) {
  return (
    <div className="w-full flex flex-col items-center">
      <p
        className="text-kerf-amber-base mb-3 text-center"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        your typing style
      </p>
      <h1
        className="text-center mb-3 max-w-[700px] mx-auto tracking-tight"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "36px",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        How do you type on your split keyboard?
      </h1>
      <p
        className="text-kerf-text-secondary text-center mb-10 max-w-[560px] mx-auto"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          lineHeight: 1.6,
        }}
      >
        This helps the engine weight finger-column targets correctly from the
        start.
      </p>

      <fieldset className="grid grid-cols-1 gap-4 max-w-[700px] w-full border-0 p-0 m-0">
        <legend className="sr-only">Finger assignment style</legend>
        {JOURNEY_OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          const descId = `journey-desc-${opt.value}`;
          return (
            <label
              key={opt.value}
              className={
                "flex gap-4 items-start rounded-xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 " +
                (isSelected
                  ? "border-2 border-kerf-amber-base bg-kerf-amber-faint"
                  : "border-2 border-kerf-border-subtle bg-kerf-bg-surface hover:border-kerf-border-strong")
              }
              style={{ padding: "20px 24px" }}
            >
              <input
                type="radio"
                name="fingerAssignment"
                value={opt.value}
                checked={isSelected}
                onChange={() => onSelect(opt.value)}
                aria-describedby={descId}
                className="mt-1 flex-shrink-0 accent-kerf-amber-base"
                style={{ width: "16px", height: "16px" }}
              />
              <div className="flex-1">
                <p
                  className="text-kerf-text-primary mb-1"
                  style={{ fontSize: "16px", fontWeight: 600, lineHeight: 1.3 }}
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

      <p
        className="mt-6 text-kerf-text-tertiary text-center"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "13px",
          fontStyle: "italic",
        }}
      >
        You can change this anytime in Settings.
      </p>
    </div>
  );
}
