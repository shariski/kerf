/**
 * Tiny inline SVG sparkline rendered at the bottom of the featured
 * hero stat. Accepts a chronological numeric series and draws a
 * polyline with a stretch-to-fit viewBox so it looks good at any
 * container width.
 *
 * Auto-scales the y axis to the min/max of the series — a pure-trend
 * sparkline, not a scale-correct chart. Good enough for "is the line
 * going up?" at a glance.
 */

type Props = {
  values: readonly number[];
  /** Accessibility label. The sparkline itself is decorative; this
   * label gives screen readers the high-level signal. */
  ariaLabel: string;
  className?: string;
};

const VIEWBOX_W = 200;
const VIEWBOX_H = 40;

export function SparklineSvg({ values, ariaLabel, className }: Props) {
  if (values.length < 2) {
    // Not enough data to draw a line — render empty.
    return (
      <svg
        className={className}
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        preserveAspectRatio="none"
        aria-label={ariaLabel}
        role="img"
      />
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // avoid divide-by-zero on flat series

  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * VIEWBOX_W;
      // Invert y — SVG origin is top-left.
      const y = VIEWBOX_H - ((v - min) / range) * VIEWBOX_H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className={className}
      viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
      preserveAspectRatio="none"
      aria-label={ariaLabel}
      role="img"
    >
      <polyline
        points={pts}
        fill="none"
        stroke="var(--color-kerf-amber-base)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
