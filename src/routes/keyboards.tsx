import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAuthSession } from "#/lib/require-auth";
import {
  createKeyboardProfile,
  listKeyboardProfiles,
  switchActiveProfile,
  type DominantHand,
  type KeyboardType,
  type ProfileListEntry,
} from "#/server/profile";
import type { InitialLevel } from "#/domain/profile/initialPhase";

/**
 * `/keyboards` — profile management for multi-keyboard users
 * (Task 3.5). Ported 1:1 from `design/keyboards-wireframe.html`.
 *
 * §B2 — every query downstream of this page assumes exactly one
 * active profile per user. Switch + add both run inside Postgres
 * transactions on the server so the dashboard can't observe a torn
 * "zero or two active" state. See `profile.ts`.
 *
 * Switch lock — all profile clicks are gated on a single page-level
 * lock that's held while a switch is in flight AND while the undo
 * toast is visible. Without it, rapid clicks race on a stale
 * `previousActive` and the undo ends up reverting to the wrong
 * profile. The lock also removes the "Switching…" flash that
 * caused the glitchy feel — server calls in dev are fast enough
 * that the brief disabled state is barely perceptible, which is
 * what we want.
 */

export const Route = createFileRoute("/keyboards")({
  beforeLoad: async () => {
    const session = await getAuthSession();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: async () => {
    const profiles = await listKeyboardProfiles();
    return { profiles };
  },
  component: KeyboardsPage,
});

// --- keyboard metadata ----------------------------------------------------

const KEYBOARD_META: Record<KeyboardType, { name: string; keys: number }> = {
  sofle: { name: "Sofle", keys: 58 },
  lily58: { name: "Lily58", keys: 58 },
};

const LEVEL_META: Record<
  InitialLevel,
  { level: string; name: string }
> = {
  first_day: { level: "level 1", name: "First day" },
  few_weeks: { level: "level 2", name: "Few weeks in" },
  comfortable: { level: "level 3", name: "Comfortable" },
};

// --- page -----------------------------------------------------------------

type SwitchToast = {
  toName: string;
  fromId: string;
};

function KeyboardsPage() {
  const { profiles } = Route.useLoaderData();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<SwitchToast | null>(null);
  const [switchInFlight, setSwitchInFlight] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  const currentlyActive = profiles.find((p) => p.isActive);
  // Locked while: (a) a server call is in flight, or (b) the 5s
  // undo window is still open. (b) is the real fix for the
  // rapid-click race — if we let new switches through while the
  // toast was visible, the Undo's `fromId` would point to whatever
  // was active *before* the first of several queued switches,
  // which is rarely what the user expects.
  const locked = switchInFlight || toast !== null;

  const handleSwitch = async (target: ProfileListEntry) => {
    if (locked || target.isActive || !currentlyActive) return;
    setSwitchInFlight(true);
    setSwitchError(null);
    try {
      await switchActiveProfile({ data: { profileId: target.id } });
      await router.invalidate();
      setToast({
        toName: KEYBOARD_META[target.keyboardType].name,
        fromId: currentlyActive.id,
      });
    } catch (err) {
      setSwitchError(
        err instanceof Error ? err.message : "Could not switch — try again.",
      );
    } finally {
      setSwitchInFlight(false);
    }
  };

  const handleUndo = async () => {
    if (!toast) return;
    setSwitchInFlight(true);
    try {
      await switchActiveProfile({ data: { profileId: toast.fromId } });
      await router.invalidate();
      setToast(null);
    } catch {
      // Keep the toast visible on undo failure so the user can retry.
    } finally {
      setSwitchInFlight(false);
    }
  };

  return (
    <main id="main-content" className="kerf-keyboards-page">
      <header className="kerf-keyboards-header">
        <div className="kerf-keyboards-breadcrumb">Manage profiles</div>
        <div className="kerf-keyboards-title-row">
          <div>
            <h1 className="kerf-keyboards-title">Your keyboards</h1>
            <p className="kerf-keyboards-subtitle">
              Each keyboard is a separate journey — stats, weakness ranking,
              and exercises are independent per profile.
            </p>
          </div>
          <button
            type="button"
            className="kerf-keyboards-add-btn"
            onClick={() => setAddOpen(true)}
          >
            <span className="kerf-keyboards-add-btn-icon" aria-hidden>
              +
            </span>
            Add keyboard
          </button>
        </div>
      </header>

      {switchError ? (
        <div className="kerf-keyboards-error" role="alert">
          {switchError}
        </div>
      ) : null}

      <div className="kerf-keyboards-grid" data-locked={locked ? "true" : undefined}>
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            locked={locked}
            onSwitch={() => handleSwitch(p)}
          />
        ))}
        <button
          type="button"
          className="kerf-keyboards-add-card"
          onClick={() => setAddOpen(true)}
        >
          <span className="kerf-keyboards-add-card-icon" aria-hidden>
            +
          </span>
          <span className="kerf-keyboards-add-card-label">Add keyboard</span>
        </button>
      </div>

      {profiles.length === 1 ? (
        <aside className="kerf-keyboards-nudge" role="note">
          <span aria-hidden className="kerf-keyboards-nudge-icon">
            ⊞
          </span>
          <p className="kerf-keyboards-nudge-text">
            <strong>You only have one profile.</strong> Add another keyboard if
            you switch between split layouts — each gets its own independent
            stats and weakness tracking.
          </p>
        </aside>
      ) : null}

      {addOpen ? (
        <AddKeyboardModal
          profiles={profiles}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {toast ? (
        <SwitchToast
          toast={toast}
          undoing={switchInFlight}
          onUndo={handleUndo}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </main>
  );
}

// --- profile card ---------------------------------------------------------

function ProfileCard({
  profile,
  locked,
  onSwitch,
}: {
  profile: ProfileListEntry;
  /** Page-level lock — true while a switch is in flight OR the
   * undo toast is visible. Prevents rapid re-clicks from queueing
   * extra switches. */
  locked: boolean;
  onSwitch: () => void;
}) {
  const meta = KEYBOARD_META[profile.keyboardType];
  const clickable = !profile.isActive && !locked;
  const label = profile.isActive
    ? `${meta.name} — active profile`
    : `Switch to ${meta.name}`;

  return (
    <article
      className="kerf-keyboards-card"
      data-active={profile.isActive ? "true" : undefined}
    >
      <button
        type="button"
        className="kerf-keyboards-card-tap"
        onClick={onSwitch}
        disabled={!clickable}
        aria-label={label}
      >
        <div className="kerf-keyboards-card-visual" aria-hidden>
          {profile.isActive ? (
            <span className="kerf-keyboards-card-active-badge">active</span>
          ) : null}
          <span className="kerf-keyboards-card-menu" aria-hidden>
            ⋯
          </span>
          <div className="kerf-keyboards-card-photo">
            <MiniKeyboardHalf />
            <MiniKeyboardHalf />
          </div>
          <span className="kerf-keyboards-card-photo-label">
            PHOTO PLACEHOLDER
          </span>
        </div>
        <div className="kerf-keyboards-card-body">
          <div className="kerf-keyboards-card-name">{meta.name}</div>
          <div className="kerf-keyboards-card-meta">
            {meta.keys} keys · split columnar
          </div>
        </div>
      </button>
    </article>
  );
}

function MiniKeyboardHalf() {
  return (
    <div className="kerf-keyboards-card-photo-half">
      <div className="kerf-keyboards-card-photo-grid">
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="kerf-keyboards-card-photo-key" />
        ))}
      </div>
      <div className="kerf-keyboards-card-photo-thumbs">
        <div className="kerf-keyboards-card-photo-thumb" />
        <div className="kerf-keyboards-card-photo-thumb kerf-keyboards-card-photo-thumb--large" />
      </div>
    </div>
  );
}

// --- switch-toast (wireframe §.toast) -------------------------------------

const TOAST_TTL_MS = 5000;

function SwitchToast({
  toast,
  undoing,
  onUndo,
  onDismiss,
}: {
  toast: SwitchToast;
  undoing: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (undoing) return;
    const t = window.setTimeout(onDismiss, TOAST_TTL_MS);
    return () => window.clearTimeout(t);
  }, [onDismiss, undoing, toast]);

  return (
    <div
      className="kerf-keyboards-toast"
      role="status"
      aria-live="polite"
    >
      <span className="kerf-keyboards-toast-icon" aria-hidden>
        →
      </span>
      <span className="kerf-keyboards-toast-text">
        Switched to <strong>{toast.toName}</strong>
      </span>
      <button
        type="button"
        className="kerf-keyboards-toast-undo"
        onClick={onUndo}
        disabled={undoing}
      >
        {undoing ? "Undoing…" : "Undo"}
      </button>
      <span className="kerf-keyboards-toast-progress" aria-hidden />
    </div>
  );
}

// --- add-keyboard modal (wireframe §.add-modal) ---------------------------

function AddKeyboardModal({
  profiles,
  onClose,
}: {
  profiles: readonly ProfileListEntry[];
  onClose: () => void;
}) {
  const router = useRouter();
  const addedTypes = new Set(profiles.map((p) => p.keyboardType));
  const allTypes = Object.keys(KEYBOARD_META) as KeyboardType[];
  const defaultType = allTypes.find((t) => !addedTypes.has(t)) ?? allTypes[0]!;
  const prefilledHand = profiles[0]?.dominantHand;

  const [keyboardType, setKeyboardType] = useState<KeyboardType>(defaultType);
  const [dominantHand, setDominantHand] = useState<DominantHand>(
    prefilledHand ?? "right",
  );
  const [editingHand, setEditingHand] = useState(false);
  const [initialLevel, setInitialLevel] = useState<InitialLevel>("first_day");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createKeyboardProfile({
        data: { keyboardType, dominantHand, initialLevel },
      });
      await router.invalidate();
      onClose();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not add profile.");
    }
  };

  const selectedKeyboardName = KEYBOARD_META[keyboardType].name;
  const handInitial = dominantHand === "right" ? "R" : "L";

  return (
    <div
      className="kerf-keyboards-modal-bg"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="kerf-keyboards-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-keyboard-title"
      >
        <form onSubmit={handleSubmit}>
          <header className="kerf-keyboards-modal-head">
            <div>
              <h2 id="add-keyboard-title" className="kerf-keyboards-modal-title">
                Add a new keyboard
              </h2>
              {prefilledHand ? (
                <p className="kerf-keyboards-modal-hint">
                  dominant hand prefilled from your existing profile ·{" "}
                  <strong>{prefilledHand}-handed</strong>
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="kerf-keyboards-modal-close"
              onClick={onClose}
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          <div className="kerf-keyboards-modal-body">
            <section className="kerf-keyboards-modal-step">
              <div className="kerf-keyboards-modal-step-label">
                <span>which keyboard?</span>
              </div>
              <div className="kerf-keyboards-mini-cards">
                {allTypes.map((t) => {
                  const already = addedTypes.has(t);
                  const selected = keyboardType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      className="kerf-keyboards-mini-card"
                      data-selected={selected ? "true" : undefined}
                      onClick={() => setKeyboardType(t)}
                    >
                      <span className="kerf-keyboards-mini-card-thumb">
                        ⊞⊞
                      </span>
                      <span className="kerf-keyboards-mini-card-info">
                        <span className="kerf-keyboards-mini-card-name">
                          {KEYBOARD_META[t].name}
                        </span>
                        <span className="kerf-keyboards-mini-card-meta">
                          {KEYBOARD_META[t].keys} keys · split columnar
                        </span>
                      </span>
                      <span className="kerf-keyboards-mini-card-status">
                        {selected ? "✓" : already ? "added" : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="kerf-keyboards-modal-step">
              <div className="kerf-keyboards-modal-step-label">
                <span>dominant hand</span>
                {prefilledHand && !editingHand ? (
                  <span className="kerf-keyboards-prefilled-tag">prefilled</span>
                ) : null}
              </div>
              {editingHand || !prefilledHand ? (
                <div className="kerf-keyboards-hand-choices">
                  {(["left", "right"] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className="kerf-keyboards-hand-choice"
                      data-selected={dominantHand === h ? "true" : undefined}
                      onClick={() => {
                        setDominantHand(h);
                        setEditingHand(false);
                      }}
                    >
                      <span className="kerf-keyboards-hand-initial" aria-hidden>
                        {h === "right" ? "R" : "L"}
                      </span>
                      <span>{h === "right" ? "Right-handed" : "Left-handed"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="kerf-keyboards-hand-pill">
                  <span className="kerf-keyboards-hand-pill-label">
                    <span className="kerf-keyboards-hand-initial" aria-hidden>
                      {handInitial}
                    </span>
                    {dominantHand === "right" ? "Right-handed" : "Left-handed"}
                  </span>
                  <button
                    type="button"
                    className="kerf-keyboards-hand-change"
                    onClick={() => setEditingHand(true)}
                  >
                    change
                  </button>
                </div>
              )}
            </section>

            <section className="kerf-keyboards-modal-step">
              <div className="kerf-keyboards-modal-step-label">
                <span>how comfortable on this keyboard?</span>
              </div>
              <div className="kerf-keyboards-level-cards">
                {(Object.keys(LEVEL_META) as InitialLevel[]).map((lvl) => {
                  const selected = initialLevel === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      className="kerf-keyboards-level-card"
                      data-selected={selected ? "true" : undefined}
                      onClick={() => setInitialLevel(lvl)}
                    >
                      <span className="kerf-keyboards-level-card-label">
                        {LEVEL_META[lvl].level}
                      </span>
                      <span className="kerf-keyboards-level-card-name">
                        {LEVEL_META[lvl].name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {error ? (
              <p className="kerf-keyboards-modal-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <footer className="kerf-keyboards-modal-footer">
            <button
              type="button"
              className="kerf-keyboards-modal-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="kerf-keyboards-modal-submit"
              disabled={submitting}
            >
              {submitting ? "Adding…" : `Add ${selectedKeyboardName}`}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
