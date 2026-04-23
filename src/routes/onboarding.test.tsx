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
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
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

/** Helper: advance past steps 1–3 to reach step 4 (journey question). */
function advanceToJourneyStep() {
  render(<OnboardingPage />);
  // Step 1: keyboard (Lily58 pre-selected, just Continue)
  fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
  // Step 2: hand (Right pre-selected, just Continue)
  fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
  // Step 3: level (first_day pre-selected, just Continue)
  fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
}

describe("OnboardingPage", () => {
  it("starts on step 1 with Lily58 pre-selected and Continue enabled", () => {
    render(<OnboardingPage />);

    expect(screen.getByText(/step 1 of 4/i)).toBeTruthy();
    expect(screen.getByText(/first, your keyboard/i)).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: /which split keyboard are you using/i,
      }),
    ).toBeTruthy();

    // Spec default (docs/06-design-summary.md §/onboarding): Lily58.
    expect(screen.getByRole("button", { name: /^lily58$/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /^sofle$/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );

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

  it("advances through all four steps, submits, and lands on the summary", async () => {
    createKeyboardProfile.mockResolvedValueOnce({ id: "p1" });
    render(<OnboardingPage />);

    // Step 1: pick Sofle.
    fireEvent.click(screen.getByRole("button", { name: /^sofle$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    // Step 2: pick Right.
    expect(screen.getByText(/step 2 of 4/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    // Step 3: pick level 1.
    expect(screen.getByText(/step 3 of 4/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /first day on split/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    // Step 4: pick journey.
    expect(screen.getByText(/step 4 of 4/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /like qwerty, just on a split board/i }));

    const finish = screen.getByRole("button", { name: /finish setup/i });
    expect(finish.hasAttribute("disabled")).toBe(false);
    fireEvent.click(finish);

    await vi.waitFor(() => {
      expect(createKeyboardProfile).toHaveBeenCalledExactlyOnceWith({
        data: {
          keyboardType: "sofle",
          dominantHand: "right",
          initialLevel: "first_day",
          fingerAssignment: "conventional",
        },
      });
    });

    // Landing shown.
    await screen.findByText(/you're ready/i);
    expect(screen.getByText(/all set/i)).toBeTruthy();

    // Click "Start first session" to jump past the auto-redirect.
    fireEvent.click(screen.getByRole("button", { name: /start first session/i }));
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
    fireEvent.click(screen.getByRole("button", { name: /first day on split/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    // Step 4: pick any journey option (unsure is pre-selected, just finish)
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
    expect(screen.getByText(/step 1 of 4/i)).toBeTruthy();

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
    fireEvent.click(screen.getByRole("button", { name: /comfortable, refining/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    // Step 4: default (unsure) is pre-selected, just finish
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
    expect(progress.getAttribute("aria-valuemax")).toBe("4");
  });

  it("uses calm, non-hyped copy throughout", () => {
    render(<OnboardingPage />);

    // Advance to the journey step (most recently added copy).
    fireEvent.click(screen.getByRole("button", { name: /^sofle$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /right-handed/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /first day on split/i }));
    fireEvent.click(screen.getByRole("button", { name: /^continue/i }));

    const text = document.body.textContent ?? "";
    const banned = [/amazing/i, /crushing it/i, /nailed it/i, /incredible/i, /!!+/];
    for (const pattern of banned) {
      expect(text).not.toMatch(pattern);
    }
  });

  // ── Step 4: Journey question ──────────────────────────────────────────────

  describe("Step 4 — journey question", () => {
    it("renders the heading, three radio options, and footnote", () => {
      advanceToJourneyStep();

      expect(
        screen.getByRole("heading", {
          name: /how do you type on your split keyboard/i,
        }),
      ).toBeTruthy();

      expect(
        screen.getByRole("radio", {
          name: /like qwerty, just on a split board/i,
        }),
      ).toBeTruthy();
      expect(screen.getByRole("radio", { name: /one finger per column/i })).toBeTruthy();
      expect(screen.getByRole("radio", { name: /i'm not sure/i })).toBeTruthy();

      expect(screen.getByText(/you can change this anytime in settings/i)).toBeTruthy();
    });

    it("has 'I'm not sure' pre-selected (safe default)", () => {
      advanceToJourneyStep();
      const unsure = screen.getByRole("radio", { name: /i'm not sure/i });
      expect((unsure as HTMLInputElement).checked).toBe(true);
    });

    it("Finish Setup is enabled without making a selection (unsure default)", () => {
      advanceToJourneyStep();
      const finish = screen.getByRole("button", { name: /finish setup/i });
      expect(finish.hasAttribute("disabled")).toBe(false);
    });

    it("submits fingerAssignment: 'conventional' when Like QWERTY is chosen", async () => {
      createKeyboardProfile.mockResolvedValueOnce({ id: "p1" });
      advanceToJourneyStep();
      fireEvent.click(
        screen.getByRole("radio", {
          name: /like qwerty, just on a split board/i,
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));
      await vi.waitFor(() => {
        expect(createKeyboardProfile).toHaveBeenCalledTimes(1);
        const call = createKeyboardProfile.mock.calls[0]![0] as {
          data: Record<string, unknown>;
        };
        expect(call.data.fingerAssignment).toBe("conventional");
      });
    });

    it("submits fingerAssignment: 'columnar' when One finger per column is chosen", async () => {
      createKeyboardProfile.mockResolvedValueOnce({ id: "p1" });
      advanceToJourneyStep();
      fireEvent.click(screen.getByRole("radio", { name: /one finger per column/i }));
      fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));
      await vi.waitFor(() => {
        expect(createKeyboardProfile).toHaveBeenCalledTimes(1);
        const call = createKeyboardProfile.mock.calls[0]![0] as {
          data: Record<string, unknown>;
        };
        expect(call.data.fingerAssignment).toBe("columnar");
      });
    });

    it("submits fingerAssignment: 'unsure' when I'm not sure is chosen (or kept as default)", async () => {
      createKeyboardProfile.mockResolvedValueOnce({ id: "p1" });
      advanceToJourneyStep();
      // "I'm not sure" is pre-selected; no extra click needed.
      fireEvent.click(screen.getByRole("button", { name: /finish setup/i }));
      await vi.waitFor(() => {
        expect(createKeyboardProfile).toHaveBeenCalledTimes(1);
        const call = createKeyboardProfile.mock.calls[0]![0] as {
          data: Record<string, unknown>;
        };
        expect(call.data.fingerAssignment).toBe("unsure");
      });
    });
  });
});
