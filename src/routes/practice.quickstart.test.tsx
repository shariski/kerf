/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sessionStore } from "#/stores/sessionStore";

const mockRoute = vi.hoisted(() => ({
  search: { autostart: true } as { autostart?: boolean },
  corpusReady: true,
  navigate: vi.fn(),
  loaderData: {
    profile: {
      id: "00000000-0000-4000-8000-000000000001",
      keyboardType: "sofle",
      dominantHand: "right",
      transitionPhase: "transitioning",
    },
    isFirstSession: false,
    completedSessionCount: 1,
    recentTargets: [],
    engineData: null,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: object) => ({
    ...config,
    useLoaderData: () => mockRoute.loaderData,
    useSearch: () => mockRoute.search,
  }),
  redirect: vi.fn(),
  useNavigate: () => mockRoute.navigate,
  useRouter: () => ({ invalidate: vi.fn() }),
  useRouterState: () => "/practice",
}));

vi.mock("#/components/practice", () => ({
  ActiveSessionStage: () => <div data-testid="active-session" />,
  PauseOverlay: () => null,
  PostSessionStage: () => null,
  PreSessionStage: ({ onStartAdaptive }: { onStartAdaptive: () => void }) => (
    <button type="button" data-testid="pre-session" onClick={onStartAdaptive}>
      Start
    </button>
  ),
  SessionBriefing: () => <div data-testid="briefing" />,
  TargetRibbon: ({ label }: { label: string }) => <div data-testid="focus-cue">{label}</div>,
}));

vi.mock("#/hooks/useCorpus", () => ({
  useCorpus: () =>
    mockRoute.corpusReady
      ? { status: "ready", corpus: { words: [] }, bigramSupport: new Map(), charSupport: new Map() }
      : { status: "loading" },
}));
vi.mock("#/hooks/useIdleAutoPause", () => ({ useIdleAutoPause: () => undefined }));
vi.mock("#/hooks/useBeforeUnloadWarning", () => ({ useBeforeUnloadWarning: () => undefined }));
vi.mock("#/hooks/useOtherTabActive", () => ({ useOtherTabActive: () => false }));
vi.mock("#/lib/persistSessionWithRetry", () => ({
  flushSessionQueue: vi.fn().mockResolvedValue(undefined),
  persistSessionWithRetry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("#/domain/adaptive/sessionGenerator", () => ({
  generateSession: () => ({
    exercise: "abc",
    target: { type: "character", value: "a", label: "Focus A", keys: ["a"] },
    briefing: { text: "Notice A" },
  }),
}));

import { Route } from "./practice";

const PracticePage = (Route as unknown as { component: React.ComponentType }).component;

afterEach(() => {
  cleanup();
  sessionStore.getState().dispatch({ type: "reset" });
  mockRoute.search = { autostart: true };
  mockRoute.corpusReady = true;
  mockRoute.loaderData.isFirstSession = false;
  mockRoute.navigate.mockClear();
});

describe("Home quick start", () => {
  it("starts typing with the target visible and survives clearing autostart", async () => {
    const view = render(<PracticePage />);
    await waitFor(() => expect(sessionStore.getState().status).toBe("active"));
    expect(screen.getByTestId("active-session")).toBeTruthy();
    expect(screen.getByTestId("focus-cue").textContent).toBe("Focus A");
    expect(screen.queryByTestId("briefing")).toBeNull();

    mockRoute.search = {};
    view.rerender(<PracticePage />);
    expect(sessionStore.getState().status).toBe("active");
  });

  it("keeps the regular practice briefing after an explicit mode choice", async () => {
    mockRoute.search = {};
    render(<PracticePage />);
    fireEvent.click(screen.getByTestId("pre-session"));
    expect(screen.getByTestId("briefing")).toBeTruthy();
    expect(sessionStore.getState().status).toBe("idle");
  });

  it("shows a calm loading state until the quick-start corpus is ready", async () => {
    mockRoute.corpusReady = false;
    const view = render(<PracticePage />);
    expect(screen.getByRole("status").textContent).toContain("Preparing your practice session");
    expect(sessionStore.getState().status).toBe("idle");

    mockRoute.corpusReady = true;
    view.rerender(<PracticePage />);
    await waitFor(() => expect(sessionStore.getState().status).toBe("active"));
  });

  it("starts the first diagnostic without waiting for the word corpus", async () => {
    mockRoute.loaderData.isFirstSession = true;
    mockRoute.corpusReady = false;
    render(<PracticePage />);
    await waitFor(() => expect(sessionStore.getState().status).toBe("active"));
    expect(sessionStore.getState().target.length).toBeGreaterThan(0);
  });
});
