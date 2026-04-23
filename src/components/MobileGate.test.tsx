/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MobileGate } from "./MobileGate";

afterEach(() => cleanup());

describe("MobileGate", () => {
  it("renders the exact locked headline", () => {
    render(<MobileGate />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "kerf is a desktop experience.",
    );
  });

  it("renders the exact locked body copy", () => {
    render(<MobileGate />);
    expect(
      screen.getByText(
        "You'll need a split mechanical keyboard to practice — we'll see you at your desk.",
      ),
    ).toBeTruthy();
  });

  it("has no interactive elements (no links, no buttons)", () => {
    const { container } = render(<MobileGate />);
    expect(container.querySelectorAll("a, button").length).toBe(0);
  });

  it("is labelled by its headline for screen readers", () => {
    const { container } = render(<MobileGate />);
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    const labelledBy = main?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe("kerf is a desktop experience.");
  });
});
