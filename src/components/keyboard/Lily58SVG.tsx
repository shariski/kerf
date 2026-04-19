import { forwardRef, type CSSProperties } from "react";
import { LILY58_BASE_LAYER } from "#/domain/finger/lily58";
import { KeyboardSVG, type KeyboardSVGHandle } from "./KeyboardSVG";
import { LILY58_GEOMETRY } from "./geometry/lily58";

type Props = {
  targetKey?: string;
  showFingerBars?: boolean;
  onKeyClick?: (char: string) => void;
  heatLevels?: Record<string, number>;
  className?: string;
  style?: CSSProperties;
};

export const Lily58SVG = forwardRef<KeyboardSVGHandle, Props>(function Lily58SVG(
  props,
  ref,
) {
  return (
    <KeyboardSVG
      ref={ref}
      geometry={LILY58_GEOMETRY}
      fingerTable={LILY58_BASE_LAYER}
      {...props}
    />
  );
});
