/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { AccountSection } from "./AccountSection";

afterEach(() => cleanup());

describe("AccountSection", () => {
  const baseAccount = {
    email: "user@example.com",
    displayName: null,
    createdAt: new Date("2026-03-12T10:00:00Z").toISOString(),
  };

  it("renders the email", () => {
    render(<AccountSection account={baseAccount} totalSessions={0} />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("renders '— not set' when displayName is null", () => {
    render(<AccountSection account={baseAccount} totalSessions={0} />);
    expect(screen.getByText("— not set")).toBeTruthy();
  });

  it("renders the displayName when provided", () => {
    render(<AccountSection account={{ ...baseAccount, displayName: "Avery" }} totalSessions={0} />);
    expect(screen.getByText("Avery")).toBeTruthy();
  });

  it("formats the created-at date and pluralizes session count", () => {
    render(<AccountSection account={baseAccount} totalSessions={47} />);
    expect(screen.getByText(/March 12, 2026/)).toBeTruthy();
    expect(screen.getByText(/47 sessions logged/)).toBeTruthy();
  });

  it("uses singular 'session' when count is 1", () => {
    render(<AccountSection account={baseAccount} totalSessions={1} />);
    expect(screen.getByText(/1 session logged/)).toBeTruthy();
    expect(screen.queryByText(/sessions/)).toBeNull();
  });

  it("uses 0 sessions wording for empty accounts", () => {
    render(<AccountSection account={baseAccount} totalSessions={0} />);
    expect(screen.getByText(/0 sessions logged/)).toBeTruthy();
  });
});
