/** Public entry. Keep the deeper explanations available as optional reading. */

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import { canonicalLink } from "#/lib/seo-head";

const JSON_LD_SOFTWARE_APP = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "kerf",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description:
    "Adaptive typing practice that targets the keys you're still building muscle memory for. Built for split keyboards.",
  url: "https://typekerf.com/",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
});

export const Route = createFileRoute("/welcome")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (session) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Adaptive typing practice for split keyboards | kerf" },
      {
        name: "description",
        content:
          "Short, focused typing practice for Sofle and Lily58. Sessions adapt to the keys you're still learning.",
      },
      { property: "og:title", content: "Adaptive typing practice for split keyboards | kerf" },
      {
        property: "og:description",
        content: "Focused typing sessions for Sofle and Lily58 split keyboards.",
      },
      { property: "og:url", content: "https://typekerf.com/welcome" },
      { name: "twitter:title", content: "Adaptive typing practice for split keyboards | kerf" },
      {
        name: "twitter:description",
        content: "Focused typing sessions for Sofle and Lily58 split keyboards.",
      },
    ],
    links: [canonicalLink("/welcome")],
    scripts: [{ type: "application/ld+json", children: JSON_LD_SOFTWARE_APP }],
  }),
  component: WelcomePage,
});

export function WelcomePage() {
  return (
    <main id="main-content" className="kerf-welcome">
      <div className="kerf-welcome-inner">
        <div className="kerf-nav-logo kerf-welcome-logo">
          kerf<span className="kerf-nav-logo-accent">.</span>
        </div>

        <p className="kerf-welcome-eyebrow">For Sofle and Lily58 keyboards</p>
        <h1 className="kerf-welcome-title">Build accuracy on your split keyboard.</h1>
        <p className="kerf-welcome-description">
          Short sessions focus on the keys you miss, then adjust as you improve.
        </p>

        <Link to="/login" className="kerf-home-cta-primary kerf-welcome-cta">
          <span className="kerf-home-cta-primary-text">
            <span className="kerf-home-cta-primary-label">Start typing</span>
            <span className="kerf-home-cta-primary-meta">Sign in or create your account</span>
          </span>
          <span className="kerf-home-cta-primary-arrow" aria-hidden>
            →
          </span>
        </Link>

        <nav className="kerf-welcome-more" aria-label="Learn more">
          <Link to="/how-it-works">How it works</Link>
          <Link to="/why-split-is-hard">Why split feels different</Link>
        </nav>

        <div className="kerf-welcome-footer">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </div>
    </main>
  );
}
