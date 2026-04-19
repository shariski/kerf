import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import {
  getDashboardActivity,
  getDashboardHeatmap,
  getDashboardHeroStats,
  getDashboardWeaknessRanking,
  type DashboardActivityData,
  type DashboardHeatmapData,
  type DashboardHeroData,
  type DashboardWeaknessRankingData,
} from "#/server/dashboard";
import { HeroStats } from "#/components/dashboard/HeroStats";
import { SplitMetrics } from "#/components/dashboard/SplitMetrics";
import { ActivityLog } from "#/components/dashboard/ActivityLog";
import { Heatmap } from "#/components/dashboard/Heatmap";
import { WeaknessRanking } from "#/components/dashboard/WeaknessRanking";
import { Section } from "#/components/dashboard/Section";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<{
    hero: DashboardHeroData;
    activity: DashboardActivityData;
    heatmap: DashboardHeatmapData;
    weakness: DashboardWeaknessRankingData;
  }> => {
    // Four independent queries against the same active profile —
    // parallel so the dashboard's first paint scales with the
    // slowest single query, not the sum.
    const [hero, activity, heatmap, weakness] = await Promise.all([
      getDashboardHeroStats(),
      getDashboardActivity(),
      getDashboardHeatmap(),
      getDashboardWeaknessRanking(),
    ]);
    return { hero, activity, heatmap, weakness };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { hero, activity, heatmap, weakness } = Route.useLoaderData();

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

      <Section
        title="Per-key heatmap"
        meta={`${heatmap.keyboardType} base layer`}
      >
        <Heatmap data={heatmap} />
      </Section>

      <Section
        title="Top weaknesses"
        meta={`ranked by ${weakness.phase} engine`}
      >
        <WeaknessRanking data={weakness} />
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
