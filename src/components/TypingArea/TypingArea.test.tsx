/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { TypingArea } from "./TypingArea";
import { sessionStore } from "#/stores/sessionStore";
import { idleSessionState } from "#/domain/session/types";

afterEach(() => {
  cleanup();
  sessionStore.setState(idleSessionState());
});

describe("TypingArea error display", () => {
  it("shows the actually typed char at the error position, with the expected char as the hint above", () => {
    render(<TypingArea target="ab" />);
    // Type a wrong char 'x' for the expected 'a'.
    act(() => {
      sessionStore.getState().dispatch({ type: "keypress", char: "x", now: 1000 });
    });
    const area = screen.getByTestId("typing-area");
    const errorEl = area.querySelector(".kerf-typing-error");
    // The error span holds the typed 'x' plus the expected-char badge 'a'.
    expect(errorEl?.textContent).toBe("xa");
    const expectedEl = area.querySelector(".kerf-typing-expected");
    expect(expectedEl?.textContent).toBe("a");
  });

  it("restores the target char after backspace clears the error", () => {
    render(<TypingArea target="ab" />);
    act(() => {
      sessionStore.getState().dispatch({ type: "keypress", char: "x", now: 1000 });
      sessionStore.getState().dispatch({ type: "backspace" });
    });
    const area = screen.getByTestId("typing-area");
    const currentEl = area.querySelector(".kerf-typing-current");
    expect(currentEl?.textContent).toBe("a");
    expect(area.querySelector(".kerf-typing-error")).toBeNull();
  });
});
