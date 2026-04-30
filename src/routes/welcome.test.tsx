/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("#/lib/require-auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: () => (config: unknown) => config,
    redirect: vi.fn(),
    Link: ({
      to,
      children,
      ...rest
    }: {
      to: string;
      children: React.ReactNode;
    } & Record<string, unknown>) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  };
});

import { WelcomePage } from "./welcome";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("WelcomePage", () => {
  it("renders the H1 with the brand line", () => {
    render(<WelcomePage />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/typing practice that adapts to your split keyboard/i);
  });

  it("renders all four mid-page section headings", () => {
    render(<WelcomePage />);
    expect(
      screen.getByRole("heading", { level: 2, name: /why split keyboards are hard at first/i }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: /how kerf adapts/i })).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: /built for these keyboards/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: /what a session looks like/i }),
    ).toBeTruthy();
  });

  it("links the primary CTA to /login", () => {
    render(<WelcomePage />);
    const primary = screen.getAllByRole("link", { name: /start practicing/i })[0];
    expect(primary?.getAttribute("href")).toBe("/login");
  });

  it("links to the deep content routes", () => {
    render(<WelcomePage />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/why-split-is-hard");
    expect(hrefs).toContain("/how-it-works");
    expect(hrefs).toContain("/keyboards");
  });

  it("mentions Sofle and Lily58 by name (long-tail keyword density)", () => {
    render(<WelcomePage />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/sofle/i);
    expect(body).toMatch(/lily58/i);
  });
});
