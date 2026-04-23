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

  it("renders spaces as regular spaces so the browser can wrap at word boundaries", () => {
    const { container } = render(<TypingArea target="a b" />);
    const chars = container.querySelectorAll(".kerf-typing-char");
    // Space char is preserved as-is (not \u00A0). Words are atomic via inline-
    // block wrappers; browser wraps between them at these real space chars.
    expect(chars[1]?.textContent).toBe(" ");
  });

  it("wraps each word in an inline-block .kerf-typing-word container (atomic wrapping)", () => {
    const { container } = render(<TypingArea target="one two" />);
    const words = container.querySelectorAll(".kerf-typing-word");
    expect(words).toHaveLength(2);
    expect(words[0]?.textContent).toBe("one");
    expect(words[1]?.textContent).toBe("two");
    // The space between them lives outside any word wrapper so it's a real
    // break opportunity for the browser.
    const spaceChars = Array.from(container.querySelectorAll(".kerf-typing-char")).filter(
      (el) => el.textContent === " ",
    );
    expect(spaceChars).toHaveLength(1);
    expect(spaceChars[0]?.closest(".kerf-typing-word")).toBeNull();
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
    const { container } = render(<TypingArea target="nice" expectedLetterHint={false} />);

    fireEvent.keyDown(window, { key: "b" });
    // Error styling still applies — only the amber hint badge is hidden.
    expect(container.querySelector(".kerf-typing-error")).not.toBeNull();
    expect(container.querySelector(".kerf-typing-expected")).toBeNull();
  });
});

describe("TypingArea — targetKeys highlight", () => {
  it("adds kerf-typing-target class to upcoming chars that are in targetKeys", () => {
    const { container } = render(<TypingArea target="abc" targetKeys={["b"]} />);
    const chars = container.querySelectorAll(".kerf-typing-char");
    // Position 0 is 'a' — upcoming, NOT a target. Position 1 is 'b' — upcoming target.
    expect(chars[1]?.classList.contains("kerf-typing-target")).toBe(true);
    expect(chars[2]?.classList.contains("kerf-typing-target")).toBe(false);
  });

  it("adds kerf-typing-target to the current-position char when it is a target", () => {
    const { container } = render(<TypingArea target="bcd" targetKeys={["b"]} />);
    // Position 0 ('b') is the current cursor AND a target — both classes stack.
    const current = container.querySelector(".kerf-typing-current");
    expect(current?.classList.contains("kerf-typing-target")).toBe(true);
  });

  it("does NOT add kerf-typing-target to chars already typed past the cursor", () => {
    const { container } = render(<TypingArea target="bcd" targetKeys={["b"]} />);
    fireEvent.keyDown(window, { key: "b" });
    // 'b' is now typed — typed state wins; no target class retroactively.
    const typed = container.querySelector(".kerf-typing-typed");
    expect(typed?.textContent).toBe("b");
    expect(typed?.classList.contains("kerf-typing-target")).toBe(false);
  });

  it("is a no-op when targetKeys is undefined (no class on any char)", () => {
    const { container } = render(<TypingArea target="abc" />);
    const targets = container.querySelectorAll(".kerf-typing-target");
    expect(targets).toHaveLength(0);
  });

  it("is a no-op when targetKeys is an empty array", () => {
    const { container } = render(<TypingArea target="abc" targetKeys={[]} />);
    const targets = container.querySelectorAll(".kerf-typing-target");
    expect(targets).toHaveLength(0);
  });
});

describe("TypingArea — accessibility", () => {
  it("exposes a labeled textbox role for screen readers", () => {
    render(<TypingArea target="abc" />);
    expect(screen.getByRole("textbox", { name: /typing exercise/i })).toBeInstanceOf(HTMLElement);
  });

  it("marks the expected-letter badge as aria-hidden (decorative)", () => {
    const { container } = render(<TypingArea target="nice" />);
    fireEvent.keyDown(window, { key: "b" });
    expect(container.querySelector(".kerf-typing-expected")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });
});
