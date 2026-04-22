/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { DocPage } from "./DocPage";

afterEach(() => cleanup());

describe("DocPage", () => {
  it("renders the title as the only h1", () => {
    render(
      <DocPage title="How it works">
        <p>body</p>
      </DocPage>,
    );
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]!.textContent).toBe("How it works");
  });

  it("renders children in the body", () => {
    render(
      <DocPage title="FAQ">
        <p>Some body content.</p>
      </DocPage>,
    );
    expect(screen.getByText("Some body content.")).toBeTruthy();
  });

  it("wraps in <main id=main-content> for skip-link target", () => {
    const { container } = render(
      <DocPage title="Privacy">
        <p>body</p>
      </DocPage>,
    );
    const main = container.querySelector("main");
    expect(main?.getAttribute("id")).toBe("main-content");
  });

  it("shows the template banner when isTemplate is true", () => {
    render(
      <DocPage title="Terms" isTemplate>
        <p>body</p>
      </DocPage>,
    );
    expect(screen.getByText(/template/i)).toBeTruthy();
  });

  it("omits the template banner when isTemplate is absent", () => {
    render(
      <DocPage title="How it works">
        <p>body</p>
      </DocPage>,
    );
    expect(screen.queryByText(/This page is a template/i)).toBeNull();
  });

  it("renders lede under the title when provided", () => {
    render(
      <DocPage title="FAQ" lede="Frequently asked questions about kerf.">
        <p>body</p>
      </DocPage>,
    );
    expect(
      screen.getByText("Frequently asked questions about kerf."),
    ).toBeTruthy();
  });
});
