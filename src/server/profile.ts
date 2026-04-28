import { createServerFn } from "@tanstack/react-start";
import { redirect } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { and, count, desc, eq } from "drizzle-orm";
import {
  initialPhaseForLevel,
  type InitialLevel,
  type TransitionPhase,
} from "#/domain/profile/initialPhase";
import { toJourneyCode, type JourneyCode } from "#/domain/adaptive/journey";
import { computeBaseline } from "#/domain/stats/computeBaseline";
import type { ComputedStats, UserBaseline } from "#/domain/stats/types";
import { auth } from "./auth";
import { db } from "./db";
import {
  bigramStats,
  characterStats,
  keyboardProfiles,
  sessions,
  sessionTargets,
} from "./db/schema";

export type KeyboardType = "sofle" | "lily58";
export type DominantHand = "left" | "right";

export type CreateProfileInput = {
  keyboardType: KeyboardType;
  dominantHand: DominantHand;
  initialLevel: InitialLevel;
  fingerAssignment: JourneyCode;
  /**
   * Optional display name (≤30 chars after trim). Empty/whitespace-only
   * inputs become null. Omitting the field on create is equivalent to null.
   */
  nickname?: string | null;
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
    throw new Error("initialLevel must be 'first_day', 'few_weeks', or 'comfortable'");
  }
  return {
    keyboardType: i.keyboardType,
    dominantHand: i.dominantHand,
    initialLevel: i.initialLevel,
    fingerAssignment: toJourneyCode(
      typeof i.fingerAssignment === "string" ? i.fingerAssignment : null,
    ),
    nickname: normalizeNickname(i.nickname),
  };
}

/**
 * Trim, drop empty, and cap at 30 chars. Returns null when the input is
 * absent / non-string / whitespace-only — the schema column is nullable
 * and "no nickname" is the default state.
 */
function normalizeNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, 30);
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
          nickname: data.nickname,
          dominantHand: data.dominantHand,
          initialLevel: data.initialLevel,
          transitionPhase: phase,
          fingerAssignment: data.fingerAssignment,
          isActive: true,
        })
        .returning();
      // biome-ignore lint/style/noNonNullAssertion: drizzle .returning() emits exactly one row for a single .insert() of one row.
      return inserted!;
    });
    return row;
  });

// ── update profile (nickname + dominant hand) ────────────────────────────────

export type UpdateProfileInput = {
  profileId: string;
  /** When omitted, field is left unchanged. `null` clears the nickname. */
  nickname?: string | null;
  dominantHand?: DominantHand;
};

export function validateUpdateProfileInput(input: unknown): UpdateProfileInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("update profile input must be an object");
  }
  const i = input as Record<string, unknown>;
  if (typeof i.profileId !== "string" || i.profileId.length === 0) {
    throw new Error("profileId is required");
  }
  const out: UpdateProfileInput = { profileId: i.profileId };
  if ("nickname" in i) {
    // Reuse the same trim/cap rules as create. Whitespace-only or empty
    // string clears the nickname; anything else is trimmed to ≤30 chars.
    if (i.nickname === null) {
      out.nickname = null;
    } else if (typeof i.nickname === "string") {
      const trimmed = i.nickname.trim();
      out.nickname = trimmed.length === 0 ? null : trimmed.slice(0, 30);
    } else {
      throw new Error("nickname must be a string or null");
    }
  }
  if ("dominantHand" in i) {
    if (i.dominantHand !== "left" && i.dominantHand !== "right") {
      throw new Error("dominantHand must be 'left' or 'right'");
    }
    out.dominantHand = i.dominantHand;
  }
  return out;
}

export const updateKeyboardProfile = createServerFn({ method: "POST" })
  .inputValidator(validateUpdateProfileInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    // Build the SET clause from only the provided fields. Drizzle treats
    // an empty object update as a no-op; if neither field was supplied,
    // skip the round-trip entirely.
    const patch: Partial<typeof keyboardProfiles.$inferInsert> = {};
    if ("nickname" in data) patch.nickname = data.nickname ?? null;
    if (data.dominantHand !== undefined) patch.dominantHand = data.dominantHand;
    if (Object.keys(patch).length === 0) return { ok: true as const };

    // Scope the update by user id so a forged profileId can't touch
    // another user's row.
    await db
      .update(keyboardProfiles)
      .set(patch)
      .where(
        and(eq(keyboardProfiles.id, data.profileId), eq(keyboardProfiles.userId, session.user.id)),
      );
    return { ok: true as const };
  });

export const getActiveProfile = createServerFn({ method: "GET" }).handler(async () => {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;

  const rows = await db
    .select()
    .from(keyboardProfiles)
    .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
    .limit(1);
  return rows[0] ?? null;
});

/**
 * Count completed sessions on the active profile. Drives two things:
 *
 *  - Zero-data gate on `/practice` and `/` (count === 0 → curated
 *    first-session exercise / welcome state, previously served by
 *    `hasAnySessionOnActiveProfile`).
 *  - The periodic re-baseline in `selectTarget` — every
 *    `DIAGNOSTIC_PERIOD` sessions the engine forces a diagnostic.
 *    The loader passes `count + 1` as the upcoming session number.
 *
 * Returns 0 when there is no authenticated user or no active profile
 * (conflating the two cases is deliberate — both surface the
 * zero-data UI; callers that need finer-grained errors should check
 * upstream).
 */
export const getCompletedSessionCountOnActiveProfile = createServerFn({
  method: "GET",
}).handler(async (): Promise<number> => {
  const request = getRequest();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return 0;

  const [profile] = await db
    .select({ id: keyboardProfiles.id })
    .from(keyboardProfiles)
    .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
    .limit(1);
  if (!profile) return 0;

  const [row] = await db
    .select({ n: count() })
    .from(sessions)
    .where(and(eq(sessions.userId, session.user.id), eq(sessions.keyboardProfileId, profile.id)));
  return row?.n ?? 0;
});

/**
 * Return the target values from the N most recent sessions on the active
 * profile, newest first. Drives the same-target cooldown in
 * `selectTarget` — if the last `COOLDOWN_RUN_LENGTH - 1` entries are
 * all equal, that target is excluded from this session's ranking so
 * the engine rotates instead of clinging to a single overwhelming
 * weakness indefinitely.
 *
 * Joins `sessions` → `session_targets` because only engine-selected
 * sessions (adaptive mode) have a `session_targets` row; drill mode
 * sessions have a `sessions` row but no `session_targets` entry. That
 * means only adaptive targets count toward the cooldown — which is
 * exactly what we want: a user doing drills on `;` shouldn't prevent
 * the engine from adaptively picking `;`-related targets (though the
 * char-support filter already prevents that specifically).
 *
 * Returns an empty array when unauthenticated, no active profile, or
 * no recent sessions exist. The `limit` parameter is hard-capped at
 * `COOLDOWN_RUN_LENGTH - 1` at the call site; this function is
 * deliberately not aware of that constant so it stays general.
 */
export type RecentTargetsInput = { limit: number };

export function validateRecentTargetsInput(input: unknown): RecentTargetsInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("recentTargets: input must be an object");
  }
  const i = input as Record<string, unknown>;
  if (typeof i.limit !== "number" || i.limit < 1 || i.limit > 50) {
    throw new Error("recentTargets: limit must be a number in [1, 50]");
  }
  return { limit: Math.floor(i.limit) };
}

export const getRecentSessionTargetsOnActiveProfile = createServerFn({
  method: "GET",
})
  .inputValidator(validateRecentTargetsInput)
  .handler(async ({ data }): Promise<string[]> => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return [];

    const [profile] = await db
      .select({ id: keyboardProfiles.id })
      .from(keyboardProfiles)
      .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
      .limit(1);
    if (!profile) return [];

    const rows = await db
      .select({ targetValue: sessionTargets.targetValue, endedAt: sessions.endedAt })
      .from(sessionTargets)
      .innerJoin(sessions, eq(sessionTargets.sessionId, sessions.id))
      .where(and(eq(sessions.userId, session.user.id), eq(sessions.keyboardProfileId, profile.id)))
      .orderBy(desc(sessions.endedAt))
      .limit(data.limit);

    return rows.map((r) => r.targetValue);
  });

export type UpdateTransitionPhaseInput = { phase: TransitionPhase };

export function validateUpdateTransitionPhaseInput(input: unknown): UpdateTransitionPhaseInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("updateTransitionPhase: input must be an object");
  }
  const i = input as Record<string, unknown>;
  if (i.phase !== "transitioning" && i.phase !== "refining") {
    throw new Error("updateTransitionPhase: phase must be 'transitioning' or 'refining'");
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
      .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
      .returning({
        id: keyboardProfiles.id,
        transitionPhase: keyboardProfiles.transitionPhase,
      });

    if (!updated) {
      throw new Error("updateTransitionPhase: no active profile");
    }
    return updated;
  });

// --- finger assignment update (ADR-003 §2) ----------------------------------

export type UpdateFingerAssignmentInput = { journey: JourneyCode };

export function validateUpdateFingerAssignmentInput(input: unknown): UpdateFingerAssignmentInput {
  if (typeof input !== "object" || input === null) {
    throw new Error("updateFingerAssignment: input must be an object");
  }
  const i = input as Record<string, unknown>;
  return {
    journey: toJourneyCode(typeof i.journey === "string" ? i.journey : null),
  };
}

export const updateFingerAssignment = createServerFn({ method: "POST" })
  .inputValidator(validateUpdateFingerAssignmentInput)
  .handler(async ({ data }) => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) throw redirect({ to: "/login" });

    const [updated] = await db
      .update(keyboardProfiles)
      .set({ fingerAssignment: data.journey })
      .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
      .returning({ id: keyboardProfiles.id, fingerAssignment: keyboardProfiles.fingerAssignment });

    if (!updated) {
      throw new Error("updateFingerAssignment: no active profile");
    }
    return updated;
  });

// --- multi-keyboard switcher (Task 3.5) ------------------------------------

export type ProfileListEntry = {
  id: string;
  keyboardType: KeyboardType;
  nickname: string | null;
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
        nickname: r.nickname,
        dominantHand: r.dominantHand as DominantHand,
        initialLevel: r.initialLevel as InitialLevel,
        transitionPhase: r.transitionPhase as TransitionPhase,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      }));
  },
);

export type SwitchActiveProfileInput = { profileId: string };

export function validateSwitchActiveProfileInput(input: unknown): SwitchActiveProfileInput {
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

// --- engine stats + baseline loader (ADR-003 Task 17) ----------------------

export type EngineStatsAndBaseline = {
  stats: ComputedStats;
  baseline: UserBaseline;
  phase: TransitionPhase;
};

/**
 * Load the character_stats and bigram_stats rows for the active profile,
 * compute the empirical baseline, and return the triple consumed by
 * `generateSession`. Returns null when unauthenticated or when no active
 * profile exists (loader will redirect in both cases).
 */
export const getEngineStatsAndBaseline = createServerFn({ method: "GET" }).handler(
  async (): Promise<EngineStatsAndBaseline | null> => {
    const request = getRequest();
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return null;

    const [profile] = await db
      .select()
      .from(keyboardProfiles)
      .where(and(eq(keyboardProfiles.userId, session.user.id), eq(keyboardProfiles.isActive, true)))
      .limit(1);
    if (!profile) return null;

    const [charRows, bigramRows] = await Promise.all([
      db
        .select()
        .from(characterStats)
        .where(
          and(
            eq(characterStats.userId, session.user.id),
            eq(characterStats.keyboardProfileId, profile.id),
          ),
        ),
      db
        .select()
        .from(bigramStats)
        .where(
          and(
            eq(bigramStats.userId, session.user.id),
            eq(bigramStats.keyboardProfileId, profile.id),
          ),
        ),
    ]);

    const stats: ComputedStats = {
      characters: charRows.map((r) => ({
        character: r.character,
        attempts: r.totalAttempts,
        errors: r.totalErrors,
        sumTime: r.sumKeystrokeMs,
        hesitationCount: r.hesitationCount,
      })),
      bigrams: bigramRows.map((r) => ({
        bigram: r.bigram,
        attempts: r.totalAttempts,
        errors: r.totalErrors,
        sumTime: r.sumKeystrokeMs,
      })),
    };

    const journey = toJourneyCode(profile.fingerAssignment ?? null);
    const phase = profile.transitionPhase as TransitionPhase;
    const baseline = computeBaseline(stats, phase, journey);

    return { stats, baseline, phase };
  },
);
