/**
 * Pre-session pill showing which keyboard profile is active.
 *
 * "switch →" is a visual affordance only for now; the profile-switch flow
 * ships with the Settings page (later task). Clicking it no-ops — render
 * the pill without a click handler until that lands.
 */

import type { KeyboardType } from "#/server/profile";

type Props = {
  keyboardType: KeyboardType;
};

export function KeyboardContextPill({ keyboardType }: Props) {
  return (
    <div className="kerf-pill" aria-label={`Active keyboard: ${keyboardType}`}>
      <span className="kerf-pill-icon" aria-hidden>
        ⊞
      </span>
      <span className="kerf-pill-state">active</span>
      <span className="kerf-pill-name">{keyboardType}</span>
    </div>
  );
}
