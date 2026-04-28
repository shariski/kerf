/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Mock TanStack Router's <Link> as a plain <a>; preserves all props we
// care about asserting on (href, className, etc.). Mirrors the existing
// pattern.
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

  it("links to all 5 internal doc routes plus /contact", () => {
    render(<AppFooter />);
    const hrefs = ["/how-it-works", "/why-split-is-hard", "/faq", "/contact", "/privacy", "/terms"];
    for (const href of hrefs) {
      const link = screen.getAllByRole("link").find((el) => el.getAttribute("href") === href);
      expect(link, `missing footer link to ${href}`).toBeTruthy();
    }
  });

  it("renders the github external link with correct attrs + aria-label", () => {
    render(<AppFooter />);
    const github = screen
      .getAllByRole("link")
      .find((el) => el.getAttribute("href") === "https://github.com/shariski/kerf");
    expect(github, "missing github external link").toBeTruthy();
    expect(github!.getAttribute("target")).toBe("_blank");
    const rel = github!.getAttribute("rel") ?? "";
    expect(rel).toContain("noopener");
    expect(rel).toContain("noreferrer");
    expect(github!.getAttribute("aria-label")).toMatch(/opens in new tab/i);
  });

  it("renders exactly 7 links (5 doc + contact + github) and no other textual links", () => {
    render(<AppFooter />);
    expect(screen.getAllByRole("link")).toHaveLength(7);
  });

  it("renders 6 separators between 7 links", () => {
    const { container } = render(<AppFooter />);
    const separators = container.querySelectorAll(".kerf-app-footer-sep");
    expect(separators).toHaveLength(6);
  });
});
