import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import {
  initialPhaseForLevel,
  type InitialLevel,
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
