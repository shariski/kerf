/**
 * Selectable mode card shown under the primary "continue adaptive practice"
 * CTA on the pre-session screen.
 *
 * `disabled` renders the card grayed-out with a "coming soon" tag — used for
 * Drill weakness (Task 2.6), Inner column (Task 2.7), Warm up (post-MVP).
 * Per CLAUDE.md §B3 we do not use hyped language; "coming soon" stays flat.
 */

type Props = {
  icon: string;
  name: string;
  description: string;
  disabled?: boolean;
  onSelect?: () => void;
};

export function ModeCard({
  icon,
  name,
  description,
  disabled = false,
  onSelect,
}: Props) {
  const clickable = !disabled && !!onSelect;
  return (
    <button
      type="button"
      className="kerf-mode-card"
      data-disabled={disabled || undefined}
      disabled={disabled}
      onClick={clickable ? onSelect : undefined}
      aria-label={`${name}: ${description}${disabled ? " (coming soon)" : ""}`}
    >
      <span className="kerf-mode-card-icon" aria-hidden>
        {icon}
      </span>
      <span className="kerf-mode-card-name">
        {name}
        {disabled && <span className="kerf-mode-card-tag">coming soon</span>}
      </span>
      <span className="kerf-mode-card-desc">{description}</span>
    </button>
  );
}
