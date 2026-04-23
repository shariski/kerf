/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionBriefing } from "./SessionBriefing";
import type { SessionTarget } from "#/domain/adaptive/targetSelection";

const target: SessionTarget = {
  type: "vertical-column",
  value: "left-ring",
  keys: ["w", "s", "x"],
  label: "Left ring column vertical reach",
  score: 2.3,
};

const briefingText =
  "Your ring column runs vertical on this board.\nThis session trains the shift.";

afterEach(() => cleanup());

describe("SessionBriefing", () => {
  it("renders the target label prominently", () => {
    render(<SessionBriefing target={target} briefingText={briefingText} onStart={() => {}} />);
    expect(screen.getByRole("heading", { name: /Left ring column vertical reach/i })).toBeTruthy();
  });

  it("renders the briefing text", () => {
    render(<SessionBriefing target={target} briefingText={briefingText} onStart={() => {}} />);
    expect(screen.queryAllByText(/trains the shift/)).toHaveLength(1);
  });

  it("renders the target keys", () => {
    render(<SessionBriefing target={target} briefingText={briefingText} onStart={() => {}} />);
    for (const k of target.keys) {
      const elements = screen.queryAllByText(new RegExp(`^${k}$`, "i"));
      expect(elements.length).toBeGreaterThan(0);
    }
  });

  it("Start button calls onStart", () => {
    const onStart = vi.fn();
    render(<SessionBriefing target={target} briefingText={briefingText} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /start/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("Enter key triggers onStart", () => {
    const onStart = vi.fn();
    render(<SessionBriefing target={target} briefingText={briefingText} onStart={onStart} />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(onStart).toHaveBeenCalled();
  });

  it("has no verdict or hype language", () => {
    const { container } = render(
      <SessionBriefing target={target} briefingText={briefingText} onStart={() => {}} />,
    );
    expect(container.textContent).not.toMatch(/target met|target missed|amazing|crushing|!!/i);
  });
});
