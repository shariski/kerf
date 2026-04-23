/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { PauseOverlay, type PauseSettings } from "./PauseOverlay";

const SETTINGS: PauseSettings = {
  typingSize: "M",
  showKeyboard: true,
  expectedLetterHint: true,
};

afterEach(() => cleanup());

describe("PauseOverlay", () => {
  it("autofocuses the Resume button so Enter resumes", () => {
    const { container } = render(
      <PauseOverlay
        settings={SETTINGS}
        onSettingsChange={() => {}}
        onResume={() => {}}
        onRestart={() => {}}
        onEnd={() => {}}
      />,
    );
    const resume = container.querySelector(".kerf-pause-btn--primary");
    expect(resume).toBe(document.activeElement);
  });

  it("invokes onResume / onRestart / onEnd when their buttons are clicked", () => {
    const onResume = vi.fn();
    const onRestart = vi.fn();
    const onEnd = vi.fn();
    const { container } = render(
      <PauseOverlay
        settings={SETTINGS}
        onSettingsChange={() => {}}
        onResume={onResume}
        onRestart={onRestart}
        onEnd={onEnd}
      />,
    );
    const [resume, restart, end] = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".kerf-pause-btn"),
    );
    fireEvent.click(resume!);
    fireEvent.click(restart!);
    fireEvent.click(end!);
    expect(onResume).toHaveBeenCalledTimes(1);
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("fires onSettingsChange with the new value when a pill is clicked", () => {
    const onSettingsChange = vi.fn();
    const { container } = render(
      <PauseOverlay
        settings={SETTINGS}
        onSettingsChange={onSettingsChange}
        onResume={() => {}}
        onRestart={() => {}}
        onEnd={() => {}}
      />,
    );
    const pills = Array.from(container.querySelectorAll<HTMLButtonElement>(".kerf-pill-option"));
    // typingSize pills are the first group: S, M, L, XL
    const lPill = pills.find((p) => p.textContent === "L");
    expect(lPill).toBeDefined();
    fireEvent.click(lPill!);
    expect(onSettingsChange).toHaveBeenCalledWith({ ...SETTINGS, typingSize: "L" });
  });

  it("marks the dialog with aria-modal for assistive tech", () => {
    const { container } = render(
      <PauseOverlay
        settings={SETTINGS}
        onSettingsChange={() => {}}
        onResume={() => {}}
        onRestart={() => {}}
        onEnd={() => {}}
      />,
    );
    const overlay = container.querySelector(".kerf-pause-overlay");
    expect(overlay?.getAttribute("role")).toBe("dialog");
    expect(overlay?.getAttribute("aria-modal")).toBe("true");
  });
});
