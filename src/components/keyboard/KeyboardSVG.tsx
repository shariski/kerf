import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { FingerTable, KeyAssignment } from "#/domain/finger/types";
import type {
  EncoderGeometry,
  FlashStatus,
  KeyboardGeometry,
  KeyGeometry,
} from "./geometry/types";

/**
 * Imperative handle exposed via ref. Callers invoke flash() inside their
 * keypress hot path to paint a 200ms correct/error/hesitation color pulse
 * on a specific key without triggering a React render — this keeps the
 * feedback round-trip under the 16ms budget spec'd in docs/02-architecture.md.
 */
export type KeyboardSVGHandle = {
  flash: (char: string, status: FlashStatus) => void;
};

type Props = {
  geometry: KeyboardGeometry;
  fingerTable: FingerTable;
  /** Char to render with amber "target" fill (e.g. the next expected key). */
  targetKey?: string;
  /** Render left-edge colored finger bars on chars that have a finger assignment. */
  showFingerBars?: boolean;
  /** Making keys focusable + clickable. Used in onboarding for "click this key". */
  onKeyClick?: (char: string) => void;
  /**
   * Per-key heat level for the dashboard heatmap. `char -> 0..4`.
   * Rendered as `data-heat-level` on each key group; CSS owns the
   * color ramp via --color-kerf-heat-* tokens. Keys not in the map
   * default to no heat. When `targetKey` is also set on the same
   * char, the amber target fill takes visual precedence.
   */
  heatLevels?: Record<string, number>;
  /** Optional class merged onto the <svg>. */
  className?: string;
  style?: CSSProperties;
};

const FLASH_DURATION_MS = 200;
const FLASH_CLASSES = [
  "kb-flash-correct",
  "kb-flash-error",
  "kb-flash-hesitation",
] as const;

function fingerColorVar(a: KeyAssignment): string {
  if (a.finger === "thumb") return "var(--color-kerf-finger-thumb)";
  const hand = a.hand === "left" ? "l" : "r";
  return `var(--color-kerf-finger-${hand}-${a.finger})`;
}

function keyTransform(k: KeyGeometry): string {
  if (k.rotate === undefined) return `translate(${k.x}, ${k.y})`;
  if (k.rotateOrigin) {
    const [ox, oy] = k.rotateOrigin;
    return `translate(${k.x}, ${k.y}) rotate(${k.rotate} ${ox} ${oy})`;
  }
  return `translate(${k.x}, ${k.y}) rotate(${k.rotate})`;
}

function encoderTransform(e: EncoderGeometry): string {
  if (e.rotate === undefined) return `translate(${e.x}, ${e.y})`;
  return `translate(${e.x}, ${e.y}) rotate(${e.rotate})`;
}

export const KeyboardSVG = forwardRef<KeyboardSVGHandle, Props>(
  function KeyboardSVG(
    {
      geometry,
      fingerTable,
      targetKey,
      showFingerBars = false,
      onKeyClick,
      heatLevels,
      className,
      style,
    },
    ref,
  ) {
    const keyRefs = useRef(new Map<string, SVGGElement>());

    useImperativeHandle(
      ref,
      () => ({
        flash(char, status) {
          const el = keyRefs.current.get(char);
          if (!el) return;
          const cls = `kb-flash-${status}`;
          for (const c of FLASH_CLASSES) el.classList.remove(c);
          // Force reflow so re-adding the same class re-triggers the animation.
          void el.getBoundingClientRect();
          el.classList.add(cls);
          window.setTimeout(() => el.classList.remove(cls), FLASH_DURATION_MS);
        },
      }),
      [],
    );

    const [vx, vy, vw, vh] = geometry.viewBox;
    const clickable = Boolean(onKeyClick);

    const handleKeyDown = (char: string) => (e: ReactKeyboardEvent<SVGGElement>) => {
      if (!onKeyClick) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onKeyClick(char);
      }
    };

    const renderKey = (k: KeyGeometry) => {
      const isTarget = targetKey !== undefined && k.char === targetKey;
      const assignment = fingerTable[k.char];
      const showBar = showFingerBars && assignment !== undefined;
      const classes = [
        "kb-key",
        isTarget ? "kb-key-target" : "",
        clickable ? "kb-key-clickable" : "",
      ]
        .filter(Boolean)
        .join(" ");

      const heat = heatLevels?.[k.char];
      const heatAttr = typeof heat === "number" && heat > 0 ? heat : undefined;

      return (
        <g
          key={k.char}
          ref={(el) => {
            if (el) keyRefs.current.set(k.char, el);
            else keyRefs.current.delete(k.char);
          }}
          transform={keyTransform(k)}
          data-char={k.char}
          data-heat-level={heatAttr}
          className={classes}
          {...(clickable
            ? {
                role: "button",
                tabIndex: 0,
                "aria-label": `Key ${k.label}`,
                onClick: () => onKeyClick?.(k.char),
                onKeyDown: handleKeyDown(k.char),
              }
            : { role: "presentation" as const })}
        >
          <rect
            className="kb-key-face"
            x={0}
            y={0}
            width={k.width}
            height={k.height}
            rx={4}
          />
          <rect
            className="kb-key-highlight"
            x={3}
            y={3}
            width={k.width - 6}
            height={2}
            rx={1}
          />
          {showBar && assignment && (
            <rect
              className="kb-finger-bar"
              x={0}
              y={1}
              width={3}
              height={k.height - 2}
              rx={1.5}
              style={{ fill: fingerColorVar(assignment) }}
            />
          )}
          <text
            className="kb-key-label"
            x={k.width / 2}
            y={k.height / 2}
          >
            {k.label}
          </text>
        </g>
      );
    };

    const renderEncoder = (e: EncoderGeometry) => (
      <g key={e.id} transform={encoderTransform(e)} role="presentation">
        <circle className="kb-encoder-body" cx={e.cx} cy={e.cy} r={e.r} />
        <circle className="kb-encoder-inner" cx={e.cx} cy={e.cy} r={6} />
        <line
          className="kb-encoder-tick"
          x1={e.cx}
          y1={e.cy - e.r + 2}
          x2={e.cx}
          y2={e.cy - e.r + 6}
        />
      </g>
    );

    return (
      <svg
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        xmlns="http://www.w3.org/2000/svg"
        className={["kb-svg", className].filter(Boolean).join(" ")}
        style={style}
        role="img"
        aria-label={`${geometry.layout} keyboard layout`}
        data-layout={geometry.layout}
      >
        {(["left", "right"] as const).map((side) => {
          const half = geometry.halves[side];
          return (
            <g
              key={side}
              transform={`translate(${half.translateX}, ${half.translateY})`}
              data-half={side}
            >
              {half.keys.map(renderKey)}
              {half.encoders?.map(renderEncoder)}
            </g>
          );
        })}
      </svg>
    );
  },
);
