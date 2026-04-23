/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// --- module mocks ---------------------------------------------------------
//
// `useRouter` throws outside a <RouterProvider> context, and
// `updateTransitionPhase` is a server fn that tries to open a fetch.
// Both are orthogonal to the behaviors this test covers (null-signal
// short-circuit, sessionStorage dismissal), so stub them out and let
// the happy-accept path get covered by manual browser verification.

vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ invalidate: vi.fn().mockResolvedValue(undefined) }),
}));

const updateMock = vi.fn();
vi.mock("#/server/profile", () => ({
  updateTransitionPhase: (...args: unknown[]) => updateMock(...args),
}));

import { PhaseSuggestionBanner } from "./PhaseSuggestionBanner";

const GRADUATION_SIGNAL = {
  suggestedPhase: "refining" as const,
  reason:
    "Your accuracy has been above 95% for 10 sessions, and inner column error rate is below 8%.",
  confidence: "high" as const,
};

beforeEach(() => {
  window.sessionStorage.clear();
  updateMock.mockReset();
});

afterEach(() => cleanup());

describe("PhaseSuggestionBanner", () => {
  it("renders nothing when signal is null", () => {
    const { container } = render(
      <PhaseSuggestionBanner signal={null} currentPhase="transitioning" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the reason and direction-specific CTA when signal fires", () => {
    render(<PhaseSuggestionBanner signal={GRADUATION_SIGNAL} currentPhase="transitioning" />);
    expect(screen.getByText(/inner column error rate/i)).toBeTruthy();
    // Graduation → primary button reads "Switch to refining".
    expect(screen.getByRole("button", { name: /switch to refining/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /not yet/i })).toBeTruthy();
  });

  it("renders nothing if sessionStorage already has the dismissal flag for this direction", () => {
    window.sessionStorage.setItem("kerf_phase_banner_dismissed_refining", "1");
    const { container } = render(
      <PhaseSuggestionBanner signal={GRADUATION_SIGNAL} currentPhase="transitioning" />,
    );
    // The effect flips `dismissed` on mount, so the banner must not be
    // in the DOM after the first paint.
    expect(container.querySelector(".kerf-dash-phase-banner")).toBeNull();
  });

  it("still renders when the flag is set for a different direction", () => {
    // Dismissing "refining" must not silence a later "transitioning"
    // suggestion — they're independent advisories.
    window.sessionStorage.setItem("kerf_phase_banner_dismissed_transitioning", "1");
    render(<PhaseSuggestionBanner signal={GRADUATION_SIGNAL} currentPhase="transitioning" />);
    expect(screen.getByRole("button", { name: /switch to refining/i })).toBeTruthy();
  });

  it("writes the per-direction flag and hides itself when dismiss is clicked", () => {
    render(<PhaseSuggestionBanner signal={GRADUATION_SIGNAL} currentPhase="transitioning" />);
    fireEvent.click(screen.getByRole("button", { name: /not yet/i }));
    expect(window.sessionStorage.getItem("kerf_phase_banner_dismissed_refining")).toBe("1");
    expect(screen.queryByRole("button", { name: /switch to refining/i })).toBeNull();
  });

  it("uses the direction-appropriate verb when refining → transitioning", () => {
    render(
      <PhaseSuggestionBanner
        signal={{
          suggestedPhase: "transitioning",
          reason: "You took a break, and your accuracy has dropped a bit.",
          confidence: "medium",
        }}
        currentPhase="refining"
      />,
    );
    expect(screen.getByRole("button", { name: /return to transitioning/i })).toBeTruthy();
  });
});
