/**
 * Public landing — `/welcome`. The unauth-redirect target from `/`,
 * shown to first-time visitors and beta invitees before they sign in.
 *
 * Voice and content per CLAUDE.md §B3 (accuracy-first, calm mentor).
 * Chromeless (no AppNav) so the wordmark and CTA carry the page; the
 * AppNav links go to authed routes that wouldn't load anyway.
 */

import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import { canonicalLink } from "#/lib/seo-head";

export const Route = createFileRoute("/welcome")({
  beforeLoad: async () => {
    // Authed users typing /welcome land back on the lobby — they're
    // not the intended audience and have no chrome here to navigate
    // out of. Mirrors /login's authed-bounce behavior.
    const session = await getAuthSession();
    if (session) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Adaptive typing practice for split keyboards | kerf" },
      {
        name: "description",
        content:
          "Adaptive typing practice for Sofle and Lily58. Sessions adapt to the keys you're still building muscle memory for. Slower, tighter, stronger.",
      },
      { property: "og:title", content: "Adaptive typing practice for split keyboards | kerf" },
      {
        property: "og:description",
        content:
          "Adaptive typing practice for Sofle and Lily58. Sessions target the keys you're still learning.",
      },
      { property: "og:url", content: "https://typekerf.com/welcome" },
      { name: "twitter:title", content: "Adaptive typing practice for split keyboards | kerf" },
      {
        name: "twitter:description",
        content:
          "Adaptive typing practice for Sofle and Lily58. Sessions target the keys you're still learning.",
      },
    ],
    links: [canonicalLink("/welcome")],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-kerf-bg-base flex items-center justify-center px-6"
    >
      <div className="max-w-md w-full text-center space-y-7">
        <h1
          aria-label="kerf"
          className="kerf-nav-logo"
          style={{ fontSize: "72px", justifyContent: "center" }}
        >
          kerf<span className="kerf-nav-logo-accent">.</span>
        </h1>

        <p
          className="text-kerf-text-primary"
          style={{ fontFamily: "var(--font-display)", fontSize: "16px", lineHeight: 1.5 }}
        >
          Accuracy-first typing practice for split keyboards.
        </p>

        <p
          className="text-kerf-text-secondary"
          style={{ fontFamily: "var(--font-display)", fontSize: "14px", lineHeight: 1.6 }}
        >
          Sessions adapt to the keys you're still building muscle memory for. Slower, tighter,
          stronger — that's how the layout sticks.
        </p>

        <p
          className="text-kerf-text-muted"
          style={{ fontFamily: "var(--font-mono)", fontSize: "12px", letterSpacing: "0.02em" }}
        >
          Currently in private beta.
        </p>

        <div className="pt-2">
          <Link
            to="/login"
            className="inline-flex items-center justify-center"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              padding: "10px 24px",
              borderRadius: "6px",
              border: "1px solid var(--color-kerf-border-subtle)",
              color: "var(--color-kerf-text-primary)",
              textDecoration: "none",
              transition: "border-color 120ms ease, color 120ms ease",
            }}
          >
            Sign in →
          </Link>
        </div>
      </div>
    </main>
  );
}
