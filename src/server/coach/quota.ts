import { and, eq, sql } from "drizzle-orm";
import type { Database } from "#/server/db";
import { coachQuota } from "#/server/db/schema";

/**
 * Daily Coach session limit. Env-overridable so the isolated staging
 * instance can lift the cap for manual testing
 * (COACH_DAILY_LIMIT=999 in /opt/kerf-staging/.env) without changing
 * production defaults. Unset/invalid values fall back to 5.
 */
function readDailyLimit(): number {
  const parsed = Number(process.env.COACH_DAILY_LIMIT);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 5;
}

export const DAILY_COACH_LIMIT = readDailyLimit();

function readGenerationLimit(): number {
  const raw = process.env.COACH_DAILY_GENERATION_LIMIT;
  if (raw === undefined || raw === "") return 30;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 30;
}

export const DAILY_GENERATION_LIMIT = readGenerationLimit();

export function utcDateString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function coachQuotaUsed(tx: Database, userId: string, date: string): Promise<number> {
  const [row] = await tx
    .select({ sessionsUsed: coachQuota.sessionsUsed })
    .from(coachQuota)
    .where(and(eq(coachQuota.userId, userId), eq(coachQuota.date, date)));
  return row?.sessionsUsed ?? 0;
}

export async function lastCoachPassageId(
  tx: Database,
  userId: string,
  date: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ passageId: coachQuota.lastPassageId })
    .from(coachQuota)
    .where(and(eq(coachQuota.userId, userId), eq(coachQuota.date, date)));
  return row?.passageId ?? null;
}

export async function recordLastCoachPassage(
  tx: Database,
  userId: string,
  date: string,
  passageId: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE coach_quota SET last_passage_id = ${passageId}
    WHERE user_id = ${userId} AND date = ${date}
  `);
}

/** Count a logical LLM call before contacting the model. HTTP retries share it. */
export async function claimCoachGenerationBudget(
  tx: Database,
  date: string,
  limit: number = DAILY_GENERATION_LIMIT,
): Promise<boolean> {
  if (limit === 0) return false;
  const rows = await tx.execute(sql`
    INSERT INTO coach_generation_budget (date, attempts_used)
    VALUES (${date}, 1)
    ON CONFLICT (date) DO UPDATE
      SET attempts_used = coach_generation_budget.attempts_used + 1
      WHERE coach_generation_budget.attempts_used < ${limit}
    RETURNING attempts_used
  `);
  return rows.length > 0;
}

/**
 * Atomically claim one quota slot for (userId, date). A single conditional
 * upsert returns a row only when the slot was available, so two concurrent
 * fetches can never both claim the last slot (the previous read-then-
 * increment pattern had a TOCTOU window). Returns false when the limit is
 * already reached.
 */
export async function claimCoachQuota(
  tx: Database,
  userId: string,
  date: string,
  limit: number = DAILY_COACH_LIMIT,
): Promise<boolean> {
  const rows = await tx.execute(sql`
    INSERT INTO coach_quota (user_id, date, sessions_used)
    VALUES (${userId}, ${date}, 1)
    ON CONFLICT (user_id, date) DO UPDATE
      SET sessions_used = coach_quota.sessions_used + 1
      WHERE coach_quota.sessions_used < ${limit}
    RETURNING sessions_used
  `);
  return rows.length > 0;
}

/** Give back a slot when a claimed session could not be prepared. */
export async function releaseCoachQuota(tx: Database, userId: string, date: string): Promise<void> {
  await tx.execute(sql`
    UPDATE coach_quota
    SET sessions_used = sessions_used - 1
    WHERE user_id = ${userId} AND date = ${date} AND sessions_used > 0
  `);
}

export type CoachPrefetch = {
  slot: number;
  targetKey: string;
  passageId: string | null;
  preparing: boolean;
};

/** Only the next unclaimed slot may have one prepared candidate. */
export async function coachPrefetchFor(
  tx: Database,
  userId: string,
  date: string,
): Promise<CoachPrefetch | null> {
  const [row] = await tx
    .select({
      sessionsUsed: coachQuota.sessionsUsed,
      prefetchSlot: coachQuota.prefetchSlot,
      prefetchTargetKey: coachQuota.prefetchTargetKey,
      prefetchPassageId: coachQuota.prefetchPassageId,
      prefetchStartedAt: coachQuota.prefetchStartedAt,
    })
    .from(coachQuota)
    .where(and(eq(coachQuota.userId, userId), eq(coachQuota.date, date)));
  if (!row || row.prefetchSlot !== row.sessionsUsed || !row.prefetchTargetKey) return null;
  return {
    slot: row.sessionsUsed,
    targetKey: row.prefetchTargetKey,
    passageId: row.prefetchPassageId,
    preparing:
      row.prefetchPassageId === null &&
      row.prefetchStartedAt !== null &&
      Date.now() - row.prefetchStartedAt.getTime() < 10 * 60_000,
  };
}

/** Atomically lease generation for one user and next quota slot. */
export async function beginCoachPrefetch(
  tx: Database,
  userId: string,
  date: string,
  token: string,
  targetKey: string,
  limit: number = DAILY_COACH_LIMIT,
): Promise<boolean> {
  const rows = await tx.execute(sql`
    UPDATE coach_quota
    SET prefetch_slot = sessions_used,
        prefetch_token = ${token},
        prefetch_target_key = ${targetKey},
        prefetch_passage_id = NULL,
        prefetch_started_at = now()
    WHERE user_id = ${userId}
      AND date = ${date}
      AND sessions_used < ${limit}
      AND (
        prefetch_slot IS DISTINCT FROM sessions_used
        OR prefetch_target_key IS DISTINCT FROM ${targetKey}
        OR (prefetch_passage_id IS NULL AND prefetch_started_at < now() - interval '10 minutes')
      )
    RETURNING sessions_used
  `);
  return rows.length > 0;
}

export async function finishCoachPrefetch(
  tx: Database,
  userId: string,
  date: string,
  token: string,
  passageId: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE coach_quota
    SET prefetch_passage_id = ${passageId}
    WHERE user_id = ${userId} AND date = ${date} AND prefetch_token = ${token}
  `);
}

export async function clearCoachPrefetch(
  tx: Database,
  userId: string,
  date: string,
  token: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE coach_quota
    SET prefetch_slot = NULL,
        prefetch_token = NULL,
        prefetch_target_key = NULL,
        prefetch_passage_id = NULL,
        prefetch_started_at = NULL
    WHERE user_id = ${userId} AND date = ${date} AND prefetch_token = ${token}
  `);
}

/** Convert a prepared candidate into a charged session, exactly once. */
export async function claimPreparedCoachQuota(
  tx: Database,
  userId: string,
  date: string,
  slot: number,
  passageId: string,
  limit: number = DAILY_COACH_LIMIT,
): Promise<boolean> {
  const rows = await tx.execute(sql`
    UPDATE coach_quota
    SET sessions_used = sessions_used + 1,
        last_passage_id = ${passageId},
        prefetch_slot = NULL,
        prefetch_token = NULL,
        prefetch_target_key = NULL,
        prefetch_passage_id = NULL,
        prefetch_started_at = NULL
    WHERE user_id = ${userId}
      AND date = ${date}
      AND sessions_used = ${slot}
      AND prefetch_slot = ${slot}
      AND prefetch_passage_id = ${passageId}
      AND sessions_used < ${limit}
    RETURNING sessions_used
  `);
  return rows.length > 0;
}
