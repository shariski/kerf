import { and, eq, sql } from "drizzle-orm";
import type { Database } from "#/server/db";
import { coachQuota } from "#/server/db/schema";

/**
 * Daily Coach session limit. Env-overridable so the isolated staging
 * instance can lift the cap for manual testing
 * (COACH_DAILY_LIMIT=999 in /opt/kerf-staging/.env) without changing
 * production defaults. Unset/invalid values fall back to 1.
 */
function readDailyLimit(): number {
  const parsed = Number(process.env.COACH_DAILY_LIMIT);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export const DAILY_COACH_LIMIT = readDailyLimit();

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
