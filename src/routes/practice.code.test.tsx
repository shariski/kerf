/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickCodeSnippetForFocus } from "#/domain/codePractice/focus";
import { validateCodeSessionInput } from "#/domain/codePractice/validateSession";

const mock = vi.hoisted(() => {
  const evidence = () => ({
    sessions: 0,
    focuses: {
      symbols: { attempts: 0, errors: 0, hesitations: 0 },
      brackets: { attempts: 0, errors: 0, hesitations: 0 },
      indentation: { attempts: 0, errors: 0, hesitations: 0 },
    },
    chars: {},
  });
  return {
    persist: vi.fn().mockResolvedValue({ saved: true }),
    navigate: vi.fn(),
    search: { language: "python", focus: "indentation", origin: "manual" } as {
      language: string;
      focus?: string;
      origin: string;
    },
    loader: {
      profile: { id: "00000000-0000-4000-8000-000000000001", keyboardType: "sofle" },
      recent: [] as { snippetId: string; language: string }[],
      completedCounts: { javascript: 0, python: 0, html: 0, json: 0 },
      adaptiveByLanguage: {
        javascript: evidence(),
        python: evidence(),
        html: evidence(),
        json: evidence(),
      },
      allCodeEvidence: evidence(),
    },
  };
});

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: object) => ({
    ...config,
    useLoaderData: () => mock.loader,
    useSearch: () => mock.search,
  }),
  useNavigate: () => mock.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a href="/dashboard">{children}</a>,
  redirect: vi.fn(),
}));
vi.mock("#/lib/require-auth", () => ({ getAuthSession: vi.fn() }));
vi.mock("#/server/codePractice", () => ({
  getCodePracticeContext: vi.fn(),
  persistCodePracticeSession: mock.persist,
}));

import { Route } from "./practice_.code";

const CodePracticePage = (Route as unknown as { component: React.ComponentType }).component;

beforeEach(() => {
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mock.search = { language: "python", focus: "indentation", origin: "manual" };
  for (const current of Object.values(mock.loader.adaptiveByLanguage)) {
    current.sessions = 0;
    for (const cell of Object.values(current.focuses)) {
      cell.attempts = 0;
      cell.errors = 0;
      cell.hesitations = 0;
    }
    current.chars = {};
  }
  mock.loader.allCodeEvidence = {
    sessions: 0,
    focuses: {
      symbols: { attempts: 0, errors: 0, hesitations: 0 },
      brackets: { attempts: 0, errors: 0, hesitations: 0 },
      indentation: { attempts: 0, errors: 0, hesitations: 0 },
    },
    chars: {},
  };
  for (const language of Object.keys(mock.loader.completedCounts) as Array<
    keyof typeof mock.loader.completedCounts
  >) {
    mock.loader.completedCounts[language] = 0;
  }
});

describe("Coding practice flow", () => {
  it("restarts the same example with Ctrl+Enter while Tab remains indentation", () => {
    const snippet = pickCodeSnippetForFocus("python", "indentation", [], () => 0);
    const { container } = render(<CodePracticePage />);
    const surface = screen.getByRole("textbox", { name: "Type the code shown here" });
    const typedCount = () =>
      container.querySelectorAll(".kerf-code-typing .kerf-typing-typed").length;
    fireEvent.keyDown(surface, { key: snippet.text[0] });
    expect(typedCount()).toBe(1);
    expect(fireEvent.keyDown(surface, { key: "Tab", shiftKey: true })).toBe(true);
    expect(typedCount()).toBe(1);

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(typedCount()).toBe(0);
    expect(screen.getByRole("region", { name: "Session target" }).textContent).toContain("Python");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Session paused" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(typedCount()).toBe(0);
  });

  it("expands Tab indentation, saves separately, and opens a Coding review", async () => {
    const snippet = pickCodeSnippetForFocus("python", "indentation", [], () => 0);
    render(<CodePracticePage />);
    const surface = screen.getByRole("textbox", { name: "Type the code shown here" });

    // Outside indentation, Tab remains native focus navigation.
    expect(fireEvent.keyDown(surface, { key: "Tab" })).toBe(true);

    let usedTab = false;
    for (let i = 0; i < snippet.text.length; i++) {
      const char = snippet.text[i];
      if (char === "\n") {
        fireEvent.keyDown(surface, { key: "Enter" });
        let next = i + 1;
        while (snippet.text[next] === " ") next++;
        if (next > i + 1) {
          expect(fireEvent.keyDown(surface, { key: "Tab" })).toBe(false);
          usedTab = true;
          i = next - 1;
        }
      } else {
        fireEvent.keyDown(surface, { key: char });
      }
    }

    expect(usedTab).toBe(true);
    await waitFor(() => expect(mock.persist).toHaveBeenCalledTimes(1));
    const payload = mock.persist.mock.calls[0]?.[0]?.data;
    expect(payload?.snippetId).toBe(snippet.id);
    expect(payload?.tabCount).toBeGreaterThan(0);
    expect(
      payload?.events.some(
        (event: { inputMethod: string }) => event.inputMethod === "tabExpansion",
      ),
    ).toBe(true);
    expect(() => validateCodeSessionInput(payload)).not.toThrow();
    expect(payload?.events.filter((event: { isError: boolean }) => !event.isError)).toHaveLength(
      snippet.text.length,
    );
    expect(screen.getByRole("heading", { name: "See what this session revealed." })).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Continue practice/ }).hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(screen.queryByText("Coding session saved.")).toBeNull();
  });

  it("stages language and focus changes until the second Esc", async () => {
    mock.search = { language: "javascript", focus: "brackets", origin: "recommended" };
    render(<CodePracticePage />);
    expect(screen.getByRole("region", { name: "Session target" }).textContent).toContain(
      "JavaScript · Brackets and chaining",
    );
    fireEvent.keyDown(window, { key: "Escape" });
    const dialog = screen.getByRole("dialog", { name: "Session paused" });
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Code language:/ }));
    fireEvent.click(screen.getByRole("option", { name: "Python" }));
    fireEvent.click(screen.getByRole("button", { name: /Focus:/ }));
    fireEvent.click(screen.getByRole("option", { name: "Indentation" }));
    expect(screen.getByRole("region", { name: "Session target" }).textContent).toContain(
      "JavaScript · Brackets and chaining",
    );
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Session target" }).textContent).toContain(
        "Python · Indentation",
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("focuses Resume after changing language so Enter applies the staged choice", async () => {
    mock.search = { language: "javascript", focus: "brackets", origin: "recommended" };
    render(<CodePracticePage />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: /Code language:/ }));
    fireEvent.click(screen.getByRole("option", { name: "Python" }));

    const resume = screen.getByRole("button", { name: /Resume/ });
    expect(document.activeElement).toBe(resume);
    fireEvent.click(resume);
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Session target" }).textContent).toContain(
        "Python",
      ),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("completes and saves a newly added JSON example", async () => {
    mock.search = { language: "json", focus: "brackets", origin: "manual" };
    const snippet = pickCodeSnippetForFocus("json", "brackets", [], () => 0);
    render(<CodePracticePage />);
    const surface = screen.getByRole("textbox", { name: "Type the code shown here" });
    for (const char of snippet.text) {
      fireEvent.keyDown(surface, { key: char === "\n" ? "Enter" : char });
    }
    await waitFor(() => expect(mock.persist).toHaveBeenCalledTimes(1));
    expect(mock.persist.mock.calls[0]?.[0]?.data).toMatchObject({
      corpusVersion: 2,
      snippetId: snippet.id,
    });
    expect(screen.getByRole("region", { name: "Intent recap" }).textContent).toContain(
      "Objects and arrays · JSON",
    );
  });

  it("uses observed Code errors to adapt the next focus after review", async () => {
    mock.search = { language: "json", origin: "recommended" };
    const snippet = pickCodeSnippetForFocus("json", "brackets", [], () => 0);
    render(<CodePracticePage />);
    const surface = screen.getByRole("textbox", { name: "Type the code shown here" });
    let correctedQuotes = 0;
    for (const char of snippet.text) {
      if (char === '"' && correctedQuotes < 3) {
        fireEvent.keyDown(surface, { key: "x" });
        fireEvent.keyDown(surface, { key: "Backspace" });
        correctedQuotes++;
      }
      fireEvent.keyDown(surface, { key: char === "\n" ? "Enter" : char });
    }
    expect(correctedQuotes).toBe(3);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Continue practice/ }).hasAttribute("disabled"),
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: /Continue practice/ }));
    await waitFor(() =>
      expect(screen.getByRole("region", { name: "Session target" }).textContent).toContain(
        "JSON · Quotes and symbols",
      ),
    );
  });
});
