/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { FieldRow } from "./FieldRow";

afterEach(() => cleanup());

describe("FieldRow", () => {
  it("renders the label name", () => {
    render(
      <FieldRow labelName="Email address">
        <span>control</span>
      </FieldRow>,
    );
    expect(screen.getByText("Email address")).toBeTruthy();
  });

  it("renders the optional label hint when provided", () => {
    render(
      <FieldRow labelName="Email address" labelHint="used for sign-in">
        <span>control</span>
      </FieldRow>,
    );
    expect(screen.getByText("used for sign-in")).toBeTruthy();
  });

  it("does not render a hint slot when labelHint is omitted", () => {
    render(
      <FieldRow labelName="Account created">
        <span>control</span>
      </FieldRow>,
    );
    expect(screen.queryByText(/used for/)).toBeNull();
  });

  it("renders its children in the control slot", () => {
    render(
      <FieldRow labelName="Mode">
        <span data-testid="control-child">pills go here</span>
      </FieldRow>,
    );
    expect(screen.getByTestId("control-child")).toBeTruthy();
  });
});
