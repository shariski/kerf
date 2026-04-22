/**
 * Global footer — thin explainer + legal link strip, rendered in
 * __root.tsx below the main app content on every non-chromeless route.
 *
 * Intentionally minimal per CLAUDE.md §B3: no copyright, no newsletter,
 * no "built with love in ___". One row of dotted links, nothing more.
 */

import { Link } from "@tanstack/react-router";

const LINKS = [
  { to: "/how-it-works", label: "how it works" },
  { to: "/why-split-is-hard", label: "why split is hard" },
  { to: "/faq", label: "faq" },
  { to: "/privacy", label: "privacy" },
  { to: "/terms", label: "terms" },
] as const;

export function AppFooter() {
  return (
    <footer className="kerf-app-footer" role="contentinfo">
      <div className="kerf-app-footer-row">
        {LINKS.map((link, i) => (
          <span key={link.to} className="kerf-app-footer-cell">
            <Link to={link.to} className="kerf-app-footer-link">
              {link.label}
            </Link>
            {i < LINKS.length - 1 && (
              <span className="kerf-app-footer-sep" aria-hidden>
                ·
              </span>
            )}
          </span>
        ))}
      </div>
    </footer>
  );
}
