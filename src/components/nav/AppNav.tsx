import { Link, useRouterState } from "@tanstack/react-router";
import { useNavAutoHide } from "#/hooks/useNavAutoHide";

/**
 * Global top navigation — 1:1 port of the `.app-nav` block in
 * design/home-wireframe.html (mirrored in all other wireframes).
 *
 * Spec: docs/05-information-architecture.md §5. Primary links, amber
 * active-underline, avatar on the right. Auto-hide behaviour on
 * `/practice` during active typing (IA §5) is intentionally deferred
 * to a later task — this component renders the chrome; the hide/show
 * timing lives alongside the keystroke capture logic.
 *
 * The avatar is visual-only for now; the user-menu dropdown (sign out,
 * account) lands in Phase 3. Settings was originally reached via a cog
 * icon in the right-hand cluster, but discoverability of a small icon
 * proved poor in practice, so it was promoted to a top-level link.
 */

const NAV_LINKS = [
  { to: "/practice", label: "Practice" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/keyboards", label: "Keyboards" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { hidden } = useNavAutoHide();

  return (
    <header
      className="kerf-app-nav"
      role="banner"
      data-hidden={hidden || undefined}
      aria-hidden={hidden || undefined}
    >
      <Link to="/" className="kerf-nav-logo" aria-label="Home">
        kerf<span className="kerf-nav-logo-accent">.</span>
      </Link>

      <nav className="kerf-nav-links" aria-label="Primary">
        {NAV_LINKS.map(({ to, label }) => {
          const active = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={to}
              to={to}
              className="kerf-nav-link"
              data-active={active || undefined}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="kerf-nav-right" aria-label="Account">
        <span className="kerf-nav-avatar" aria-label="User menu">
          U
        </span>
      </div>
    </header>
  );
}
