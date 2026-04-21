import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import {
  initialPhaseForLevel,
  type InitialLevel,
  type TransitionPhase,
} from "#/domain/profile/initialPhase";
import { auth } from "./auth";
import { db } from "./db";
import { keyboardProfiles, sessions } from "./db/schema";

export type KeyboardType = "sofle" | "lily58";
export type DominantHand = "left" | "right";

export type CreateProfileInput = {
  keyboardType: KeyboardType;
  dominantHand: DominantHand;
  initialLevel: InitialLevel;
};

export function validateCreateProfileInput(input: unknown): CreateProfileInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("profile input must be an object");
  }
  const i = input as Record<string, unknown>;
  if (i.keyboardType !== "sofle" && i.keyboardType !== "lily58") {
    throw new Error("keyboardType must be 'sofle' or 'lily58'");
  }
  if (i.dominantHand !== "left" && i.dominantHand !== "right") {
    throw new Error("dominantHand must be 'left' or 'right'");
  }
  if (
    i.initialLevel !== "first_day" &&
    i.initialLevel !== "few_weeks" &&
    i.initialLevel !== "comfortable"
  ) {
    throw new Error(
      "initialLevel must be 'first_day', 'few_weeks', or 'comfortable'",
    );
  }
  return {
    keyboardType: i.keyboardType,
    dominantHand: i.dominantHand,
    initialLevel: i.initialLevel,
  };
}

export const createKeyboardProfile = createServerFn({ method: "POST" })
  .inputValidator(validateCreateProfileInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    const phase = initialPhaseForLevel(data.initialLevel);
    // Task 3.5 — when a user adds a second (or later) profile, the
    // new one becomes active and any existing profiles get deactivated.
    // Wrapped in a transaction because the dashboard queries assume
    // exactly one active profile per user; a crash between the two
    // updates would leave the user in a split state that the UI can't
    // render coherently.
    const row = await db.transaction(async (tx) => {
      await tx
        .update(keyboardProfiles)
        .set({ isActive: false })
        .where(eq(keyboardProfiles.userId, session.user.id));

      const [inserted] = await tx
        .insert(keyboardProfiles)
        .values({
          userId: session.user.id,
          keyboardType: data.keyboardType,
          dominantHand: data.dominantHand,
          initialLevel: data.initialLevel,
          transitionPhase: phase,
          isActive: true,
        })
        .returning();
      return inserted!;
    });
    return row;
  });

export const getActiveProfile = createServerFn({ method: "GET" }).handler(
  async () => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;

    const rows = await db
      .select()
      .from(keyboardProfiles)
      .where(
        and(
          eq(keyboardProfiles.userId, session.user.id),
          eq(keyboardProfiles.isActive, true),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  },
);


/**
 * Cheap "does this profile have any session at all" check — drives
 * the zero-data gate on `/practice` (use curated first-session
 * exercise instead of adaptive sampling) and on `/` (show welcome
 * state instead of the returning-user lobby).
 *
 * Returns false when there is no authenticated user or no active
 * profile. Callers that need a different error surface should check
 * those upstream themselves; conflating "no user" with "first
 * session" was a deliberate simplification — both cases want the
 * zero-data UI.
 */
export const hasAnySessionOnActiveProfile = createServerFn({
  method: "GET",
}).handler(async () => {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return false;

  const [profile] = await db
    .select({ id: keyboardProfiles.id })
    .from(keyboardProfiles)
    .where(
      and(
        eq(keyboardProfiles.userId, session.user.id),
        eq(keyboardProfiles.isActive, true),
      ),
    )
    .limit(1);
  if (!profile) return false;

  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, session.user.id),
        eq(sessions.keyboardProfileId, profile.id),
      ),
    )
    .limit(1);
  return row !== undefined;
});

export type UpdateTransitionPhaseInput = { phase: TransitionPhase };

export function validateUpdateTransitionPhaseInput(
  input: unknown,
): UpdateTransitionPhaseInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("updateTransitionPhase: input must be an object");
  }
  const i = input as Record<string, unknown>;
  if (i.phase !== "transitioning" && i.phase !== "refining") {
    throw new Error(
      "updateTransitionPhase: phase must be 'transitioning' or 'refining'",
    );
  }
  return { phase: i.phase };
}

/**
 * Apply a phase switch initiated by the user via the dashboard
 * suggestion banner (Task 3.4a).
 *
 * The banner surfaces `phaseSuggestion.ts`'s advisory; this function
 * is the only write path — the engine never mutates the profile on its
 * own (per 02-architecture.md §4.6: "suggests phase changes but does
 * not enforce them"). Updates `phase_changed_at` so the dashboard can
 * later distinguish "user switched" from "engine default" when the
 * analytics need it.
 */
export const updateTransitionPhase = createServerFn({ method: "POST" })
  .inputValidator(validateUpdateTransitionPhaseInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    const [updated] = await db
      .update(keyboardProfiles)
      .set({ transitionPhase: data.phase, phaseChangedAt: new Date() })
      .where(
        and(
          eq(keyboardProfiles.userId, session.user.id),
          eq(keyboardProfiles.isActive, true),
        ),
      )
      .returning({
        id: keyboardProfiles.id,
        transitionPhase: keyboardProfiles.transitionPhase,
      });

    if (!updated) {
      throw new Error("updateTransitionPhase: no active profile");
    }
    return updated;
  });

// --- multi-keyboard switcher (Task 3.5) ------------------------------------

export type ProfileListEntry = {
  id: string;
  keyboardType: KeyboardType;
  dominantHand: DominantHand;
  initialLevel: InitialLevel;
  transitionPhase: TransitionPhase;
  isActive: boolean;
  createdAt: string;
};

/**
 * List every keyboard profile belonging to the current user, newest
 * first. Drives the `/keyboards` page's card grid — the UI uses
 * `isActive` to render the active-badge and `keyboardType` to
 * decide which profiles are still addable (a user can have at most
 * one Sofle + one Lily58 in Phase A).
 */
export const listKeyboardProfiles = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProfileListEntry[]> => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return [];

    const rows = await db
      .select()
      .from(keyboardProfiles)
      .where(eq(keyboardProfiles.userId, session.user.id));

    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({
        id: r.id,
        keyboardType: r.keyboardType as KeyboardType,
        dominantHand: r.dominantHand as DominantHand,
        initialLevel: r.initialLevel as InitialLevel,
        transitionPhase: r.transitionPhase as TransitionPhase,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      }));
  },
);

export type SwitchActiveProfileInput = { profileId: string };

export function validateSwitchActiveProfileInput(
  input: unknown,
): SwitchActiveProfileInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("switchActiveProfile: input must be an object");
  }
  const i = input as Record<string, unknown>;
  if (typeof i.profileId !== "string" || i.profileId.length === 0) {
    throw new Error("switchActiveProfile: profileId must be a non-empty string");
  }
  return { profileId: i.profileId };
}

/**
 * Activate a different profile for the current user and deactivate
 * every other one. Transactional because the dashboard assumes
 * exactly one active profile at all times — a partial write
 * (target activated but previous not deactivated, or vice versa)
 * would leave queries that filter by `isActive` returning ambiguous
 * results.
 *
 * Guards against activating another user's profile id (would fail
 * silently as a no-op UPDATE otherwise) by scoping the activation
 * UPDATE to `userId` as well as `id`.
 */
export const switchActiveProfile = createServerFn({ method: "POST" })
  .inputValidator(validateSwitchActiveProfileInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    return await db.transaction(async (tx) => {
      await tx
        .update(keyboardProfiles)
        .set({ isActive: false })
        .where(eq(keyboardProfiles.userId, session.user.id));

      const [activated] = await tx
        .update(keyboardProfiles)
        .set({ isActive: true })
        .where(
          and(
            eq(keyboardProfiles.userId, session.user.id),
            eq(keyboardProfiles.id, data.profileId),
          ),
        )
        .returning({
          id: keyboardProfiles.id,
          keyboardType: keyboardProfiles.keyboardType,
        });

      if (!activated) {
        // Target didn't belong to this user, or didn't exist. Abort
        // the transaction — we've already deactivated everything,
        // which would leave the user with no active profile.
        throw new Error("switchActiveProfile: profile not found");
      }
      return activated;
    });
  });
