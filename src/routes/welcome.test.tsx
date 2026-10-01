/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  it("renders one short entry message", () => {
    render(<WelcomePage />);
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/build accuracy on your split keyboard/i);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("offers one clear start action with the sign-in step named", () => {
    render(<WelcomePage />);
    const primary = screen.getByRole("link", { name: /start typing/i });
    expect(primary?.getAttribute("href")).toBe("/login");
    expect(primary?.textContent).toMatch(/sign in or create your account/i);
  });

  it("links to the deep content routes", () => {
    render(<WelcomePage />);
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/why-split-is-hard");
    expect(hrefs).toContain("/how-it-works");
    expect(hrefs).not.toContain("/keyboards");
  });

  it("mentions Sofle and Lily58 by name (long-tail keyword density)", () => {
    render(<WelcomePage />);
    const body = document.body.textContent ?? "";
    expect(body).toMatch(/sofle/i);
    expect(body).toMatch(/lily58/i);
  });
});
