/**
 * Public landing — `/welcome`. The unauth-redirect target from `/`,
 * shown to first-time visitors before they sign in.
 *
 * Six top-to-bottom sections:
 *   1. WelcomeHero        — H1 + subhead + primary CTA
 *   2. WhySplitTease      — teaser → /why-split-is-hard
 *   3. HowKerfAdaptsTease — teaser → /how-it-works
 *   4. KeyboardsTease     — teaser → /keyboards
 *   5. SessionMockup      — static CSS mockup of in-session UI
 *   6. WelcomeFinalCTA    — closing CTA
 *
 * Voice per CLAUDE.md §B3 (accuracy-first, calm mentor — no hype, no
 * pass/fail, no exclamation marks, "building muscle memory" framing).
 *
 * SEO: JSON-LD SoftwareApplication schema in head.scripts. Per-route
 * meta + canonical via head.meta + head.links.
 *
 * Chromeless (no AppNav) so the wordmark and hero CTA carry the page;
 * the AppNav links go to authed routes that wouldn't load anyway.
 */

import { Link, createFileRoute, redirect } from "@tanstack/react-router";
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
    scripts: [
      {
        type: "application/ld+json",
        children: JSON_LD_SOFTWARE_APP,
      },
    ],
  }),
  component: WelcomePage,
});

export function WelcomePage() {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-kerf-bg-base flex flex-col items-center px-6"
    >
      <div className="max-w-2xl w-full" style={{ paddingTop: "12vh", paddingBottom: "8vh" }}>
        <WelcomeHero />
        <WhySplitTease />
        <HowKerfAdaptsTease />
        <KeyboardsTease />
        <SessionMockup />
        <WelcomeFinalCTA />
      </div>
    </main>
  );
}

function WelcomeHero() {
  return (
    <section className="text-center" style={{ marginBottom: "96px" }}>
      <div
        className="kerf-nav-logo"
        style={{ fontSize: "72px", justifyContent: "center", marginBottom: "32px" }}
      >
        kerf<span className="kerf-nav-logo-accent">.</span>
      </div>
      <h1
        className="text-kerf-text-primary"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "32px",
          lineHeight: 1.25,
          fontWeight: 500,
          marginBottom: "20px",
          letterSpacing: "-0.01em",
        }}
      >
        Typing practice that adapts to your split keyboard.
      </h1>
      <p
        className="text-kerf-text-secondary"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          lineHeight: 1.6,
          marginBottom: "32px",
        }}
      >
        Sessions adapt to the keys you're still building muscle memory for. Slower, tighter,
        stronger — that's how the layout sticks.
      </p>
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          to="/login"
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
          Start practicing →
        </Link>
        <a
          href="#why-split"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            padding: "10px 16px",
            color: "var(--color-kerf-text-tertiary)",
            textDecoration: "none",
          }}
        >
          How it works ↓
        </a>
      </div>
    </section>
  );
}

function WhySplitTease() {
  return (
    <section id="why-split" style={{ marginBottom: "72px" }}>
      <h2 className="text-kerf-text-primary" style={sectionH2}>
        Why split keyboards are hard at first
      </h2>
      <p style={paragraph}>
        Going from a staggered keyboard to a columnar split — Sofle, Lily58, anything in that family
        — resets a decade of muscle memory in one weekend. The keys are in different places. Your
        fingers reach for them on autopilot and miss.
      </p>
      <p style={paragraph}>
        The first week is slow. Then comes a plateau where you're faster than day one but still
        nowhere near your old speed, and progress feels invisible. Most people give up here.
      </p>
      <p style={paragraph}>
        Pushing through the plateau means practicing the specific keys your fingers haven't claimed
        yet — not retyping the same easy paragraphs from a generic typing app.
      </p>
      <p style={paragraphLink}>
        <Link to="/why-split-is-hard" style={linkStyle}>
          Read the full breakdown →
        </Link>
      </p>
    </section>
  );
}

function HowKerfAdaptsTease() {
  return (
    <section style={{ marginBottom: "72px" }}>
      <h2 className="text-kerf-text-primary" style={sectionH2}>
        How kerf adapts
      </h2>
      <p style={paragraph}>
        Every session captures keystroke data — what you typed, what you meant to type, how long
        each press took. The engine rolls that into a weakness score per character and per bigram.
      </p>
      <p style={paragraph}>
        Your next session targets the weakest units. Words from a curated English corpus get sampled
        with weights that favor your trouble keys. The targets shift as your accuracy improves.
      </p>
      <p style={paragraph}>
        Feedback is accuracy-first. Speed is shown but never celebrated when accuracy slips. Slowing
        down is the path to muscle memory; the engine and the copy both reinforce that.
      </p>
      <p style={paragraphLink}>
        <Link to="/how-it-works" style={linkStyle}>
          Read how the engine works →
        </Link>
      </p>
    </section>
  );
}

function KeyboardsTease() {
  return (
    <section style={{ marginBottom: "72px" }}>
      <h2 className="text-kerf-text-primary" style={sectionH2}>
        Built for these keyboards
      </h2>
      <p style={paragraph}>
        kerf currently supports the <strong>Sofle</strong> and <strong>Lily58</strong> — two of the
        most-built columnar split keyboards in the ergonomic community. Each layout has finger maps
        and key-position data wired into the adaptive engine.
      </p>
      <p style={paragraph}>
        More keyboards are coming as the user base grows. If you're on a different split, the engine
        will still work in unmapped mode; the targeting just won't be column-aware.
      </p>
      <p style={paragraphLink}>
        <Link to="/keyboards" style={linkStyle}>
          See keyboard layouts →
        </Link>
      </p>
    </section>
  );
}

function SessionMockup() {
  return (
    <section style={{ marginBottom: "72px" }}>
      <h2 className="text-kerf-text-primary" style={sectionH2}>
        What a session looks like
      </h2>
      <p style={paragraph}>
        A session is a series of short drills. The engine picks target keys, generates words from a
        weighted corpus, and shows them one chunk at a time. You type. The interface marks correct,
        incorrect, and pending characters. After a few minutes you stop, and the next session
        adjusts.
      </p>
      <div
        role="img"
        aria-label="In-session typing mockup"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "32px",
          lineHeight: 1.4,
          letterSpacing: "0.08em",
          padding: "32px",
          marginTop: "24px",
          borderRadius: "8px",
          border: "1px solid var(--color-kerf-border-subtle)",
          background: "var(--color-kerf-bg-elevated)",
          textAlign: "center",
        }}
      >
        <span style={{ color: "var(--color-kerf-text-primary)" }}>q</span>
        <span style={{ color: "var(--color-kerf-text-primary)" }}>u</span>
        <span style={{ color: "var(--color-kerf-amber-base)" }}>i</span>
        <span style={{ color: "var(--color-kerf-text-tertiary)" }}>e</span>
        <span style={{ color: "var(--color-kerf-text-tertiary)" }}>t</span>
      </div>
    </section>
  );
}

function WelcomeFinalCTA() {
  return (
    <section className="text-center" style={{ marginTop: "96px" }}>
      <p
        className="text-kerf-text-secondary"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          lineHeight: 1.6,
          marginBottom: "20px",
        }}
      >
        No streaks. No leaderboards. Just the keys you're still learning.
      </p>
      <Link
        to="/login"
        style={{
          display: "inline-flex",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          padding: "10px 24px",
          borderRadius: "6px",
          border: "1px solid var(--color-kerf-border-subtle)",
          color: "var(--color-kerf-text-primary)",
          textDecoration: "none",
        }}
      >
        Start practicing →
      </Link>
    </section>
  );
}

const sectionH2 = {
  fontFamily: "var(--font-display)",
  fontSize: "22px",
  fontWeight: 500,
  letterSpacing: "-0.005em",
  marginBottom: "20px",
} as const;

const paragraph = {
  fontFamily: "var(--font-display)",
  fontSize: "15px",
  lineHeight: 1.7,
  color: "var(--color-kerf-text-secondary)",
  marginBottom: "16px",
} as const;

const paragraphLink = {
  fontFamily: "var(--font-mono)",
  fontSize: "13px",
  marginTop: "8px",
} as const;

const linkStyle = {
  color: "var(--color-kerf-amber-base)",
  textDecoration: "none",
} as const;
