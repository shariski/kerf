/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TypingArea } from "./TypingArea";
import { sessionStore } from "#/stores/sessionStore";
import { idleSessionState } from "#/domain/session/types";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  // Reset the singleton Zustand store between tests so state doesn't leak.
  sessionStore.setState({
    ...idleSessionState(),
    dispatch: sessionStore.getState().dispatch,
  });
});

describe("TypingArea — rendering", () => {
  it("renders one span per target char inside the typing container", () => {
    const { container } = render(<TypingArea target="abc" />);
    const chars = container.querySelectorAll(".kerf-typing-char");
    expect(chars).toHaveLength(3);
  });

  it("marks the first position as current on mount", () => {
    const { container } = render(<TypingArea target="abc" />);
    const current = container.querySelectorAll(".kerf-typing-current");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe("a");
  });

  it("renders spaces as non-breaking so highlight has width", () => {
    const { container } = render(<TypingArea target="a b" />);
    const chars = container.querySelectorAll(".kerf-typing-char");
    // The middle char is a space — rendered as U+00A0 so layout doesn't collapse.
    expect(chars[1]?.textContent).toBe("\u00A0");
  });
});

describe("TypingArea — typing progression", () => {
  it("moves 'current' class forward as user types correctly", () => {
    const { container } = render(<TypingArea target="abc" />);

    fireEvent.keyDown(window, { key: "a" });
    const typed = container.querySelectorAll(".kerf-typing-typed");
    const current = container.querySelectorAll(".kerf-typing-current");
    expect(typed).toHaveLength(1);
    expect(typed[0]?.textContent).toBe("a");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe("b");
  });

  it("shows error visualization + expected badge on wrong keystroke", () => {
    const { container } = render(<TypingArea target="nice" />);

    fireEvent.keyDown(window, { key: "b" });

    const error = container.querySelector(".kerf-typing-error");
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain("n"); // displayed char + badge text

    const badge = container.querySelector(".kerf-typing-expected");
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe("n");
  });

  it("clears error and badge after backspace", () => {
    const { container } = render(<TypingArea target="nice" />);

    fireEvent.keyDown(window, { key: "b" });
    expect(container.querySelector(".kerf-typing-expected")).not.toBeNull();

    fireEvent.keyDown(window, { key: "Backspace" });
    expect(container.querySelector(".kerf-typing-expected")).toBeNull();
    expect(container.querySelector(".kerf-typing-error")).toBeNull();
    expect(container.querySelector(".kerf-typing-current")?.textContent).toBe("n");
  });

  it("ignores modifier chords (Cmd+R, Ctrl+A) so browser shortcuts still work", () => {
    const { container } = render(<TypingArea target="abc" />);

    fireEvent.keyDown(window, { key: "r", metaKey: true });
    fireEvent.keyDown(window, { key: "a", ctrlKey: true });

    // No progress — still on position 0.
    expect(container.querySelectorAll(".kerf-typing-typed")).toHaveLength(0);
  });
});

describe("TypingArea — expectedLetterHint preference", () => {
  it("suppresses the expected-letter badge when expectedLetterHint=false", () => {
    const { container } = render(
      <TypingArea target="nice" expectedLetterHint={false} />,
    );

    fireEvent.keyDown(window, { key: "b" });
    // Error styling still applies — only the amber hint badge is hidden.
    expect(container.querySelector(".kerf-typing-error")).not.toBeNull();
    expect(container.querySelector(".kerf-typing-expected")).toBeNull();
  });
});

describe("TypingArea — accessibility", () => {
  it("exposes a labeled textbox role for screen readers", () => {
    render(<TypingArea target="abc" />);
    expect(screen.getByRole("textbox", { name: /typing exercise/i })).toBeInstanceOf(
      HTMLElement,
    );
  });

  it("marks the expected-letter badge as aria-hidden (decorative)", () => {
    const { container } = render(<TypingArea target="nice" />);
    fireEvent.keyDown(window, { key: "b" });
    expect(
      container.querySelector(".kerf-typing-expected")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });
});
