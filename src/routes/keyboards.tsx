import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useState } from "react";
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

/** Display-side metadata per keyboard type. Lives in this file
 * instead of `src/domain` because it's UI-only. */
const KEYBOARD_META: Record<KeyboardType, { name: string; keys: number }> = {
  sofle: { name: "Sofle", keys: 58 },
  lily58: { name: "Lily58", keys: 58 },
};

// --- page -----------------------------------------------------------------

function KeyboardsPage() {
  const { profiles } = Route.useLoaderData();
  const [adding, setAdding] = useState(false);

  const addedTypes = new Set(profiles.map((p) => p.keyboardType));
  const availableTypes = (Object.keys(KEYBOARD_META) as KeyboardType[]).filter(
    (t) => !addedTypes.has(t),
  );
  const canAdd = availableTypes.length > 0;

  return (
    <main className="kerf-keyboards-page">
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
          {canAdd && !adding ? (
            <button
              type="button"
              className="kerf-keyboards-add-btn"
              onClick={() => setAdding(true)}
            >
              <span className="kerf-keyboards-add-btn-icon" aria-hidden>
                +
              </span>
              Add keyboard
            </button>
          ) : null}
        </div>
      </header>

      {adding && canAdd ? (
        <AddProfileForm
          availableTypes={availableTypes}
          defaultHand={profiles[0]?.dominantHand}
          onCancel={() => setAdding(false)}
          onAdded={() => setAdding(false)}
        />
      ) : null}

      <div className="kerf-keyboards-grid">
        {profiles.map((p) => (
          <ProfileCard key={p.id} profile={p} />
        ))}
        {canAdd ? (
          <button
            type="button"
            className="kerf-keyboards-add-card"
            onClick={() => setAdding(true)}
            disabled={adding}
          >
            <span className="kerf-keyboards-add-card-icon" aria-hidden>
              +
            </span>
            <span className="kerf-keyboards-add-card-label">Add keyboard</span>
          </button>
        ) : null}
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
    </main>
  );
}

// --- profile card ---------------------------------------------------------

function ProfileCard({ profile }: { profile: ProfileListEntry }) {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = KEYBOARD_META[profile.keyboardType];

  const handleClick = async () => {
    if (profile.isActive || switching) return;
    setSwitching(true);
    setError(null);
    try {
      await switchActiveProfile({ data: { profileId: profile.id } });
      await router.invalidate();
    } catch (err) {
      setSwitching(false);
      setError(
        err instanceof Error ? err.message : "Could not switch — try again.",
      );
    }
  };

  const label = profile.isActive
    ? `${meta.name} — active profile`
    : `Switch to ${meta.name}`;

  return (
    <article
      className="kerf-keyboards-card"
      data-active={profile.isActive ? "true" : undefined}
      data-switching={switching ? "true" : undefined}
    >
      <button
        type="button"
        className="kerf-keyboards-card-tap"
        onClick={handleClick}
        disabled={profile.isActive || switching}
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
      {switching ? (
        <p className="kerf-keyboards-card-status" role="status">
          Switching…
        </p>
      ) : null}
      {error ? (
        <p
          className="kerf-keyboards-card-status kerf-keyboards-card-status--error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </article>
  );
}

/** Mini keyboard half — 4×6 key grid + thumb cluster. Stylized
 * placeholder, not an accurate layout; the real KeyboardSVG lives on
 * the practice/dashboard pages. Matches the wireframe's
 * `.photo-half` > `.photo-key-grid` / `.photo-thumbs` structure. */
function MiniKeyboardHalf() {
  return (
    <div className="kerf-keyboards-card-photo-half">
      <div className="kerf-keyboards-card-photo-grid">
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="kerf-keyboards-card-photo-key" />
        ))}
      </div>
      <div className="kerf-keyboards-card-photo-thumbs">
        <span className="kerf-keyboards-card-photo-thumb" />
        <span className="kerf-keyboards-card-photo-thumb kerf-keyboards-card-photo-thumb--large" />
      </div>
    </div>
  );
}

// --- add-profile inline form ----------------------------------------------

function AddProfileForm({
  availableTypes,
  defaultHand,
  onCancel,
  onAdded,
}: {
  availableTypes: readonly KeyboardType[];
  defaultHand?: DominantHand;
  onCancel: () => void;
  onAdded: () => void;
}) {
  const router = useRouter();
  const [keyboardType, setKeyboardType] = useState<KeyboardType>(
    availableTypes[0]!,
  );
  const [dominantHand, setDominantHand] = useState<DominantHand>(
    defaultHand ?? "right",
  );
  const [initialLevel, setInitialLevel] = useState<InitialLevel>("first_day");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Duck-typed event — React 19 marks `FormEvent` and `React.FormEvent`
  // as deprecated in favor of the Actions API, but Tanstack Start's
  // server-fn story is easier with a classic onSubmit handler. The only
  // method we call is `preventDefault`, so typing to that minimal shape
  // keeps the code both warning-free and functional.
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
      onAdded();
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Could not add profile.");
    }
  };

  return (
    <form className="kerf-keyboards-add-form" onSubmit={handleSubmit}>
      <header className="kerf-keyboards-add-head">
        <h2 className="kerf-keyboards-add-title">Add a new keyboard</h2>
        <button
          type="button"
          className="kerf-keyboards-add-close"
          onClick={onCancel}
          aria-label="Cancel"
        >
          ✕
        </button>
      </header>

      <fieldset className="kerf-keyboards-add-field">
        <legend className="kerf-keyboards-add-label">Which keyboard?</legend>
        <div className="kerf-keyboards-add-choices">
          {availableTypes.map((t) => (
            <label
              key={t}
              className="kerf-keyboards-add-choice"
              data-selected={keyboardType === t ? "true" : undefined}
            >
              <input
                type="radio"
                name="keyboardType"
                value={t}
                checked={keyboardType === t}
                onChange={() => setKeyboardType(t)}
              />
              <span>{KEYBOARD_META[t].name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="kerf-keyboards-add-field">
        <legend className="kerf-keyboards-add-label">Dominant hand</legend>
        <div className="kerf-keyboards-add-choices">
          {(["left", "right"] as const).map((h) => (
            <label
              key={h}
              className="kerf-keyboards-add-choice"
              data-selected={dominantHand === h ? "true" : undefined}
            >
              <input
                type="radio"
                name="dominantHand"
                value={h}
                checked={dominantHand === h}
                onChange={() => setDominantHand(h)}
              />
              <span>{h}-handed</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="kerf-keyboards-add-field">
        <legend className="kerf-keyboards-add-label">
          How far in are you?
        </legend>
        <div className="kerf-keyboards-add-choices">
          {(
            [
              { value: "first_day", label: "First day" },
              { value: "few_weeks", label: "Few weeks in" },
              { value: "comfortable", label: "Comfortable" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.value}
              className="kerf-keyboards-add-choice"
              data-selected={initialLevel === opt.value ? "true" : undefined}
            >
              <input
                type="radio"
                name="initialLevel"
                value={opt.value}
                checked={initialLevel === opt.value}
                onChange={() => setInitialLevel(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p className="kerf-keyboards-add-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="kerf-keyboards-add-actions">
        <button
          type="submit"
          className="kerf-keyboards-add-submit"
          disabled={submitting}
        >
          {submitting ? "Adding…" : "Add keyboard"}
        </button>
        <button
          type="button"
          className="kerf-keyboards-add-cancel"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
