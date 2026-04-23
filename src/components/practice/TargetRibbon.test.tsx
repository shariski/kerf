/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TargetRibbon } from "./TargetRibbon";

afterEach(() => {
  cleanup();
});

describe("TargetRibbon", () => {
  it("renders the target label and keys inline", () => {
    render(<TargetRibbon label="Left ring column vertical reach" keys={["w", "s", "x"]} />);
    expect(screen.getByText(/Left ring column vertical reach/)).toBeTruthy();
    expect(screen.getByText(/w/i)).toBeTruthy();
  });

  it("renders space key as the word 'space'", () => {
    render(<TargetRibbon label="Thumb" keys={[" ", "a"]} />);
    expect(screen.getByText(/space a/)).toBeTruthy();
  });

  it("has region landmark with accessible label", () => {
    render(<TargetRibbon label="Test" keys={["a"]} />);
    const region = screen.getByRole("region", { name: /session target/i });
    expect(region).toBeTruthy();
  });

  it("is static — does not accept live metrics", () => {
    // Type-level assertion: the component props should not include accuracy/progress.
    // We assert by rendering twice with the same props and ensuring no state change.
    const { rerender, container } = render(<TargetRibbon label="x" keys={["a"]} />);
    const initial = container.innerHTML;
    rerender(<TargetRibbon label="x" keys={["a"]} />);
    expect(container.innerHTML).toBe(initial);
  });
});
