import { createHash } from "node:crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "#/server/db";
import { passages } from "#/server/db/schema";
import type { GateResult } from "#/domain/coach/gate";
import type { MechanismKey } from "#/domain/coach/mechanisms";
import type { LlmOutput } from "./review";

export type PassageRecord = {
  id: string;
  title: string;
  topic: string;
  difficulty: string;
  mechanisms: MechanismKey[];
  triggerTargets: Record<string, number> | null;
  measuredDensity: Record<string, number> | null;
  qualityGate: GateResult;
  text: string;
  wordCount: number;
  paragraphs: number;
  source: string;
  status: string;
  targetKey: string;
  usageCount: number;
  llmOutput?: LlmOutput | null;
  reviewVerdict?: string | null;
  reviewRating?: number | null;
  reviewTags?: string[] | null;
  reviewNote?: string | null;
  reviewedAt?: Date | string | null;
};

export function targetKeyFor(mechanisms: MechanismKey[], difficulty: string): string {
  const canonical = [...mechanisms].sort().join("|");
  return createHash("md5").update(`${canonical}#${difficulty}`).digest("hex");
}

export async function findPassage(
  tx: Database,
  targetKey: string,
  difficulty: string,
): Promise<PassageRecord | null> {
  const rows = await tx
    .select()
    .from(passages)
    .where(
      and(
        eq(passages.targetKey, targetKey),
        eq(passages.difficulty, difficulty),
        eq(passages.status, "active"),
      ),
    )
    .orderBy(asc(passages.usageCount), asc(passages.createdAt))
    .limit(1);
  return (rows[0] as PassageRecord | undefined) ?? null;
}

export async function countActiveForKey(
  tx: Database,
  targetKey: string,
  difficulty: string,
): Promise<number> {
  const rows = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(passages)
    .where(
      and(
        eq(passages.targetKey, targetKey),
        eq(passages.difficulty, difficulty),
        eq(passages.status, "active"),
      ),
    );
  return rows[0]?.count ?? 0;
}

export async function insertPassage(
  tx: Database,
  passage: Omit<PassageRecord, "id" | "usageCount" | "status">,
): Promise<PassageRecord> {
  const [row] = await tx
    .insert(passages)
    .values({
      title: passage.title,
      topic: passage.topic,
      difficulty: passage.difficulty,
      mechanisms: passage.mechanisms,
      triggerTargets: passage.triggerTargets,
      measuredDensity: passage.measuredDensity,
      qualityGate: passage.qualityGate,
      text: passage.text,
      wordCount: passage.wordCount,
      paragraphs: passage.paragraphs,
      source: passage.source,
      targetKey: passage.targetKey,
    })
    .onConflictDoNothing({
      target: [passages.targetKey, passages.topic, passages.difficulty],
    })
    .returning();
  return row as PassageRecord;
}

export async function incrementUsage(tx: Database, passageId: string): Promise<void> {
  await tx
    .update(passages)
    .set({ usageCount: sql`${passages.usageCount} + 1` })
    .where(eq(passages.id, passageId));
}
