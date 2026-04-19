import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import {
  getDashboardHeroStats,
  type DashboardHeroData,
} from "#/server/dashboard";
import { HeroStats } from "#/components/dashboard/HeroStats";
import { SplitMetrics } from "#/components/dashboard/SplitMetrics";
import { Section } from "#/components/dashboard/Section";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<{ data: DashboardHeroData }> => {
    const data = await getDashboardHeroStats();
    return { data };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { data } = Route.useLoaderData();

  if (!data.hasAnyData) {
    return <EmptyState />;
  }

  const keyboardName = data.profile.keyboardType;
  const sessionSuffix = data.totalSessions === 1 ? "session" : "sessions";
  const meta = `all-time on ${keyboardName} · ${data.totalSessions} ${sessionSuffix}`;

  return (
    <main className="kerf-dash-page">
      <header className="kerf-dash-page-header">
        <div className="kerf-dash-page-breadcrumb">Your progress</div>
        <h1 className="kerf-dash-page-title">Dashboard</h1>
      </header>

      <Section title="Where you are now" meta={meta}>
        <HeroStats data={data} />
      </Section>

      <Section title="Split-keyboard metrics" meta="recent sessions">
        <SplitMetrics data={data} />
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
