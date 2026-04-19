import type { DashboardHeatmapData } from "#/server/dashboard";
import { SofleSVG } from "#/components/keyboard/SofleSVG";
import { Lily58SVG } from "#/components/keyboard/Lily58SVG";

/**
 * Dashboard Section 3 — per-key error-rate heatmap overlaid on the
 * real visual keyboard SVG (not the wireframe's simplified grid).
 *
 * Per task-breakdown §3.2: "Per-key error rate overlay on visual
 * keyboard SVG". Reusing the same SVG the practice page uses keeps
 * key positions, sizing, and finger context identical — users can
 * pattern-match their weaknesses directly against the layout they
 * type on.
 *
 * The color ramp goes amber → red so "bad" keys pop. We intentionally
 * don't mark "good" keys (low error rate) as green — the dashboard is
 * about identifying what to work on, not rewarding what's already
 * fine.
 */

type Props = { data: DashboardHeatmapData };

export function Heatmap({ data }: Props) {
  const KeyboardComponent =
    data.keyboardType === "lily58" ? Lily58SVG : SofleSVG;

  return (
    <div className="kerf-dash-heatmap">
      <div className="kerf-dash-heatmap-svg-wrap">
        <KeyboardComponent heatLevels={data.heatByChar} />
      </div>
      <Legend />
      <Caption data={data} />
    </div>
  );
}

// --- legend ---------------------------------------------------------------

function Legend() {
  return (
    <div className="kerf-dash-heatmap-legend">
      <span>clean</span>
      <div className="kerf-dash-heatmap-scale">
        {[1, 2, 3, 4].map((lvl) => (
          <span
            key={lvl}
            className="kerf-dash-heatmap-swatch"
            data-heat-level={lvl}
            aria-hidden="true"
          />
        ))}
      </div>
      <span>heavy errors</span>
    </div>
  );
}

// --- caption (accuracy caveats per product-spec §5.4) --------------------

function Caption({ data }: { data: DashboardHeatmapData }) {
  if (data.measuredCount === 0) {
    return (
      <p className="kerf-dash-heatmap-caption">
        No keys have enough attempts yet to read a signal. Color fills in as
        you practice.
      </p>
    );
  }
  const plural = data.measuredCount === 1 ? "" : "s";
  return (
    <p className="kerf-dash-heatmap-caption">
      Error rate per key across {data.measuredCount} measured letter{plural}
      {data.hottest.length > 0 ? (
        <>
          {" "}— currently heaviest on <HottestKeys chars={data.hottest} />.
        </>
      ) : (
        <>. No keys are currently above the threshold — nice form.</>
      )}
    </p>
  );
}

function HottestKeys({ chars }: { chars: readonly string[] }) {
  return (
    <>
      {chars.map((c, i) => (
        <span key={c}>
          {i > 0 ? ", " : null}
          <strong>{c.toUpperCase()}</strong>
        </span>
      ))}
    </>
  );
}
