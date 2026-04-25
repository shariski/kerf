import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAuthSession } from "#/lib/require-auth";
import { getAccountSummary, type SettingsData } from "#/server/account";
import { AppFooter } from "#/components/nav/AppFooter";
import { SettingsLayout } from "#/components/settings/SettingsLayout";
import { AccountSection } from "#/components/settings/sections/AccountSection";
import { PreferencesSection } from "#/components/settings/sections/PreferencesSection";
import { ThemeSection } from "#/components/settings/sections/ThemeSection";
import { DataSection } from "#/components/settings/sections/DataSection";
import { DangerZoneSection } from "#/components/settings/sections/DangerZoneSection";

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async (): Promise<SettingsData> => getAccountSummary(),
  component: SettingsPage,
});

function SettingsPage() {
  const data = Route.useLoaderData();
  return (
    <>
      <SettingsLayout>
        <AccountSection account={data.account} totalSessions={data.totalSessions} />
        <PreferencesSection activeProfile={data.activeProfile} />
        <ThemeSection />
        <DataSection profiles={data.profiles} />
        <DangerZoneSection />
      </SettingsLayout>
      <AppFooter />
    </>
  );
}
