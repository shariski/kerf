/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { JourneyCaptureCard } from "./JourneyCaptureCard";

afterEach(() => cleanup());

describe("JourneyCaptureCard", () => {
  it("renders the three journey options", () => {
    const { container } = render(<JourneyCaptureCard onSubmit={() => {}} />);
    expect(container.textContent).toMatch(/How do you type on your split keyboard\?/i);
    expect(screen.getByRole("radio", { name: /Like QWERTY/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /One finger per column/i })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /not sure/i })).toBeTruthy();
  });

  it("submits the chosen journey", () => {
    const onSubmit = vi.fn();
    render(<JourneyCaptureCard onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("radio", { name: /One finger per column/i }));
    fireEvent.click(screen.getByRole("button", { name: /save/i }));
    expect(onSubmit).toHaveBeenCalledWith("columnar");
  });

  it("has no hyped copy", () => {
    const { container } = render(<JourneyCaptureCard onSubmit={() => {}} />);
    expect(container.textContent).not.toMatch(/amazing|crushing|!!/i);
  });
});
