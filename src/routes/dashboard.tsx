import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import {
  getDashboardActivity,
  getDashboardHeroStats,
  type DashboardActivityData,
  type DashboardHeroData,
} from "#/server/dashboard";
import { HeroStats } from "#/components/dashboard/HeroStats";
import { SplitMetrics } from "#/components/dashboard/SplitMetrics";
import { ActivityLog } from "#/components/dashboard/ActivityLog";
import { Section } from "#/components/dashboard/Section";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<{
    hero: DashboardHeroData;
    activity: DashboardActivityData;
  }> => {
    // Load hero + activity in parallel — they're independent queries
    // against the same active profile.
    const [hero, activity] = await Promise.all([
      getDashboardHeroStats(),
      getDashboardActivity(),
    ]);
    return { hero, activity };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { hero, activity } = Route.useLoaderData();

  if (!hero.hasAnyData) {
    return <EmptyState />;
  }

  const keyboardName = hero.profile.keyboardType;
  const sessionSuffix = hero.totalSessions === 1 ? "session" : "sessions";
  const meta = `all-time on ${keyboardName} · ${hero.totalSessions} ${sessionSuffix}`;

  return (
    <main className="kerf-dash-page">
      <header className="kerf-dash-page-header">
        <div className="kerf-dash-page-breadcrumb">Your progress</div>
        <h1 className="kerf-dash-page-title">Dashboard</h1>
      </header>

      <Section title="Where you are now" meta={meta}>
        <HeroStats data={hero} />
      </Section>

      <Section title="Recent activity" meta="last 30 days">
        <ActivityLog data={activity} />
      </Section>

      <Section title="Split-keyboard metrics" meta="recent sessions">
        <SplitMetrics data={hero} />
      </Section>
    </main>
  );
}

function EmptyState() {
  return (
    <main className="kerf-dash-page">
      <div className="kerf-dash-empty">
        <h1 className="kerf-dash-empty-title">No practice yet</h1>
        <p className="kerf-dash-empty-body">
          Finish your first session and your stats will land here —
          accuracy, speed, letters you've mastered, and split-keyboard-
          specific signals the engine watches.
        </p>
        <Link to="/practice" className="kerf-dash-empty-cta">
          Start your first session
        </Link>
      </div>
    </main>
  );
}
