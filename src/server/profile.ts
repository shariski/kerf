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
import { keyboardProfiles } from "./db/schema";

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
    const [row] = await db
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
