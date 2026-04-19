/**
 * Collapsible filter panel on the pre-session screen.
 *
 * Exposes:
 *   - hand isolation (feeds generateExercise's filters.handIsolation)
 *   - max word length / difficulty cap (feeds filters.maxWordLength)
 *   - visual keyboard show/hide (UI pref, shared with pause overlay)
 *
 * Kept uncontrolled-vs-controlled explicit: the parent owns state so the
 * same prefs persist across pre-session ↔ active ↔ pause overlay toggles.
 */

import { useState } from "react";
import type { HandIsolation } from "#/domain/adaptive/exerciseGenerator";

/** Max word length options. "all" means no cap (pass undefined to engine). */
export type MaxWordLength = 4 | 6 | 8 | "all";

export type PreSessionFilterValues = {
  handIsolation: HandIsolation;
  maxWordLength: MaxWordLength;
  showKeyboard: boolean;
};

type Props = {
  values: PreSessionFilterValues;
  onChange: (next: PreSessionFilterValues) => void;
};

export function PreSessionFilters({ values, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof PreSessionFilterValues>(
    key: K,
    value: PreSessionFilterValues[K],
  ) => onChange({ ...values, [key]: value });

  return (
    <div className="kerf-pre-filters">
      <button
        type="button"
        className="kerf-pre-filters-header"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="kerf-pre-filters-content"
      >
        <span>Filters &amp; options</span>
        <span
          className="kerf-pre-filters-caret"
          data-open={open || undefined}
          aria-hidden
        >
          ▶
        </span>
      </button>

      {open && (
        <div id="kerf-pre-filters-content" className="kerf-pre-filters-content">
          <FilterRow label="Hand isolation">
            <Pill
              active={values.handIsolation === "either"}
              onClick={() => set("handIsolation", "either")}
            >
              Either
            </Pill>
            <Pill
              active={values.handIsolation === "left"}
              onClick={() => set("handIsolation", "left")}
            >
              Left only
            </Pill>
            <Pill
              active={values.handIsolation === "right"}
              onClick={() => set("handIsolation", "right")}
            >
              Right only
            </Pill>
          </FilterRow>

          <FilterRow label="Max word length">
            {([4, 6, 8, "all"] as const).map((n) => (
              <Pill
                key={String(n)}
                active={values.maxWordLength === n}
                onClick={() => set("maxWordLength", n)}
              >
                {n}
              </Pill>
            ))}
          </FilterRow>

          <FilterRow label="Visual keyboard">
            <Pill
              active={values.showKeyboard}
              onClick={() => set("showKeyboard", true)}
            >
              Show
            </Pill>
            <Pill
              active={!values.showKeyboard}
              onClick={() => set("showKeyboard", false)}
            >
              Hide
            </Pill>
          </FilterRow>
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="kerf-filter-row">
      <span className="kerf-filter-label">{label}</span>
      <div className="kerf-filter-pills">{children}</div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="kerf-filter-pill"
      data-active={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
