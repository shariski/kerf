/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { KeyboardContextPill } from "./KeyboardContextPill";

afterEach(() => cleanup());

describe("KeyboardContextPill", () => {
  it("renders the active label and keyboard name", () => {
    render(<KeyboardContextPill keyboardType="lily58" />);
    expect(screen.getByText("active")).toBeTruthy();
    expect(screen.getByText("lily58")).toBeTruthy();
  });

  it("renders a switch link pointing at /keyboards", () => {
    render(<KeyboardContextPill keyboardType="sofle" />);
    const link = screen.getByRole("link", { name: /switch/i });
    expect(link.getAttribute("href")).toBe("/keyboards");
  });
});
