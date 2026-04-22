/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    role,
    ...rest
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    role?: string;
    [k: string]: unknown;
  }) => (
    <a href={to} className={className} role={role} {...rest}>
      {children}
    </a>
  ),
}));

import {
  KeyboardSwitcherPill,
  type KeyboardSwitcherProfile,
} from "./KeyboardSwitcherPill";

const profiles: KeyboardSwitcherProfile[] = [
  { id: "p1", keyboardType: "lily58", isActive: true },
  { id: "p2", keyboardType: "sofle", isActive: false },
];

afterEach(() => cleanup());

describe("KeyboardSwitcherPill", () => {
  it("renders the active profile name in the trigger", () => {
    render(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: /viewing/i });
    expect(trigger.textContent).toMatch(/lily58/);
  });

  it("opens the menu on click and lists other profiles", () => {
    render(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /viewing/i }));
    expect(screen.getByRole("menu")).toBeTruthy();
    // The non-active profile row is rendered as a button with role=menuitem.
    const items = screen.getAllByRole("menuitem");
    expect(items.some((i) => i.textContent?.includes("sofle"))).toBe(true);
  });

  it("marks the active profile as current (aria-disabled) in the menu", () => {
    render(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /viewing/i }));
    const current = screen
      .getAllByRole("menuitem")
      .find((i) => i.getAttribute("aria-disabled") === "true");
    expect(current?.textContent).toMatch(/lily58/);
    expect(current?.textContent).toMatch(/current/i);
  });

  it("calls onSwitchProfile with the selected profile id", () => {
    const onSwitch = vi.fn();
    render(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={onSwitch} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /viewing/i }));
    const sofle = screen
      .getAllByRole("menuitem")
      .find((i) => i.textContent?.includes("sofle"));
    fireEvent.click(sofle!);
    expect(onSwitch).toHaveBeenCalledWith("p2");
  });

  it("closes on Escape and returns focus to the trigger", () => {
    render(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    const trigger = screen.getByRole("button", { name: /viewing/i });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("shows a Manage all link pointing at /keyboards", () => {
    render(
      <KeyboardSwitcherPill profiles={profiles} onSwitchProfile={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /viewing/i }));
    const link = screen.getByRole("link", { name: /manage all/i });
    expect(link.getAttribute("href")).toBe("/keyboards");
  });

  it("renders nothing when there is no active profile", () => {
    const { container } = render(
      <KeyboardSwitcherPill
        profiles={[{ id: "p2", keyboardType: "sofle", isActive: false }]}
        onSwitchProfile={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
