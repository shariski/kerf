/**
 * Header strip shown above the typing area during an active drill —
 * the label that makes "Drill: B" or "Drill: inner column" prominent
 * per IA §4.3. Not used during adaptive practice.
 */

type Props = {
  /** Display name of the drill target — "B", "er", "Inner column". */
  label: string;
};

export function DrillActiveHeader({ label }: Props) {
  return (
    <div className="kerf-drill-header" aria-live="polite">
      <span className="kerf-drill-header-prefix">drill</span>
      <span className="kerf-drill-header-target">{label}</span>
    </div>
  );
}
