type InlineEditFieldProps = {
  value: string | null;
  emptyLabel?: string;
  ariaLabel: string;
};

export const COMING_SOON_HINT = "coming soon";

export function InlineEditField({
  value,
  emptyLabel = "— not set",
  ariaLabel,
}: InlineEditFieldProps) {
  const isEmpty = value === null || value === "";
  return (
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> imposes block layout + requires <legend>; this primitive needs inline-flex row with aria-label naming.
    <div
      role="group"
      aria-label={ariaLabel}
      aria-disabled="true"
      title={COMING_SOON_HINT}
      className="group flex items-center"
      style={{
        gap: "8px",
        flex: 1,
        padding: "8px 12px",
        border: "1px solid transparent",
        borderRadius: "4px",
        cursor: "not-allowed",
      }}
    >
      <span
        className={isEmpty ? "text-kerf-text-secondary" : "text-kerf-text-primary"}
        style={{ fontSize: "14px", flex: 1 }}
      >
        {isEmpty ? emptyLabel : value}
      </span>
      <span
        className="text-kerf-text-tertiary opacity-0 group-hover:opacity-100"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          transition: "opacity 100ms",
        }}
      >
        {COMING_SOON_HINT}
      </span>
    </div>
  );
}
