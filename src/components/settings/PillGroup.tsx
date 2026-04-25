import type { ReactNode } from "react";

type PillGroupProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  value: T;
  onChange?: (value: T) => void;
  disabled?: boolean;
  ariaLabel: string;
};

export function PillGroup<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: PillGroupProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className="flex border border-kerf-border-subtle bg-kerf-bg-surface"
      style={{ gap: "4px", borderRadius: "6px", padding: "2px" }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: custom-styled pill toggle group; native <input type="radio"> can't host arbitrary children/styles. ARIA APG radio-group pattern.
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange?.(opt.value);
            }}
            className={
              active
                ? "bg-kerf-amber-base text-kerf-text-inverse"
                : "text-kerf-text-secondary hover:text-kerf-text-primary"
            }
            style={{
              padding: "6px 12px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: active ? 600 : 400,
              border: "none",
              background: active ? undefined : "transparent",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.6 : 1,
              fontFamily: "var(--font-sans)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
