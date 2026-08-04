import { and, eq, sql } from "drizzle-orm";
import type { Database } from "#/server/db";
import { coachQuota } from "#/server/db/schema";

export const DAILY_COACH_LIMIT = 1;

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

export async function incrementQuota(tx: Database, userId: string, date: string): Promise<void> {
  await tx
    .insert(coachQuota)
    .values({ userId, date, sessionsUsed: 1 })
    .onConflictDoUpdate({
      target: [coachQuota.userId, coachQuota.date],
      set: { sessionsUsed: sql`${coachQuota.sessionsUsed} + 1` },
    });
}
