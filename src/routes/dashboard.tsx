import { useEffect, useState } from "react";
import { createFileRoute, redirect, Link, useRouter } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import {
  getDashboardActivity,
  getDashboardHeatmap,
  getDashboardHeroStats,
  getDashboardPhaseSuggestion,
  getDashboardTemporalPatterns,
  getDashboardTrajectory,
  getDashboardWeaknessRanking,
  getDashboardWeeklyInsight,
  type DashboardActivityData,
  type DashboardHeatmapData,
  type DashboardHeroData,
  type DashboardPhaseSuggestionData,
  type DashboardTemporalPatternsData,
  type DashboardTrajectoryData,
  type DashboardWeaknessRankingData,
  type DashboardWeeklyInsightData,
} from "#/server/dashboard";
import { listKeyboardProfiles, switchActiveProfile, type ProfileListEntry } from "#/server/profile";
import {
  KeyboardSwitcherPill,
  type KeyboardSwitcherProfile,
} from "#/components/dashboard/KeyboardSwitcherPill";
import { HeroStats } from "#/components/dashboard/HeroStats";
import { SplitMetrics } from "#/components/dashboard/SplitMetrics";
import { ActivityLog } from "#/components/dashboard/ActivityLog";
import { Heatmap } from "#/components/dashboard/Heatmap";
import { WeaknessRanking } from "#/components/dashboard/WeaknessRanking";
import { TrajectoryCharts } from "#/components/dashboard/TrajectoryCharts";
import { EngineInsight } from "#/components/dashboard/EngineInsight";
import { TransparencyPanel } from "#/components/dashboard/TransparencyPanel";
import { PhaseSuggestionBanner } from "#/components/dashboard/PhaseSuggestionBanner";
import { WeeklyInsight } from "#/components/dashboard/WeeklyInsight";
import { TemporalPatterns } from "#/components/dashboard/TemporalPatterns";
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
    weekly: DashboardWeeklyInsightData;
    temporal: DashboardTemporalPatternsData;
    profiles: ProfileListEntry[];
  }> => {
    // Eight independent queries against the same user —
    // parallel so the dashboard's first paint scales with the
    // slowest single query, not the sum. `profiles` powers the
    // hero-side keyboard switcher pill.
    const [
      hero,
      activity,
      heatmap,
      weakness,
      trajectory,
      phaseSuggestion,
      weekly,
      temporal,
      profiles,
    ] = await Promise.all([
      getDashboardHeroStats(),
      getDashboardActivity(),
      getDashboardHeatmap(),
      getDashboardWeaknessRanking(),
      getDashboardTrajectory(),
      getDashboardPhaseSuggestion(),
      getDashboardWeeklyInsight(),
      getDashboardTemporalPatterns(),
      listKeyboardProfiles(),
    ]);
    return {
      hero,
      activity,
      heatmap,
      weakness,
      trajectory,
      phaseSuggestion,
      weekly,
      temporal,
      profiles,
    };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const {
    hero,
    activity,
    heatmap,
    weakness,
    trajectory,
    phaseSuggestion,
    weekly,
    temporal,
    profiles,
  } = Route.useLoaderData();
  const router = useRouter();

  const switcherProfiles: KeyboardSwitcherProfile[] = profiles.map((p) => ({
    id: p.id,
    keyboardType: p.keyboardType,
    isActive: p.isActive,
  }));

  const handleSwitchProfile = async (profileId: string) => {
    await switchActiveProfile({ data: { profileId } });
    await router.invalidate();
  };

  // Vim-style scroll shortcuts: j / k nudge, gg jumps to top, G to
  // bottom. Step scales with viewport so it feels consistent on any
  // screen size. Guarded against input focus so future inline inputs
  // don't hijack it.
  useEffect(() => {
    let gPending = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    const clearGPending = () => {
      gPending = false;
      if (gTimer) {
        clearTimeout(gTimer);
        gTimer = null;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const targetEl = e.target as HTMLElement | null;
      const tag = targetEl?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || targetEl?.isContentEditable === true;
      if (inField) return;

      // Use `e.code` (physical key) rather than `e.key` for vim
      // navigation — some browsers/layouts emit `e.key === "g"` for
      // Shift+g instead of "G", which would make G silently fail.
      const isKeyG = e.code === "KeyG";

      // Any non-`g` key cancels a pending gg — otherwise unrelated
      // keystrokes would "glue" into an accidental top-jump.
      if (!isKeyG) clearGPending();

      if (isKeyG && e.shiftKey) {
        e.preventDefault();
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
        return;
      }
      if (isKeyG && !e.shiftKey) {
        if (gPending) {
          clearGPending();
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          gPending = true;
          gTimer = setTimeout(() => {
            gPending = false;
            gTimer = null;
          }, 600);
        }
        return;
      }

      if (e.shiftKey) return;

      const step = Math.round(window.innerHeight * 0.4);
      if (e.code === "KeyJ") {
        e.preventDefault();
        window.scrollBy({ top: step, behavior: "smooth" });
        return;
      }
      if (e.code === "KeyK") {
        e.preventDefault();
        window.scrollBy({ top: -step, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, []);

  // Mirror the post-session scroll-hint: visible while the user is
  // still near the top and there's meaningful content below. Fades once
  // they've committed to scrolling.
  const [showScrollHint, setShowScrollHint] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max < 40) {
        setShowScrollHint(false);
        return;
      }
      const threshold = Math.min(Math.round(window.innerHeight * 0.5), Math.round(max * 0.5));
      setShowScrollHint(scrolled < threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!hero.hasAnyData) {
    return <EmptyState />;
  }

  const keyboardName = hero.profile.keyboardType;
  const sessionSuffix = hero.totalSessions === 1 ? "session" : "sessions";
  const meta = `all-time on ${keyboardName} · ${hero.totalSessions} ${sessionSuffix}`;

  return (
    <main id="main-content" className="kerf-dash-page">
      <PhaseSuggestionBanner
        signal={phaseSuggestion.signal}
        currentPhase={phaseSuggestion.currentPhase}
      />

      <header className="kerf-dash-page-header">
        <div className="kerf-dash-page-header-left">
          <div className="kerf-dash-page-breadcrumb">Your progress</div>
          <h1 className="kerf-dash-page-title">Dashboard</h1>
        </div>
        <KeyboardSwitcherPill profiles={switcherProfiles} onSwitchProfile={handleSwitchProfile} />
      </header>

      <Section title="Where you are now" meta={meta}>
        <HeroStats data={hero} />
      </Section>

      <Section title="Recent activity" meta="last 30 days">
        <ActivityLog data={activity} />
      </Section>

      <Section title="Per-key heatmap" meta={`${heatmap.keyboardType} base layer`}>
        <Heatmap data={heatmap} />
      </Section>

      <Section title="Top weaknesses" meta={`ranked by ${weakness.phase} engine`}>
        <WeaknessRanking data={weakness} />
      </Section>

      <Section title="Skill trajectory" meta="last 30 sessions">
        <TrajectoryCharts data={trajectory} />
      </Section>

      <Section title="This week vs last" meta="rolling 7-day windows">
        <WeeklyInsight data={weekly.insight} />
      </Section>

      <Section title="When you practice best" meta="last 30 days, local time">
        <TemporalPatterns data={temporal} />
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

      <Section title="How is this calculated?" meta="live formula + top-weakness breakdown">
        <TransparencyPanel breakdown={weakness.topBreakdown} phase={weakness.phase} />
      </Section>

      <div
        className="kerf-post-floating-scroll-hint"
        data-visible={showScrollHint || undefined}
        aria-hidden="true"
      >
        <span className="kerf-post-floating-scroll-hint-chevron">↓</span>
      </div>

      <div className="kerf-post-hint-strip" aria-hidden="true">
        <div className="kerf-post-hint-item">
          <kbd>j</kbd>
          <span>scroll down</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>k</kbd>
          <span>scroll up</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>gg</kbd>
          <span>top</span>
        </div>
        <div className="kerf-post-hint-item">
          <kbd>G</kbd>
          <span>bottom</span>
        </div>
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <main id="main-content" className="kerf-dash-page">
      <div className="kerf-dash-empty">
        <h1 className="kerf-dash-empty-title">No practice yet</h1>
        <p className="kerf-dash-empty-body">
          Finish your first session and your stats will land here — accuracy, speed, letters you've
          mastered, and split-keyboard- specific signals the engine watches.
        </p>
        <Link to="/practice" className="kerf-dash-empty-cta">
          Start your first session
        </Link>
      </div>
    </main>
  );
}
