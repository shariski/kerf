/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { InlineEditField, COMING_SOON_HINT } from "./InlineEditField";

afterEach(() => cleanup());

describe("InlineEditField", () => {
  it("renders the value when present", () => {
    render(<InlineEditField value="user@example.com" ariaLabel="Email" />);
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("renders the default empty label when value is null", () => {
    render(<InlineEditField value={null} ariaLabel="Display name" />);
    expect(screen.getByText("— not set")).toBeTruthy();
  });

  it("renders a custom empty label when provided", () => {
    render(<InlineEditField value={null} emptyLabel="(blank)" ariaLabel="Bio" />);
    expect(screen.getByText("(blank)")).toBeTruthy();
  });

  it("is marked aria-disabled and shows the coming-soon hint", () => {
    render(<InlineEditField value="x" ariaLabel="Field" />);
    const group = screen.getByRole("group", { name: "Field" });
    expect(group.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getAllByText(COMING_SOON_HINT).length).toBeGreaterThan(0);
  });

  it("exports COMING_SOON_HINT as a stable string", () => {
    expect(typeof COMING_SOON_HINT).toBe("string");
    expect(COMING_SOON_HINT.length).toBeGreaterThan(0);
  });
});
