/**
 * Pre-session pill showing which keyboard profile is active, plus a
 * trailing `switch →` link that routes to `/keyboards` (Task 3.5 landed
 * the profile-switcher page, so the affordance is now live — it was a
 * no-op placeholder until that task shipped).
 */

import { Link } from "@tanstack/react-router";
import type { KeyboardType } from "#/server/profile";

type Props = {
  keyboardType: KeyboardType;
};

export function KeyboardContextPill({ keyboardType }: Props) {
  return (
    <div className="kerf-pill">
      <span className="kerf-pill-icon" aria-hidden>
        ⊞
      </span>
      <span className="kerf-pill-state">active</span>
      <span className="kerf-pill-name">{keyboardType}</span>
      <Link to="/keyboards" className="kerf-pill-switch">
        switch →
      </Link>
    </div>
  );
}
