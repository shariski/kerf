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

import { OnboardingPage } from "./onboarding";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("OnboardingPage", () => {
  it("starts on step 1 with Lily58 pre-selected and Continue enabled", () => {
    render(<OnboardingPage />);

    expect(screen.getByText(/step 1 of 3/i)).toBeTruthy();
    expect(screen.getByText(/first, your keyboard/i)).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: /which split keyboard are you using/i,
      }),
    ).toBeTruthy();

    // Spec default (docs/06-design-summary.md §/onboarding): Lily58.
    expect(
      screen.getByRole("button", { name: /^lily58$/i }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: /^sofle$/i }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("false");

    const cta = screen.getByRole("button", { name: /^continue/i });
    expect(cta.hasAttribute("disabled")).toBe(false);
  });

  it("hides Back on step 1 (preserves layout space)", () => {
    const { container } = render(<OnboardingPage />);
    const back = Array.from(container.querySelectorAll("button")).find((b) =>
      /back/i.test(b.textContent ?? ""),
    );
    expect(back).toBeTruthy();
    expect(back?.style.visibility).toBe("hidden");
  });

  it("advances through all three steps, submits, and lands on the summary", async () => {
    createKeyboardProfile.mockResolvedValueOnce({ id: "p1" });
    render(<OnboardingPage />);

    // Step 1: pick Sofle.
    fireEvent.click(screen.getByRole("button", { name: /^sofle$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    // Step 2: pick Right.
    expect(screen.getByText(/step 2 of 3/i)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /right-handed/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    // Step 3: pick level 1.
    expect(screen.getByText(/step 3 of 3/i)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: /first day on split/i }),
    );

    const finish = screen.getByRole("button", { name: /finish setup/i });
    expect(finish.hasAttribute("disabled")).toBe(false);
    fireEvent.click(finish);

    await vi.waitFor(() => {
      expect(createKeyboardProfile).toHaveBeenCalledExactlyOnceWith({
        data: {
          keyboardType: "sofle",
          dominantHand: "right",
          initialLevel: "first_day",
        },
      });
    });

    // Landing shown.
    await screen.findByText(/you're ready/i);
    expect(screen.getByText(/all set/i)).toBeTruthy();

    // Click "Start first session" to jump past the auto-redirect.
    fireEvent.click(
      screen.getByRole("button", { name: /start first session/i }),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/practice" });
  });

  it("landing auto-redirects after 3 seconds", async () => {
    vi.useFakeTimers();
    createKeyboardProfile.mockResolvedValueOnce({ id: "p1" });
    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /^sofle$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /first day on split/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));

    // Flush the pending createKeyboardProfile promise.
    await vi.waitFor(() => {
      expect(createKeyboardProfile).toHaveBeenCalled();
    });
    // Landing should render.
    await vi.waitFor(() => {
      expect(screen.getByText(/you're ready/i)).toBeTruthy();
    });

    expect(navigate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(3000);
    expect(navigate).toHaveBeenCalledWith({ to: "/practice" });
  });

  it("Back navigates to the previous step while preserving selections", () => {
    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /^lily58$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /left-handed/i }));

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/step 1 of 3/i)).toBeTruthy();

    const lily58Card = screen.getByRole("button", { name: /^lily58$/i });
    expect(lily58Card.getAttribute("aria-pressed")).toBe("true");
  });

  it("shows an error message if the server function rejects", async () => {
    createKeyboardProfile.mockRejectedValueOnce(new Error("boom"));
    render(<OnboardingPage />);

    fireEvent.click(screen.getByRole("button", { name: /^sofle$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /comfortable, refining/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));

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

    // Advance to the level step (most descriptive copy).
    fireEvent.click(screen.getByRole("button", { name: /^sofle$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

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
