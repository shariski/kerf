/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    useRouter: () => ({ invalidate: vi.fn().mockResolvedValue(undefined) }),
  };
});

const updateFingerAssignmentMock = vi.fn().mockResolvedValue(undefined);
vi.mock("#/server/profile", () => ({
  updateFingerAssignment: (input: unknown) => updateFingerAssignmentMock(input),
}));

import { SettingsLayout } from "#/components/settings/SettingsLayout";
import { AccountSection } from "#/components/settings/sections/AccountSection";
import { PreferencesSection } from "#/components/settings/sections/PreferencesSection";
import { ThemeSection } from "#/components/settings/sections/ThemeSection";
import { DataSection } from "#/components/settings/sections/DataSection";
import { DangerZoneSection } from "#/components/settings/sections/DangerZoneSection";
import type { SettingsData } from "#/server/account";

afterEach(() => {
  cleanup();
  updateFingerAssignmentMock.mockClear();
});

const fixture: SettingsData = {
  account: {
    email: "user@example.com",
    displayName: null,
    createdAt: new Date("2026-03-12T10:00:00Z").toISOString(),
  },
  totalSessions: 47,
  activeProfile: {
    id: "p1",
    keyboardType: "lily58",
    fingerAssignment: "conventional",
  },
  profiles: [
    { id: "p1", keyboardType: "lily58", sessionCount: 28, isActive: true },
    { id: "p2", keyboardType: "sofle", sessionCount: 19, isActive: false },
  ],
};

function SettingsPageForTest({ data }: { data: SettingsData }) {
  return (
    <SettingsLayout>
      <AccountSection account={data.account} totalSessions={data.totalSessions} />
      <PreferencesSection activeProfile={data.activeProfile} />
      <ThemeSection />
      <DataSection profiles={data.profiles} />
      <DangerZoneSection />
    </SettingsLayout>
  );
}

describe("SettingsPage", () => {
  it("renders all 5 section headings", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Preferences" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Theme" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Data" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Danger zone" })).toBeTruthy();
  });

  it("shows the loader email in the Account section", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("shows the active-profile FA pill checked", () => {
    render(<SettingsPageForTest data={fixture} />);
    const group = screen.getByRole("radiogroup", { name: "Finger assignment" });
    const pills = group.querySelectorAll('[role="radio"]');
    expect(pills.length).toBe(3);
    const conventional = group.querySelector('[role="radio"][aria-checked="true"]');
    expect(conventional?.textContent).toBe("Conventional");
  });

  it("includes the active-profile keyboard type in the FA hint", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("for active profile · lily58")).toBeTruthy();
  });

  it("calls updateFingerAssignment when a different pill is clicked", async () => {
    render(<SettingsPageForTest data={fixture} />);
    const group = screen.getByRole("radiogroup", { name: "Finger assignment" });
    const columnar = Array.from(group.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === "Columnar",
    ) as HTMLButtonElement;
    fireEvent.click(columnar);
    await waitFor(() => {
      expect(updateFingerAssignmentMock).toHaveBeenCalledTimes(1);
      expect(updateFingerAssignmentMock).toHaveBeenCalledWith({
        data: { journey: "columnar" },
      });
    });
  });

  it("does not call updateFingerAssignment when the already-active pill is clicked", () => {
    render(<SettingsPageForTest data={fixture} />);
    const group = screen.getByRole("radiogroup", { name: "Finger assignment" });
    const conventional = Array.from(group.querySelectorAll('[role="radio"]')).find(
      (el) => el.textContent === "Conventional",
    ) as HTMLButtonElement;
    fireEvent.click(conventional);
    expect(updateFingerAssignmentMock).not.toHaveBeenCalled();
  });

  it("renders one row per keyboard profile in Data section", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("lily58")).toBeTruthy();
    expect(screen.getByText("sofle")).toBeTruthy();
    expect(screen.getByText(/28 sessions · active/)).toBeTruthy();
    expect(screen.getByText(/19 sessions/)).toBeTruthy();
  });

  it("marks the sidebar nav with aria-label", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByRole("navigation", { name: "Settings sections" })).toBeTruthy();
  });

  it("Account anchor is the default-active sidebar link", () => {
    render(<SettingsPageForTest data={fixture} />);
    const accountLink = screen.getByRole("link", { name: "Account" });
    expect(accountLink.getAttribute("aria-current")).toBe("location");
  });

  it("clicking a sidebar link sets aria-current on that link", () => {
    render(<SettingsPageForTest data={fixture} />);
    const themeLink = screen.getByRole("link", { name: "Theme" });
    fireEvent.click(themeLink);
    expect(themeLink.getAttribute("aria-current")).toBe("location");
  });

  it("Theme cards: Dark active, Light v2-disabled", () => {
    render(<SettingsPageForTest data={fixture} />);
    expect(screen.getByText("Dark (default)")).toBeTruthy();
    expect(screen.getByText("Light")).toBeTruthy();
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("v2")).toBeTruthy();
  });

  it("Danger zone delete button is disabled", () => {
    render(<SettingsPageForTest data={fixture} />);
    const btn = screen.getByRole("button", { name: "Delete account" });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });
});
