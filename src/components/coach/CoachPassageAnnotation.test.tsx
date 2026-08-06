/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CoachPassageAnnotation } from "./CoachPassageAnnotation";

afterEach(cleanup);

describe("CoachPassageAnnotation", () => {
  it("renders nothing when review mode is off", () => {
    const { container } = render(
      <CoachPassageAnnotation reviewMode={false} saved={false} onSave={vi.fn()} />,
    );
    expect(container.textContent ?? "").toBe("");
  });

  it("disables save until a verdict is chosen, then submits the payload", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CoachPassageAnnotation reviewMode saved={false} onSave={onSave} />);
    const save = screen.getByRole("button", { name: /save verdict/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "good" }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: "good density" }));
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      verdict: "good",
      rating: 4,
      tags: ["good density"],
    });
  });

  it("shows the saved state after annotation", () => {
    render(<CoachPassageAnnotation reviewMode saved onSave={vi.fn()} />);
    expect(screen.getByText(/saved/i)).toBeTruthy();
  });
});
