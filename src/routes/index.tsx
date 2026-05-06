/**
 * Home / lobby — `/`. Two states per design/home-wireframe.html:
 *
 *   - Zero data (new user): welcome copy + keyboard pill + big
 *     "Start your first session" CTA. No previews, no stats.
 *   - Returning user: greeting + keyboard pill + hero CTA (with
 *     current-focus meta) + last session preview + activity strip
 *     + weakness pills.
 *
 * Landed alongside Task 4.1 because there is no separate numbered
 * task for the Home page in docs/03-task-breakdown.md, and Task
 * 4.1's "zero-data handling" maps most naturally onto this surface.
 * The returning-user state uses the same computed weakness ranking
 * the dashboard displays — served through `getHomeData` rather than
 * stitching the three dashboard fns together, to keep the Home
 * request to a single round trip.
 */

import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getAuthSession } from "#/lib/require-auth";
import { getActiveProfile } from "#/server/profile";
import { getHomeData, type HomeData } from "#/server/home";
import { KeyboardContextPill } from "#/components/practice/KeyboardContextPill";
import { formatRelativeDay } from "#/domain/dashboard/aggregates";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    // 301 (not the 307 default) so Google consolidates canonical signals
    // to /welcome — temp redirects leave /welcome flagged as "duplicate,
    // Google chose different canonical than user" in Search Console.
    if (!session) throw redirect({ to: "/welcome", statusCode: 301 });
  },
  loader: async (): Promise<{ home: HomeData }> => {
    // Profile check up front so a user with an account but no profile
    // lands on /onboarding before the home query runs (which would
    // throw "no active profile").
    const profile = await getActiveProfile();
    if (!profile) throw redirect({ to: "/onboarding" });
    const home = await getHomeData();
    return { home };
  },
  component: HomePage,
});

function HomePage() {
  const { home } = Route.useLoaderData();
  const navigate = useNavigate();

  // Enter anywhere on Home → go to /practice. Matches the wireframe's
  // "⏎ enter" affordance on the hero CTA and respects the keyboard-first
  // nature of the tool. Skip when focus is in a text input (none today,
  // but future-proofs against adding one).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      e.preventDefault();
      void navigate({ to: "/practice", search: { autostart: true } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <main id="main-content" className="kerf-home-page">
      <div className="kerf-home-container">
        {home.hasAnySession ? <ReturningState home={home} /> : <ZeroState home={home} />}
      </div>
    </main>
  );
}

function ZeroState({ home }: { home: HomeData }) {
  return (
    <div className="kerf-home-zero">
      <div className="kerf-home-greeting">
        <div className="kerf-home-greeting-line">welcome to kerf</div>
        <h1 className="kerf-home-zero-welcome">
          Let's build your <span className="kerf-home-highlight">split muscle memory</span>.
        </h1>
        <p className="kerf-home-zero-message">
          Your adaptive engine is ready. Start your first session — we'll capture a baseline, then
          tailor exercises to your actual weaknesses on split layout.
        </p>
      </div>

      <div className="kerf-home-zero-pill">
        <KeyboardContextPill keyboardType={home.profile.keyboardType} />
      </div>

      <div className="kerf-home-zero-cta">
        <Link
          to="/practice"
          search={{ autostart: true }}
          className="kerf-home-cta-primary kerf-home-cta-primary--tall"
        >
          <span className="kerf-home-cta-primary-text">
            <span className="kerf-home-cta-primary-label">Start your first session</span>
            <span className="kerf-home-cta-primary-meta">baseline capture · ~1 minute</span>
          </span>
          <span className="kerf-home-cta-primary-action" aria-hidden>
            <kbd className="kerf-kbd kerf-kbd--with-label">
              <span className="kerf-kbd-icon">⏎</span>
              <span className="kerf-kbd-label">enter</span>
            </kbd>
            <span className="kerf-home-cta-primary-arrow">→</span>
          </span>
        </Link>
      </div>
    </div>
  );
}

function ReturningState({ home }: { home: HomeData }) {
  const now = new Date();
  return (
    <>
      <section className="kerf-home-greeting">
        <div className="kerf-home-greeting-line">welcome back</div>
        <h1 className="kerf-home-greeting-title">
          Ready to <span className="kerf-home-highlight">practice</span>?
        </h1>
        <p className="kerf-home-greeting-subtitle">
          Pick up where you left off, or try something different today.
        </p>
      </section>

      <KeyboardContextPill keyboardType={home.profile.keyboardType} />

      <div className="kerf-home-hero-cta-group">
        <Link to="/practice" search={{ autostart: true }} className="kerf-home-cta-primary">
          <span className="kerf-home-cta-primary-text">
            <span className="kerf-home-cta-primary-label">Continue adaptive practice</span>
            <span className="kerf-home-cta-primary-meta">{buildFocusLine(home)}</span>
          </span>
          <span className="kerf-home-cta-primary-action" aria-hidden>
            <kbd className="kerf-kbd kerf-kbd--with-label">
              <span className="kerf-kbd-icon">⏎</span>
              <span className="kerf-kbd-label">enter</span>
            </kbd>
            <span className="kerf-home-cta-primary-arrow">→</span>
          </span>
        </Link>
        <Link to="/practice/drill" search={{}} className="kerf-home-cta-secondary">
          <span className="kerf-home-cta-secondary-icon" aria-hidden>
            ◎
          </span>
          Drill weakness
        </Link>
      </div>

      {home.lastSession && (
        <section className="kerf-home-preview-section">
          <header className="kerf-home-preview-label">
            <span>Last session</span>
            <Link to="/dashboard" className="kerf-home-preview-link">
              view all →
            </Link>
          </header>
          <Link to="/dashboard" className="kerf-home-last-session">
            <span className="kerf-home-last-session-when">
              {formatRelativeDay(new Date(home.lastSession.startedAt), now)}
            </span>
            <span className="kerf-home-last-session-stats">
              {home.lastSession.wpm !== null && (
                <span className="kerf-home-ls-stat">
                  <span className="kerf-home-ls-stat-value">{home.lastSession.wpm}</span>
                  <span className="kerf-home-ls-stat-unit">wpm</span>
                </span>
              )}
              {home.lastSession.accuracyPct !== null && (
                <span className="kerf-home-ls-stat">
                  <span className="kerf-home-ls-stat-value">{home.lastSession.accuracyPct}</span>
                  <span className="kerf-home-ls-stat-unit">%</span>
                </span>
              )}
              <span className="kerf-home-ls-stat">
                <span className="kerf-home-ls-stat-value">
                  {formatDuration(home.lastSession.durationSec)}
                </span>
              </span>
            </span>
            <span className="kerf-home-last-session-arrow" aria-hidden>
              →
            </span>
          </Link>
        </section>
      )}

      <section className="kerf-home-activity-weakness-grid">
        <div className="kerf-home-activity-strip">
          <header className="kerf-home-activity-strip-header">
            <div className="kerf-home-activity-strip-title">Last 30 days</div>
            <div className="kerf-home-activity-strip-meta">
              {home.streakDays === 0 ? "no streak" : `${home.streakDays} day streak`}
            </div>
          </header>
          <div
            className="kerf-home-activity-cells"
            role="img"
            aria-label={`${
              home.activity.filter((d) => d.sessionCount > 0).length
            } practice days in the last 30`}
          >
            {home.activity.map((d) => (
              <span
                key={d.date}
                className="kerf-home-activity-cell"
                data-level={d.level}
                aria-hidden
              />
            ))}
          </div>
        </div>

        {home.topWeaknesses.length > 0 && (
          <Link to="/dashboard" className="kerf-home-weakness-strip">
            <header className="kerf-home-weakness-strip-header">
              <div className="kerf-home-weakness-strip-title">Current focus</div>
              <span className="kerf-home-weakness-strip-link">full ranking →</span>
            </header>
            <div className="kerf-home-weakness-pills">
              {home.topWeaknesses.map((w, i) => (
                <span key={w.unit} className="kerf-home-weakness-pill-row" aria-hidden={false}>
                  <span className="kerf-home-weakness-pill">
                    {w.isCharacter ? w.unit.toUpperCase() : w.unit}
                  </span>
                  {i < home.topWeaknesses.length - 1 && (
                    <span className="kerf-home-weakness-divider" aria-hidden>
                      ·
                    </span>
                  )}
                </span>
              ))}
            </div>
            <div className="kerf-home-weakness-stat-line">
              top {home.topWeaknesses.length} weaknesses on {home.profile.keyboardType} · next
              exercise will emphasize these
            </div>
          </Link>
        )}
      </section>
    </>
  );
}

function buildFocusLine(home: HomeData): string {
  if (home.topWeaknesses.length === 0) {
    // Cold start after the diagnostic but before enough data to pick
    // real weaknesses. Honest: don't invent a focus.
    return "balanced practice · baseline forming";
  }
  const units = home.topWeaknesses
    .slice(0, 3)
    .map((w) => (w.isCharacter ? w.unit.toUpperCase() : w.unit))
    .join(", ");
  return `focus on ${units} today`;
}

function formatDuration(sec: number): string {
  if (sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
