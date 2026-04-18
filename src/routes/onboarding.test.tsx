/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const createKeyboardProfile = vi.fn();
const navigate = vi.fn();

vi.mock("#/server/profile", () => ({
  createKeyboardProfile: (args: unknown) => createKeyboardProfile(args),
  getActiveProfile: vi.fn(),
}));

vi.mock("#/lib/require-auth", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>(
      "@tanstack/react-router",
    );
  return {
    ...actual,
    useRouter: () => ({ navigate }),
    createFileRoute: () => (config: unknown) => config,
    redirect: vi.fn(),
  };
});

// The keyboard SVGs render many nested paths that aren't relevant to the
// onboarding behavior under test — stub them with lightweight placeholders.
vi.mock("#/components/keyboard", () => ({
  SofleSVG: (props: { className?: string }) => (
    <div data-testid="sofle-svg" className={props.className} />
  ),
  Lily58SVG: (props: { className?: string }) => (
    <div data-testid="lily58-svg" className={props.className} />
  ),
}));

import { OnboardingPage } from "./onboarding";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OnboardingPage", () => {
  it("starts on step 1 with Next disabled until a keyboard is picked", () => {
    render(<OnboardingPage />);

    expect(screen.getByText(/step 1 of 3/i)).toBeTruthy();
    expect(screen.getByText(/first, your keyboard/i)).toBeTruthy();
    const next = screen.getByRole("button", { name: /next/i });
    expect(next.hasAttribute("disabled")).toBe(true);
  });

  it("disables Back on step 1", () => {
    render(<OnboardingPage />);
    const back = screen.getByRole("button", { name: /back/i });
    expect(back.hasAttribute("disabled")).toBe(true);
  });

  it("advances through all three steps and submits the profile", async () => {
    createKeyboardProfile.mockResolvedValueOnce({ id: "p1" });
    render(<OnboardingPage />);

    // Step 1: pick Sofle.
    fireEvent.click(screen.getByRole("button", { name: /sofle/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 2: pick Right.
    expect(screen.getByText(/step 2 of 3/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // Step 3: pick a level.
    expect(screen.getByText(/step 3 of 3/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /first day on split/i }));

    const submit = screen.getByRole("button", { name: /start first session/i });
    expect(submit.hasAttribute("disabled")).toBe(false);
    fireEvent.click(submit);

    await vi.waitFor(() => {
      expect(createKeyboardProfile).toHaveBeenCalledExactlyOnceWith({
        data: {
          keyboardType: "sofle",
          dominantHand: "right",
          initialLevel: "first_day",
        },
      });
    });

    await vi.waitFor(() => {
      expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: "/practice" });
    });
  });

  it("Back navigates to the previous step while preserving selections", () => {
    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /lily58/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /left-handed/i }));

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/step 1 of 3/i)).toBeTruthy();

    const lily58Card = screen.getByRole("button", { name: /lily58/i });
    expect(lily58Card.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows an error message if the server function rejects", async () => {
    createKeyboardProfile.mockRejectedValueOnce(new Error("boom"));
    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /sofle/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /comfortable already/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /start first session/i }),
    );

    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toMatch(/try again/i);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("labels the progress bar for screen readers", () => {
    render(<OnboardingPage />);
    const progress = screen.getByRole("progressbar");
    expect(progress.getAttribute("aria-valuenow")).toBe("1");
    expect(progress.getAttribute("aria-valuemin")).toBe("1");
    expect(progress.getAttribute("aria-valuemax")).toBe("3");
  });

  it("uses calm, non-hyped copy throughout", () => {
    render(<OnboardingPage />);

    // Advance to the level step (which has the most descriptive copy).
    fireEvent.click(screen.getByRole("button", { name: /sofle/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    const text = document.body.textContent ?? "";
    const banned = [
      /amazing/i,
      /crushing it/i,
      /nailed it/i,
      /incredible/i,
      /!!+/,
    ];
    for (const pattern of banned) {
      expect(text).not.toMatch(pattern);
    }
  });
});
