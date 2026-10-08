/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/dashboard" className={className}>
      {children}
    </a>
  ),
}));

import { CodePostSessionStage } from "./CodePostSessionStage";

beforeEach(() => {
  window.scrollTo = vi.fn();
});
afterEach(() => cleanup());

describe("Coding review parity", () => {
  it("uses the existing review structure and working Enter, D, and Ctrl+D shortcuts", () => {
    const onContinue = vi.fn();
    const onDrillFocus = vi.fn();
    const onViewDashboard = vi.fn();
    const { container } = render(
      <CodePostSessionStage
        target="const x = 1;"
        languageLabel="JavaScript"
        focusLabel="Quotes and symbols"
        summary={{
          accuracyPct: 92,
          symbolAccuracyPct: 85,
          totalErrors: 2,
          wpm: 48,
          elapsedMs: 32000,
        }}
        evidence={{ attempts: 5, errors: 1, accuracyPct: 80 }}
        errors={[{ index: 8, expected: "=", typed: "-" }]}
        tabCount={0}
        saveStatus="saved"
        onRetrySave={vi.fn()}
        onContinue={onContinue}
        onDrillFocus={onDrillFocus}
        onViewDashboard={onViewDashboard}
      />,
    );
    expect(container.querySelector(".kerf-post-complete-mark-badge")).toBeTruthy();
    expect(container.querySelector(".kerf-post-stats")).toBeTruthy();
    expect(container.querySelector(".kerf-error-review")).toBeTruthy();
    expect(container.querySelector(".kerf-insight")).toBeTruthy();
    expect(container.querySelectorAll(".kerf-post-actions .kerf-post-btn")).toHaveLength(3);
    expect(container.querySelector(".kerf-post-hint-strip")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Error at position 9/ })).toBeTruthy();
    expect(screen.queryByText("Coding session saved.")).toBeNull();
    expect(container.querySelector(".kerf-code-review-error")).toBeNull();

    fireEvent.keyDown(window, { key: "Enter", code: "Enter" });
    fireEvent.keyDown(window, { key: "d", code: "KeyD" });
    fireEvent.keyDown(window, { key: "d", code: "KeyD", ctrlKey: true });
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDrillFocus).toHaveBeenCalledTimes(1);
    expect(onViewDashboard).toHaveBeenCalledTimes(1);
  });
});
