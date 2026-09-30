import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "../auth";
import { db } from "../db";
import { coachFeedback } from "../db/schema";
import { CoachError } from "./llm";

export const coachFeedbackSchema = z.object({
  passageId: z.string().uuid(),
  useful: z.boolean(),
});

/** A small product signal, independent of the staging-only quality review. */
export const submitCoachFeedback = createServerFn({ method: "POST" })
  .inputValidator(coachFeedbackSchema)
  .handler(async ({ data }) => {
    const session = await auth.api.getSession({ headers: getRequest().headers });
    if (!session) throw new CoachError("UNAUTHORIZED", "not signed in");
    await db
      .insert(coachFeedback)
      .values({ userId: session.user.id, passageId: data.passageId, useful: data.useful })
      .onConflictDoUpdate({
        target: [coachFeedback.userId, coachFeedback.passageId],
        set: { useful: data.useful, createdAt: new Date() },
      });
    return { saved: true };
  });
