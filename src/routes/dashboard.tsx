import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import {
  getDashboardActivity,
  getDashboardHeatmap,
  getDashboardHeroStats,
  getDashboardPhaseSuggestion,
  getDashboardTrajectory,
  getDashboardWeaknessRanking,
  type DashboardActivityData,
  type DashboardHeatmapData,
  type DashboardHeroData,
  type DashboardPhaseSuggestionData,
  type DashboardTrajectoryData,
  type DashboardWeaknessRankingData,
} from "#/server/dashboard";
import { HeroStats } from "#/components/dashboard/HeroStats";
import { SplitMetrics } from "#/components/dashboard/SplitMetrics";
import { ActivityLog } from "#/components/dashboard/ActivityLog";
import { Heatmap } from "#/components/dashboard/Heatmap";
import { WeaknessRanking } from "#/components/dashboard/WeaknessRanking";
import { TrajectoryCharts } from "#/components/dashboard/TrajectoryCharts";
import { EngineInsight } from "#/components/dashboard/EngineInsight";
import { TransparencyPanel } from "#/components/dashboard/TransparencyPanel";
import { PhaseSuggestionBanner } from "#/components/dashboard/PhaseSuggestionBanner";
import { Section } from "#/components/dashboard/Section";
import { composeDashboardInsight } from "#/domain/dashboard/insight";

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
    trajectory: DashboardTrajectoryData;
    phaseSuggestion: DashboardPhaseSuggestionData;
  }> => {
    // Six independent queries against the same active profile —
    // parallel so the dashboard's first paint scales with the
    // slowest single query, not the sum.
    const [hero, activity, heatmap, weakness, trajectory, phaseSuggestion] =
      await Promise.all([
        getDashboardHeroStats(),
        getDashboardActivity(),
        getDashboardHeatmap(),
        getDashboardWeaknessRanking(),
        getDashboardTrajectory(),
        getDashboardPhaseSuggestion(),
      ]);
    return { hero, activity, heatmap, weakness, trajectory, phaseSuggestion };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { hero, activity, heatmap, weakness, trajectory, phaseSuggestion } =
    Route.useLoaderData();

  if (!hero.hasAnyData) {
    return <EmptyState />;
  }

  const keyboardName = hero.profile.keyboardType;
  const sessionSuffix = hero.totalSessions === 1 ? "session" : "sessions";
  const meta = `all-time on ${keyboardName} · ${hero.totalSessions} ${sessionSuffix}`;

  return (
    <main className="kerf-dash-page">
      <PhaseSuggestionBanner
        signal={phaseSuggestion.signal}
        currentPhase={phaseSuggestion.currentPhase}
      />

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

      <Section title="Skill trajectory" meta="last 30 sessions">
        <TrajectoryCharts data={trajectory} />
      </Section>

      <Section title="Split-keyboard metrics" meta="recent sessions">
        <SplitMetrics data={hero} />
      </Section>

      <Section title="Engine insight" meta="how the engine reads your history">
        <EngineInsight
          insight={composeDashboardInsight({
            totalSessions: hero.totalSessions,
            accuracyTrendPct: hero.accuracyTrendPct,
            wpmTrend: hero.avgWpmTrend,
            phase: weakness.phase,
            topWeaknesses: weakness.entries,
          })}
          phase={weakness.phase}
          topWeaknessName={weakness.entries[0]?.unit ?? null}
        />
      </Section>

      <Section
        title="How is this calculated?"
        meta="live formula + top-weakness breakdown"
      >
        <TransparencyPanel
          breakdown={weakness.topBreakdown}
          phase={weakness.phase}
        />
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
