import { Link, useRouterState } from "@tanstack/react-router";
import { useNavAutoHide } from "#/hooks/useNavAutoHide";

/**
 * Global top navigation — 1:1 port of the `.app-nav` block in
 * design/home-wireframe.html (mirrored in all other wireframes).
 *
 * Spec: docs/05-information-architecture.md §5. Three primary links,
 * amber active-underline, gear + avatar on the right. Auto-hide
 * behaviour on `/practice` during active typing (IA §5) is intentionally
 * deferred to a later task — this component renders the chrome; the
 * hide/show timing lives alongside the keystroke capture logic.
 *
 * Avatar + settings cog are visual-only for now (Phase 3 wires the user
 * menu dropdown per IA §5).
 */

const NAV_LINKS = [
  { to: "/practice", label: "Practice" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/keyboards", label: "Keyboards" },
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
        <button
          type="button"
          className="kerf-nav-cog"
          aria-label="Settings (coming soon)"
          disabled
          title="Settings dropdown lands in Phase 3"
        >
          ⚙
        </button>
        <span className="kerf-nav-avatar" aria-label="User menu">
          U
        </span>
      </div>
    </header>
  );
}
