/** @vitest-environment jsdom */

/**
 * Render tests for the pre-session composite. Exercises the visible contract
 * (title, CTA, mode cards, filter toggle) rather than drilling into nested
 * components — each of those is trivial enough to not need isolation tests.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { PreSessionStage } from "./PreSessionStage";
import type { PreSessionFilterValues } from "./PreSessionFilters";

const FILTERS: PreSessionFilterValues = {
  handIsolation: "either",
  maxWordLength: 6,
  showKeyboard: true,
};

afterEach(() => cleanup());

describe("PreSessionStage", () => {
  it("renders title, subtitle, keyboard pill, and phase badge", () => {
    const { container } = render(
      <PreSessionStage
        keyboardType="lily58"
        phase="transitioning"
        filterValues={FILTERS}
        onFilterChange={() => {}}
        onStartAdaptive={() => {}}
      />,
    );
    expect(container.querySelector(".kerf-pre-title")?.textContent).toBe(
      "What will you practice?",
    );
    expect(container.querySelector(".kerf-pre-subtitle")?.textContent).toBe(
      "Accuracy first. Speed follows.",
    );
    expect(container.querySelector(".kerf-pill-name")?.textContent).toBe(
      "lily58",
    );
    const badge = container.querySelector(".kerf-phase-badge");
    expect(badge?.getAttribute("data-phase")).toBe("transitioning");
    expect(badge?.textContent?.includes("transitioning")).toBe(true);
  });

  it("fires onStartAdaptive when the primary CTA is clicked", () => {
    const onStart = vi.fn();
    const { container } = render(
      <PreSessionStage
        keyboardType="sofle"
        phase="refining"
        filterValues={FILTERS}
        onFilterChange={() => {}}
        onStartAdaptive={onStart}
      />,
    );
    const cta = container.querySelector(".kerf-pre-cta-primary") as HTMLButtonElement;
    expect(cta).not.toBeNull();
    fireEvent.click(cta);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("renders the secondary mode cards as disabled (Task 2.6+)", () => {
    const { container } = render(
      <PreSessionStage
        keyboardType="sofle"
        phase="transitioning"
        filterValues={FILTERS}
        onFilterChange={() => {}}
        onStartAdaptive={() => {}}
      />,
    );
    const cards = container.querySelectorAll<HTMLButtonElement>(".kerf-mode-card");
    expect(cards).toHaveLength(3);
    for (const card of cards) {
      expect(card.disabled).toBe(true);
      expect(card.dataset.disabled).toBe("true");
    }
  });

  it("toggles the filters panel open/closed via the header button", () => {
    const { container } = render(
      <PreSessionStage
        keyboardType="sofle"
        phase="transitioning"
        filterValues={FILTERS}
        onFilterChange={() => {}}
        onStartAdaptive={() => {}}
      />,
    );
    const header = container.querySelector(".kerf-pre-filters-header") as HTMLButtonElement;
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector(".kerf-pre-filters-content")).toBeNull();
    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".kerf-pre-filters-content")).not.toBeNull();
  });

  it("propagates filter changes to onFilterChange", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PreSessionStage
        keyboardType="sofle"
        phase="transitioning"
        filterValues={FILTERS}
        onFilterChange={onChange}
        onStartAdaptive={() => {}}
      />,
    );
    fireEvent.click(container.querySelector(".kerf-pre-filters-header")!);
    const pills = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".kerf-filter-pill"),
    );
    const leftOnly = pills.find((p) => p.textContent === "Left only");
    expect(leftOnly).toBeDefined();
    fireEvent.click(leftOnly!);
    expect(onChange).toHaveBeenCalledWith({ ...FILTERS, handIsolation: "left" });
  });
});
