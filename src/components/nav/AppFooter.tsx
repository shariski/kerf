/**
 * Global footer — thin explainer + legal link strip, rendered in
 * __root.tsx below the main app content on every non-chromeless route.
 *
 * Intentionally minimal per CLAUDE.md §B3: no copyright, no newsletter,
 * no "built with love in ___". One row of dotted links, nothing more.
 *
 * Each LINKS entry has a `kind` discriminator — internal entries route
 * via TanStack <Link> (client-side nav), external entries open in a
 * new tab with rel=noopener noreferrer (defeats reverse-tabnabbing +
 * strips Referer). The discriminator is explicit > implicit (per
 * CLAUDE.md §A1) — easier to reason about than detecting external
 * links via to.startsWith("http").
 */

import { Link } from "@tanstack/react-router";

const LINKS = [
  { kind: "internal", to: "/how-it-works", label: "how it works" },
  { kind: "internal", to: "/why-split-is-hard", label: "why split is hard" },
  { kind: "internal", to: "/faq", label: "faq" },
  { kind: "internal", to: "/contact", label: "contact" },
  { kind: "external", to: "https://github.com/shariski/kerf", label: "github" },
  { kind: "internal", to: "/privacy", label: "privacy" },
  { kind: "internal", to: "/terms", label: "terms" },
] as const;

export function AppFooter() {
  return (
    <footer className="kerf-app-footer" role="contentinfo">
      <div className="kerf-app-footer-row">
        {LINKS.map((link, i) => (
          <span key={link.to} className="kerf-app-footer-cell">
            {link.kind === "internal" ? (
              <Link to={link.to} className="kerf-app-footer-link">
                {link.label}
              </Link>
            ) : (
              <a
                href={link.to}
                className="kerf-app-footer-link"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} (opens in new tab)`}
              >
                {link.label}
              </a>
            )}
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
