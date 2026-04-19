import { forwardRef, type CSSProperties } from "react";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { KeyboardSVG, type KeyboardSVGHandle } from "./KeyboardSVG";
import { SOFLE_GEOMETRY } from "./geometry/sofle";

type Props = {
  targetKey?: string;
  showFingerBars?: boolean;
  onKeyClick?: (char: string) => void;
  heatLevels?: Record<string, number>;
  className?: string;
  style?: CSSProperties;
};

export const SofleSVG = forwardRef<KeyboardSVGHandle, Props>(function SofleSVG(
  props,
  ref,
) {
  return (
    <KeyboardSVG
      ref={ref}
      geometry={SOFLE_GEOMETRY}
      fingerTable={SOFLE_BASE_LAYER}
      {...props}
    />
  );
});
