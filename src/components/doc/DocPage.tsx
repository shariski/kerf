/**
 * Shared layout for all /docs-style routes (Task 4.5).
 *
 * 720px reading column, one <h1>, optional lede + optional
 * "this page is a template" banner for legal pages. Wraps in
 * <main id="main-content"> per the Task 4.4 a11y contract.
 */

type Props = {
  title: string;
  /** Short paragraph under the h1. Optional. */
  lede?: string;
  /** Rendered as an amber banner when true — used for privacy/terms. */
  isTemplate?: boolean;
  /** Effective date line above template banner. Legal-only. */
  effectiveDate?: string;
  children: React.ReactNode;
};

export function DocPage({
  title,
  lede,
  isTemplate,
  effectiveDate,
  children,
}: Props) {
  return (
    <main id="main-content" className="kerf-doc-page">
      {isTemplate && (
        <div className="kerf-doc-template-banner" role="note">
          This page is a template. Replace the{" "}
          <code className="kerf-doc-placeholder">{"{{PLACEHOLDERS}}"}</code>{" "}
          before deploying to production.
        </div>
      )}
      <article className="kerf-doc-article">
        <h1 className="kerf-doc-title">{title}</h1>
        {lede && <p className="kerf-doc-lede">{lede}</p>}
        {effectiveDate && (
          <p className="kerf-doc-effective-date">
            Effective date: <strong>{effectiveDate}</strong>
          </p>
        )}
        <div className="kerf-doc-body">{children}</div>
      </article>
    </main>
  );
}
