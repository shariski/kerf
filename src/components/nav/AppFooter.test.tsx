/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

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

import { AppFooter } from "./AppFooter";

afterEach(() => cleanup());

describe("AppFooter", () => {
  it("renders as a <footer role=contentinfo>", () => {
    const { container } = render(<AppFooter />);
    const footer = container.querySelector("footer");
    expect(footer).not.toBeNull();
  });

  it("links to all five doc routes", () => {
    render(<AppFooter />);
    const hrefs = ["/how-it-works", "/why-split-is-hard", "/faq", "/privacy", "/terms"];
    for (const href of hrefs) {
      const link = screen.getAllByRole("link").find((el) => el.getAttribute("href") === href);
      expect(link, `missing footer link to ${href}`).toBeTruthy();
    }
  });

  it("renders exactly five links and no other textual content", () => {
    render(<AppFooter />);
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });
});
