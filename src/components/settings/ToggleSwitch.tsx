type ToggleSwitchProps = {
  on: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  ariaLabel: string;
};

export function ToggleSwitch({ on, onToggle, disabled = false, ariaLabel }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onToggle?.();
      }}
      className={
        on
          ? "border-kerf-amber-base bg-kerf-amber-base"
          : "border-kerf-border-default bg-kerf-bg-elevated"
      }
      style={{
        position: "relative",
        width: "36px",
        height: "20px",
        borderRadius: "10px",
        borderWidth: "1px",
        borderStyle: "solid",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        padding: 0,
        transition: "all 150ms",
      }}
    >
      <span
        aria-hidden="true"
        className={on ? "bg-kerf-text-inverse" : "bg-kerf-text-secondary"}
        style={{
          position: "absolute",
          top: "2px",
          left: on ? "18px" : "2px",
          width: "14px",
          height: "14px",
          borderRadius: "50%",
          transition: "all 150ms",
          display: "block",
        }}
      />
    </button>
  );
}
