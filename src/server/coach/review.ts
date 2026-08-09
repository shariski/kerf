import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../auth";
import { db } from "../db";
import { passages } from "../db/schema";
import { CoachError } from "./llm";
import { getPrompts } from "./llm";
import { REVIEW_TAGS } from "#/domain/coach/review";
import type { PassageRecord } from "./catalog";
import type { LlmResponse } from "./llm";

export const annotateCoachPassageSchema = z.object({
  passageId: z.string().uuid(),
  verdict: z.enum(["good", "not_good"]),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.enum(REVIEW_TAGS)).max(5),
  note: z.string().max(500).optional(),
});

/**
 * Human verdict on a generated passage (review mode only). Flips the
 * record to active (good) or retired (not good) and stores the review
 * fields. Flag-gated: on prod (flag unset) this endpoint never exists.
 */
export const annotateCoachPassage = createServerFn({ method: "POST" })
  .inputValidator(annotateCoachPassageSchema)
  .handler(async ({ data }) => {
    if (process.env.COACH_REVIEW_MODE !== "true") {
      throw new CoachError("REVIEW_DISABLED", "review mode is not enabled");
    }
    const session = await auth.api.getSession({ headers: getRequest().headers });
    if (!session) throw new CoachError("UNAUTHORIZED", "not signed in");

    const [row] = await db
      .update(passages)
      .set({
        reviewVerdict: data.verdict,
        reviewRating: data.rating,
        reviewTags: data.tags,
        reviewNote: data.note ?? "",
        reviewedAt: new Date(),
        status: data.verdict === "good" ? "active" : "retired",
      })
      .where(eq(passages.id, data.passageId))
      .returning();
    if (!row) throw new CoachError("PASSAGE_NOT_FOUND", "passage not found");
    return row as unknown as PassageRecord;
  });

/** Raw LLM payload persisted on a passage in review mode. */
export type LlmOutput = {
  analysis: { content: string; usage: LlmResponse["usage"] };
  generation: { content: string; usage: LlmResponse["usage"] };
  /** The exact prompts that produced this passage (same for every
      generation unless the prompt files change). */
  prompts: { analysis: string; generation: string };
  model: string;
  latencyMs: number;
};

export function buildLlmOutput(
  analysis: LlmResponse,
  generation: LlmResponse,
  startedAtMs: number,
): LlmOutput {
  return {
    analysis: { content: analysis.content, usage: analysis.usage },
    generation: { content: generation.content, usage: generation.usage },
    prompts: getPrompts(),
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    latencyMs: Date.now() - startedAtMs,
  };
}

/** Review mode stores everything as needs_review; otherwise active. */
export function passageStatusFor(reviewMode: boolean): "active" | "needs_review" {
  return reviewMode ? "needs_review" : "active";
}
