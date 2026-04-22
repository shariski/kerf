/** @vitest-environment jsdom */

/**
 * Render tests for the pre-session composite. Exercises the visible contract
 * (title, CTA, mode cards, filter toggle) rather than drilling into nested
 * components — each of those is trivial enough to not need isolation tests.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";

// `KeyboardContextPill` now renders a `<Link to="/keyboards">`, which
// needs router context. Stub the Link to a plain anchor so this unit
// test stays focused on the pre-session composite's own contract.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { PreSessionStage } from "./PreSessionStage";
import type { PreSessionFilterValues } from "./PreSessionFilters";

const FILTERS: PreSessionFilterValues = {
  handIsolation: "either",
  maxWordLength: 6,
  showKeyboard: true,
};

/** Baseline props — tests override only what they assert on. */
const baseProps = {
  filterValues: FILTERS,
  onFilterChange: () => {},
  onStartAdaptive: () => {},
  onDrillWeakness: () => {},
  onDrillInnerColumn: () => {},
} as const;

afterEach(() => cleanup());

describe("PreSessionStage", () => {
  it("renders title, subtitle, keyboard pill, and phase badge", () => {
    const { container } = render(
      <PreSessionStage
        {...baseProps}
        keyboardType="lily58"
        phase="transitioning"
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
        {...baseProps}
        keyboardType="sofle"
        phase="refining"
        onStartAdaptive={onStart}
      />,
    );
    const cta = container.querySelector(".kerf-pre-cta-primary") as HTMLButtonElement;
    expect(cta).not.toBeNull();
    fireEvent.click(cta);
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("enables Drill and Inner-column mode cards, keeps Warm up disabled", () => {
    const { container } = render(
      <PreSessionStage
        {...baseProps}
        keyboardType="sofle"
        phase="transitioning"
      />,
    );
    const cards = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".kerf-mode-card"),
    );
    expect(cards).toHaveLength(3);
    const [drill, innerColumn, warmUp] = cards;
    expect(drill!.disabled).toBe(false);
    expect(innerColumn!.disabled).toBe(false);
    expect(warmUp!.disabled).toBe(true);
  });

  it("fires onDrillWeakness / onDrillInnerColumn when the respective cards are clicked", () => {
    const onDrill = vi.fn();
    const onInner = vi.fn();
    const { container } = render(
      <PreSessionStage
        {...baseProps}
        keyboardType="sofle"
        phase="transitioning"
        onDrillWeakness={onDrill}
        onDrillInnerColumn={onInner}
      />,
    );
    const [drillCard, innerColumnCard] = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".kerf-mode-card"),
    );
    fireEvent.click(drillCard!);
    fireEvent.click(innerColumnCard!);
    expect(onDrill).toHaveBeenCalledTimes(1);
    expect(onInner).toHaveBeenCalledTimes(1);
  });

  it("toggles the filters panel open/closed via the header button", () => {
    const { container } = render(
      <PreSessionStage
        {...baseProps}
        keyboardType="sofle"
        phase="transitioning"
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
        {...baseProps}
        keyboardType="sofle"
        phase="transitioning"
        onFilterChange={onChange}
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
