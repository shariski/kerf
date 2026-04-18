/** @vitest-environment jsdom */
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SofleSVG } from "./SofleSVG";
import { Lily58SVG } from "./Lily58SVG";
import { KeyboardSVG, type KeyboardSVGHandle } from "./KeyboardSVG";
import { SOFLE_GEOMETRY } from "./geometry/sofle";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";

afterEach(() => {
  cleanup();
});

describe("SofleSVG", () => {
  it("renders a labeled SVG with 56 keys and 2 encoders", () => {
    const { container } = render(<SofleSVG />);

    const svg = screen.getByRole("img", { name: /sofle keyboard layout/i });
    expect(svg).toBeInstanceOf(SVGSVGElement);
    expect(svg.getAttribute("data-layout")).toBe("sofle");

    const keys = container.querySelectorAll("g.kb-key");
    expect(keys).toHaveLength(56);

    const encoders = container.querySelectorAll(".kb-encoder-body");
    expect(encoders).toHaveLength(2);
  });

  it("highlights the target key only", () => {
    const { container } = render(<SofleSVG targetKey="f" />);

    const targeted = container.querySelectorAll("g.kb-key-target");
    expect(targeted).toHaveLength(1);
    expect(targeted[0]?.getAttribute("data-char")).toBe("f");
  });

  it("omits finger bars by default", () => {
    const { container } = render(<SofleSVG />);
    expect(container.querySelectorAll(".kb-finger-bar")).toHaveLength(0);
  });

  it("renders finger bars only for chars with a finger assignment when showFingerBars is true", () => {
    const { container } = render(<SofleSVG showFingerBars />);
    const bars = container.querySelectorAll(".kb-finger-bar");
    // One bar per assigned char. SOFLE_BASE_LAYER covers every typable key.
    expect(bars.length).toBe(Object.keys(SOFLE_BASE_LAYER).length);
  });

  it("non-interactive by default (no role=button on keys)", () => {
    const { container } = render(<SofleSVG />);
    const buttons = container.querySelectorAll('g.kb-key[role="button"]');
    expect(buttons).toHaveLength(0);
  });

  it("exposes keys as focusable buttons when onKeyClick is provided", () => {
    const onKeyClick = vi.fn();
    const { container } = render(<SofleSVG onKeyClick={onKeyClick} />);

    const aKey = container.querySelector('g.kb-key[data-char="a"]') as SVGGElement;
    expect(aKey.getAttribute("role")).toBe("button");
    expect(aKey.getAttribute("tabindex")).toBe("0");
    expect(aKey.getAttribute("aria-label")).toBe("Key a");

    fireEvent.click(aKey);
    expect(onKeyClick).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("activates keys with Enter and Space", () => {
    const onKeyClick = vi.fn();
    const { container } = render(<SofleSVG onKeyClick={onKeyClick} />);
    const fKey = container.querySelector('g.kb-key[data-char="f"]') as SVGGElement;

    fireEvent.keyDown(fKey, { key: "Enter" });
    fireEvent.keyDown(fKey, { key: " " });
    fireEvent.keyDown(fKey, { key: "Tab" });

    expect(onKeyClick).toHaveBeenCalledTimes(2);
    expect(onKeyClick).toHaveBeenNthCalledWith(1, "f");
    expect(onKeyClick).toHaveBeenNthCalledWith(2, "f");
  });
});

describe("Lily58SVG", () => {
  it("renders Lily58 layout with 56 keys and no encoder", () => {
    const { container } = render(<Lily58SVG />);

    const svg = screen.getByRole("img", { name: /lily58 keyboard layout/i });
    expect(svg.getAttribute("data-layout")).toBe("lily58");

    expect(container.querySelectorAll("g.kb-key")).toHaveLength(56);
    expect(container.querySelectorAll(".kb-encoder-body")).toHaveLength(0);
  });
});

describe("KeyboardSVG imperative flash API", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderSofle = () => {
    const ref = createRef<KeyboardSVGHandle>();
    const { container } = render(
      <KeyboardSVG
        ref={ref}
        geometry={SOFLE_GEOMETRY}
        fingerTable={SOFLE_BASE_LAYER}
      />,
    );
    return { ref, container };
  };

  it("adds a flash class to the matching key and removes it after 200ms", () => {
    const { ref, container } = renderSofle();
    const aKey = container.querySelector('g.kb-key[data-char="a"]') as SVGGElement;

    ref.current!.flash("a", "correct");
    expect(aKey.classList.contains("kb-flash-correct")).toBe(true);

    vi.advanceTimersByTime(199);
    expect(aKey.classList.contains("kb-flash-correct")).toBe(true);

    vi.advanceTimersByTime(1);
    expect(aKey.classList.contains("kb-flash-correct")).toBe(false);
  });

  it("replaces an active flash class rather than stacking", () => {
    const { ref, container } = renderSofle();
    const aKey = container.querySelector('g.kb-key[data-char="a"]') as SVGGElement;

    ref.current!.flash("a", "correct");
    ref.current!.flash("a", "error");

    expect(aKey.classList.contains("kb-flash-correct")).toBe(false);
    expect(aKey.classList.contains("kb-flash-error")).toBe(true);
  });

  it("applies distinct classes for each status", () => {
    const { ref, container } = renderSofle();
    const aKey = container.querySelector('g.kb-key[data-char="a"]') as SVGGElement;

    ref.current!.flash("a", "hesitation");
    expect(aKey.classList.contains("kb-flash-hesitation")).toBe(true);
  });

  it("silently ignores flash calls for unknown chars", () => {
    const { ref } = renderSofle();
    expect(() => ref.current!.flash("ñ", "correct")).not.toThrow();
  });

  it("flashes the canonical space character on the left thumb", () => {
    const { ref, container } = renderSofle();
    const spaceKey = container.querySelector(
      'g.kb-key[data-char=" "]',
    ) as SVGGElement;
    expect(spaceKey).not.toBeNull();

    ref.current!.flash(" ", "correct");
    expect(spaceKey.classList.contains("kb-flash-correct")).toBe(true);
  });
});
