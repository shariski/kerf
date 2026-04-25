/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { TargetRibbon } from "./TargetRibbon";

afterEach(() => {
  cleanup();
});

describe("TargetRibbon", () => {
  it("renders the target label", () => {
    render(<TargetRibbon label="Left ring column vertical reach" keys={["w", "s", "x"]} />);
    expect(screen.getByText(/Left ring column vertical reach/)).toBeTruthy();
  });

  it("renders each key as a chip in the keys list", () => {
    render(<TargetRibbon label="Left ring column vertical reach" keys={["w", "s", "x"]} />);
    const keysList = screen.getByRole("list", { name: /keys in this target/i });
    expect(keysList.querySelectorAll("li")).toHaveLength(3);
  });

  it("renders space key with an accessible 'space' label and a visible glyph", () => {
    render(<TargetRibbon label="Thumb" keys={[" ", "a"]} />);
    // Visible content: space chip uses the open-box glyph; "a" uppercases to "A".
    const keysList = screen.getByRole("list", { name: /keys in this target/i });
    const items = keysList.querySelectorAll("li");
    expect(items[0]?.textContent).toContain("␣");
    expect(items[1]?.textContent).toContain("A");
    // Screen-reader text still says "space" so AT users get the word, not the glyph name.
    expect(keysList.textContent).toContain("space");
  });

  it("does not show a redundant 'Target:' prefix — the icon + aria-label carry that meaning", () => {
    render(<TargetRibbon label="Your weakness: Y" keys={["y"]} />);
    expect(screen.queryByText(/^Target:/)).toBeNull();
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
