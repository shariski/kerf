/**
 * Global footer — explainer + legal link strip. Rendered in __root.tsx
 * below the main app content on every non-chromeless route.
 *
 * Intentionally compact. Copy tone is quiet per CLAUDE.md §B3 — no
 * newsletter sign-up, no "built with love in ___", no hype.
 */

import { Link } from "@tanstack/react-router";

const PRIMARY_LINKS = [
  { to: "/how-it-works", label: "how it works" },
  { to: "/why-split-is-hard", label: "why split is hard" },
  { to: "/faq", label: "faq" },
] as const;

const LEGAL_LINKS = [
  { to: "/privacy", label: "privacy" },
  { to: "/terms", label: "terms" },
] as const;

export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="kerf-app-footer" role="contentinfo">
      <div className="kerf-app-footer-row">
        {PRIMARY_LINKS.map((link, i) => (
          <span key={link.to} className="kerf-app-footer-cell">
            <Link to={link.to} className="kerf-app-footer-link">
              {link.label}
            </Link>
            {i < PRIMARY_LINKS.length - 1 && (
              <span className="kerf-app-footer-sep" aria-hidden>
                ·
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="kerf-app-footer-row">
        {LEGAL_LINKS.map((link, i) => (
          <span key={link.to} className="kerf-app-footer-cell">
            <Link to={link.to} className="kerf-app-footer-link">
              {link.label}
            </Link>
            {i < LEGAL_LINKS.length - 1 && (
              <span className="kerf-app-footer-sep" aria-hidden>
                ·
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="kerf-app-footer-copyright">© {year} kerf</div>
    </footer>
  );
}
