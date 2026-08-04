import { createHash } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "#/server/db";
import { passages } from "#/server/db/schema";
import type { GateResult } from "#/domain/coach/gate";
import type { MechanismKey } from "#/domain/coach/mechanisms";

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
};

export function targetKeyFor(mechanisms: MechanismKey[], difficulty: string): string {
  const canonical = [...mechanisms].sort().join("|");
  return createHash("md5").update(`${canonical}#${difficulty}`).digest("hex");
}

export async function findPassage(
  tx: Database,
  targetKey: string,
  topic: string,
  difficulty: string,
): Promise<PassageRecord | null> {
  const rows = await tx
    .select()
    .from(passages)
    .where(
      and(
        eq(passages.targetKey, targetKey),
        eq(passages.topic, topic),
        eq(passages.difficulty, difficulty),
        eq(passages.status, "active"),
      ),
    )
    .limit(1);
  return (rows[0] as PassageRecord | undefined) ?? null;
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
