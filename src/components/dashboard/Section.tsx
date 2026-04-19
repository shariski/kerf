/**
 * Shared dashboard section wrapper: heading row + optional meta line.
 * Used by all six Phase 3 Task 3.2 sections so the rhythm is
 * consistent across the page.
 */

type Props = {
  title: string;
  /** Right-aligned subdued meta text (e.g. "all-time on sofle · 47 sessions"). */
  meta?: string;
  children: React.ReactNode;
};

export function Section({ title, meta, children }: Props) {
  return (
    <section className="kerf-dash-section">
      <header className="kerf-dash-section-header">
        <h2 className="kerf-dash-section-title">{title}</h2>
        {meta ? <span className="kerf-dash-section-meta">{meta}</span> : null}
      </header>
      {children}
    </section>
  );
}
