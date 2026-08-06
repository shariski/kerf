# Coach Review Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staging-only, flag-gated "review mode" to Coach: every generated passage (gate pass or fail) is stored for manual review, the briefing shows generation details (gate verdict, measured densities, raw LLM output), and the post-stage has an annotation card (verdict, rating, tags, note).

**Architecture:** A `COACH_REVIEW_MODE=true` env flag (staging only). Server-side: the generation path stops throwing `GATE_REJECTED` in review mode, stores every candidate as `status='needs_review'` with a new `llm_output` jsonb payload, and the session response carries `reviewMode: boolean`. A new flag-gated `annotateCoachPassage` server fn flips status to `active`/`retired` + writes review fields. Client-side: a collapsible generation-details panel in the briefing and an annotation card in the post stage, both rendered only when `reviewMode` is true. Prod (flag unset) is byte-for-byte today's behavior.

**Tech Stack:** TypeScript, TanStack Start (createServerFn), Drizzle ORM + Postgres, vitest + @testing-library/react (jsdom), pnpm.

## Global Constraints

- `COACH_REVIEW_MODE` env flag: only set in `/opt/kerf-staging/.env`; never in prod.
- Flag unset ⇒ identical behavior to today: gate failures throw `CoachError("GATE_REJECTED")`, no new columns written by the normal path, no new UI, `annotateCoachPassage` throws `REVIEW_DISABLED`.
- Migration is additive-only (ALTER TABLE ADD COLUMN); filename `0007_coach_review.sql` in `src/server/db/migrations/` with `--> statement-breakpoint` separators.
- No meta/copy changes to prod UI; review UI renders only when the response's `reviewMode` is true.
- Test command: `pnpm vitest run src/domain/coach src/server/coach src/components/coach` (currently 54 passing). Typecheck: `pnpm typecheck` (pre-existing tsconfig deprecation error only).
- All commits go to `feat/coach-ai-adaptive`; never main; push at the end of Task 4 and Task 6 (each push triggers a staging deploy via CI).

---

### Task 1: Migration 0007 + schema columns + PassageRecord type

**Files:**
- Create: `src/server/db/migrations/0007_coach_review.sql`
- Modify: `src/server/db/schema.ts:222-248` (passages table)
- Modify: `src/server/coach/catalog.ts:8-24` (PassageRecord type)

**Interfaces:**
- Produces: DB columns `llm_output`, `review_verdict`, `review_rating`, `review_tags`, `review_note`, `reviewed_at`; `PassageRecord` gains optional `llmOutput?: LlmOutput | null`, `reviewVerdict?: string | null`, `reviewRating?: number | null`, `reviewTags?: string[] | null`, `reviewNote?: string | null`, `reviewedAt?: Date | string | null` (LlmOutput is imported type-only from `./review`, defined in Task 2).

- [ ] **Step 1: Create the migration file**

`src/server/db/migrations/0007_coach_review.sql`:

```sql
ALTER TABLE "passages" ADD COLUMN "llm_output" jsonb;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_verdict" text;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_rating" smallint;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_tags" text[];--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "passages" ADD COLUMN "reviewed_at" timestamp with time zone;
```

- [ ] **Step 2: Add the columns to the Drizzle schema**

In `src/server/db/schema.ts`, inside the `passages` table definition (after `usageCount`), add:

```ts
    llmOutput: jsonb("llm_output"), // LlmOutput — raw analysis/generation payload
    reviewVerdict: text("review_verdict"), // 'good' | 'not_good' | null
    reviewRating: smallint("review_rating"), // 1-5 | null
    reviewTags: text("review_tags").array(), // ReviewTag[] | null
    reviewNote: text("review_note"), // free text | null
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
```

Add `smallint` to the existing `import { ... } from "drizzle-orm/pg-core"` line (it already imports `integer`, `jsonb`, `text`, `timestamp`, `uuid`).

- [ ] **Step 3: Extend PassageRecord**

In `src/server/coach/catalog.ts`, add `import type { LlmOutput } from "./review";` (type-only — no runtime cycle; LlmOutput is defined in Task 2) and append to the `PassageRecord` type (after `usageCount: number;`):

```ts
  llmOutput?: LlmOutput | null;
  reviewVerdict?: string | null;
  reviewRating?: number | null;
  reviewTags?: string[] | null;
  reviewNote?: string | null;
  reviewedAt?: Date | string | null;
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: only the pre-existing tsconfig deprecation error (`TS5101`); no errors in schema.ts/catalog.ts. (Task 2 defines `LlmOutput`, so `import type` resolving requires Task 2 — if typecheck fails on the missing module, that's expected and resolved by Task 2; the SQL validity is verified at deploy time in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/server/db/migrations/0007_coach_review.sql src/server/db/schema.ts src/server/coach/catalog.ts
git commit -m "feat(coach): review-mode passage columns (migration 0007)"
```

---

### Task 2: Shared review constants + server review helpers

**Files:**
- Create: `src/domain/coach/review.ts`
- Create: `src/server/coach/review.ts`
- Test: `src/server/coach/review.test.ts`

**Interfaces:**
- Produces:
  - `src/domain/coach/review.ts`: `REVIEW_TAGS` (readonly tuple), `type ReviewTag`, `type ReviewVerdict`
  - `src/server/coach/review.ts`: `type LlmOutput`, `buildLlmOutput(analysis: LlmResponse, generation: LlmResponse, startedAtMs: number): LlmOutput`, `passageStatusFor(reviewMode: boolean): "active" | "needs_review"`, `REVIEW_TAGS_RE_EXPORT` not needed — import `REVIEW_TAGS` from the domain file.
- Consumes: `LlmResponse` from `#/server/coach/llm` (Task 2 defines nothing from earlier tasks — self-contained).

- [ ] **Step 1: Write the failing tests**

`src/server/coach/review.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REVIEW_TAGS } from "#/domain/coach/review";
import { buildLlmOutput, passageStatusFor } from "./review";

describe("passageStatusFor", () => {
  it("returns needs_review in review mode", () => {
    expect(passageStatusFor(true)).toBe("needs_review");
  });
  it("returns active outside review mode", () => {
    expect(passageStatusFor(false)).toBe("active");
  });
});

describe("buildLlmOutput", () => {
  const res = {
    content: "{\"suggested_topics\":[\"space\"]}",
    usage: { promptTokens: 10, completionTokens: 20 },
  };
  it("captures both responses, model, and latency", () => {
    const out = buildLlmOutput(res, { ...res, content: "{\"test_cases\":[]}" }, 1_000);
    expect(out.analysis.content).toContain("suggested_topics");
    expect(out.generation.content).toContain("test_cases");
    expect(out.analysis.usage.completionTokens).toBe(20);
    expect(out.model).toBeTruthy();
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("REVIEW_TAGS", () => {
  it("has a stable, fixed tag set", () => {
    expect(REVIEW_TAGS).toEqual([
      "too easy",
      "too hard",
      "bad density",
      "meta words",
      "good density",
      "good title",
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/server/coach/review.test.ts`
Expected: FAIL — `Cannot find module .../review` (files don't exist yet).

- [ ] **Step 3: Create the shared constants**

`src/domain/coach/review.ts`:

```ts
/**
 * Fixed tag set for manual passage annotation. Shared by the client
 * (annotation chips) and the server (zod whitelist) — keep in sync.
 */
export const REVIEW_TAGS = [
  "too easy",
  "too hard",
  "bad density",
  "meta words",
  "good density",
  "good title",
] as const;

export type ReviewTag = (typeof REVIEW_TAGS)[number];
export type ReviewVerdict = "good" | "not_good";
```

- [ ] **Step 4: Create the server helpers**

`src/server/coach/review.ts`:

```ts
import type { LlmResponse } from "./llm";

/** Raw LLM payload persisted on a passage in review mode. */
export type LlmOutput = {
  analysis: { content: string; usage: LlmResponse["usage"] };
  generation: { content: string; usage: LlmResponse["usage"] };
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
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-flash",
    latencyMs: Date.now() - startedAtMs,
  };
}

/** Review mode stores everything as needs_review; otherwise active. */
export function passageStatusFor(reviewMode: boolean): "active" | "needs_review" {
  return reviewMode ? "needs_review" : "active";
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/server/coach/review.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/coach/review.ts src/server/coach/review.ts src/server/coach/review.test.ts
git commit -m "feat(coach): review-mode constants + LLM output helpers"
```

---

### Task 3: Review-mode generation path in coach.ts + catalog support

**Files:**
- Modify: `src/server/coach.ts:228-380` (getCoachSession handler)
- Modify: `src/server/coach/catalog.ts:69-94` (insertPassage signature/values)
- Test: `src/server/coach.test.ts` (existing tests must stay green)

**Interfaces:**
- Consumes: `passageStatusFor`, `buildLlmOutput` from `./coach/review` (Task 2); `LlmResponse` from `./coach/llm`.
- Produces: `CoachResponse` gains `reviewMode: boolean`; `findPassageAny(tx, targetKey, topic, difficulty)` in catalog.ts.

- [ ] **Step 1: Add findPassageAny to catalog.ts**

In `src/server/coach/catalog.ts`, after `findPassage`, add:

```ts
/**
 * Look up a passage by the full unique key regardless of status. Used as
 * the conflict fallback in review mode, where the colliding row may be
 * `needs_review` (invisible to findPassage's active-only filter).
 */
export async function findPassageAny(
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
      ),
    )
    .limit(1);
  return (rows[0] as PassageRecord | undefined) ?? null;
}
```

- [ ] **Step 2: Change insertPassage to write status + llmOutput**

In `src/server/coach/catalog.ts`, change the signature from `Omit<PassageRecord, "id" | "usageCount" | "status">` to `Omit<PassageRecord, "id" | "usageCount">` and add to the `.values({...})` object (after `targetKey`):

```ts
      status: passage.status,
      ...(passage.llmOutput ? { llmOutput: passage.llmOutput } : {}),
```

- [ ] **Step 3: Wire review mode into getCoachSession**

In `src/server/coach.ts`:

a) Import the helpers (extend the existing `./coach/llm` import block — add a new import):

```ts
import { buildLlmOutput, passageStatusFor } from "./coach/review";
```

Also extend the existing `./coach/llm` import to include the response type:
`import { ..., type LlmResponse } from "./coach/llm";` (LlmResponse is used for the `lastGenRes` capture below).

b) At the top of the `getCoachSession` handler (after `const request = getRequest();`), add:

```ts
    const reviewMode = process.env.COACH_REVIEW_MODE === "true";
```

c) Replace the gate-fail throw (currently `if (!gateResult?.passed) { throw new CoachError("GATE_REJECTED", ...) }`) with:

```ts
    if (!reviewMode && !gateResult?.passed) {
      throw new CoachError(
        "GATE_REJECTED",
        `passage failed gate: ${gateResult?.violations.join("; ")}`,
      );
    }
```

d) Before the `for` loop that runs generation attempts, capture the start time (after `const targets = gateTargetsFor(targetMechanism);` block, before `let gateResult`):

```ts
    const generationStartedAt = Date.now();
```

Then inside the loop, after `const genRes = await llm(genMsgs, { thinkingOff: true });`, add a hoisted capture. The loop currently declares `let testCase: GeneratedCase | undefined;` — add `let lastGenRes: LlmResponse | undefined;` to that declaration block and inside the loop (after `genRes` is assigned):

```ts
      lastGenRes = genRes;
```

(Declare `lastGenRes` in the same `let` block as `gateResult`/`testCase`/`rawPassageText`.)

e) After the gate block (after step c's `if`), the passage object currently ends with `satisfies Omit<PassageRecord, "id" | "usageCount" | "status">`. Change that to `satisfies Omit<PassageRecord, "id" | "usageCount">` and add two fields:

```ts
      status: passageStatusFor(reviewMode),
      ...(lastGenRes ? { llmOutput: buildLlmOutput(analysisRes, lastGenRes, generationStartedAt) } : {}),
```

f) In the claim transaction, replace the collision fallback:

```ts
      const existingRow =
        inserted ?? (await findPassageAny(txDb, passage.targetKey, passage.topic, passage.difficulty));
```

(import `findPassageAny` alongside `findPassage` in the existing catalog import block; `findPassage` is still used by the rotation branch.)

g) The final return currently spreads `status: "active"` — change to:

```ts
      passage: { ...passage, id: passageId, usageCount: 1, status: passage.status } as PassageRecord,
```

h) Add `reviewMode` to the `CoachResponse` type and both return branches (the catalog-serve branch and the final branch):

```ts
      reviewMode,
```

- [ ] **Step 4: Run the coach suites to verify no regression**

Run: `pnpm vitest run src/domain/coach src/server/coach src/components/coach`
Expected: PASS (54 tests) — no existing test asserts the removed hardcoded `"active"` status or throws on review mode.

- [ ] **Step 5: Push (triggers a staging deploy; migration 0007 applies)**

```bash
git add src/server/coach.ts src/server/coach/catalog.ts
git commit -m "feat(coach): review-mode generation path (gate advisory, needs_review storage)"
git push origin feat/coach-ai-adaptive
```

---

### Task 4: annotateCoachPassage server fn

**Files:**
- Modify: `src/server/coach/review.ts`
- Test: `src/server/coach/review.test.ts`

**Interfaces:**
- Consumes: `REVIEW_TAGS` from `#/domain/coach/review` (Task 2); `CoachError` from `./llm`; `auth` from `../auth`; `db` from `../db`; `passages` from `../db/schema`; `PassageRecord` from `./catalog` (type-only).
- Produces: `annotateCoachPassage` createServerFn — input `{ passageId: uuid, verdict: "good"|"not_good", rating: 1..5, tags: ReviewTag[] (max 5), note?: string (max 500) }`, returns updated `PassageRecord`. Throws `CoachError("REVIEW_DISABLED")` when the flag is off, `UNAUTHORIZED` without a session, `PASSAGE_NOT_FOUND` for a bad id.

- [ ] **Step 1: Write the failing tests**

Append to `src/server/coach/review.test.ts`:

```ts
import { z } from "zod";
import { annotateCoachPassageSchema } from "./review";

describe("annotateCoachPassageSchema", () => {
  const valid = {
    passageId: "92898d6c-9538-43f6-92b4-198e87a11cbf",
    verdict: "good",
    rating: 4,
    tags: ["good density"],
    note: "nice passage",
  };
  it("accepts a valid payload", () => {
    expect(annotateCoachPassageSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects an unknown verdict", () => {
    const r = annotateCoachPassageSchema.safeParse({ ...valid, verdict: "maybe" });
    expect(r.success).toBe(false);
  });
  it("rejects rating out of range", () => {
    expect(annotateCoachPassageSchema.safeParse({ ...valid, rating: 6 }).success).toBe(false);
  });
  it("rejects unknown tags", () => {
    expect(annotateCoachPassageSchema.safeParse({ ...valid, tags: ["spam"] }).success).toBe(false);
  });
  it("rejects more than 5 tags", () => {
    const tags = ["too easy", "too hard", "bad density", "meta words", "good density", "good title"];
    expect(annotateCoachPassageSchema.safeParse({ ...valid, tags }).success).toBe(false);
  });
  it("allows an empty note", () => {
    expect(annotateCoachPassageSchema.safeParse({ ...valid, note: "" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/server/coach/review.test.ts`
Expected: FAIL — `annotateCoachPassageSchema` not exported.

- [ ] **Step 3: Implement the schema + server fn**

Append to `src/server/coach/review.ts`:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "../auth";
import { db } from "../db";
import { passages } from "../db/schema";
import { CoachError } from "./llm";
import { REVIEW_TAGS } from "#/domain/coach/review";
import type { PassageRecord } from "./catalog";

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/server/coach/review.test.ts`
Expected: PASS (9 tests total).

- [ ] **Step 5: Commit + push (staging deploy)**

```bash
git add src/server/coach/review.ts src/server/coach/review.test.ts
git commit -m "feat(coach): annotateCoachPassage server fn (flag-gated verdict endpoint)"
git push origin feat/coach-ai-adaptive
```

---

### Task 5: Client — generation details panel + annotation card

**Files:**
- Create: `src/components/coach/CoachGenerationDetails.tsx`
- Create: `src/components/coach/CoachPassageAnnotation.tsx`
- Test: `src/components/coach/CoachGenerationDetails.test.tsx`, `src/components/coach/CoachPassageAnnotation.test.tsx`
- Modify: `src/routes/practice_.coach.tsx`

**Interfaces:**
- Consumes: `annotateCoachPassage` from `#/server/coach/review`; `reviewMode: boolean` + `passage` from the coach session response (Task 3); `REVIEW_TAGS`, `ReviewTag`, `ReviewVerdict` from `#/domain/coach/review`; `PassageRecord` from `#/server/coach/catalog`.
- Produces: `CoachGenerationDetails({ passage, reviewMode })`; `CoachPassageAnnotation({ reviewMode, saved, onSave })`.

- [ ] **Step 1: Write the failing component tests**

`src/components/coach/CoachGenerationDetails.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CoachGenerationDetails } from "./CoachGenerationDetails";
import type { PassageRecord } from "#/server/coach/catalog";

const passage: PassageRecord = {
  id: "p1",
  title: "The Silk Road",
  topic: "trade routes",
  difficulty: "hard",
  mechanisms: ["cross-hand"],
  triggerTargets: { cross_hand_rate: 0.527 },
  measuredDensity: { crossHand: 0.481 },
  qualityGate: {
    passed: false,
    mechanism: "cross-hand",
    measured: { crossHand: 0.481 },
    violations: ["saturation: cross-hand below threshold"],
  },
  text: "the silk road linked east and west",
  wordCount: 8,
  paragraphs: 1,
  source: "ai:deepseek-v4-flash:v6",
  status: "needs_review",
  targetKey: "abc",
  usageCount: 0,
  llmOutput: {
    analysis: { content: "{\"suggested_topics\":[\"trade routes\"]}", usage: { promptTokens: 1, completionTokens: 2 } },
    generation: { content: "{\"test_cases\":[]}", usage: { promptTokens: 3, completionTokens: 4 } },
    model: "deepseek-v4-flash",
    latencyMs: 150_000,
  },
};

afterEach(cleanup);

describe("CoachGenerationDetails", () => {
  it("renders the gate verdict and violations", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getByText(/failed/i)).toBeTruthy();
    expect(screen.getByText(/saturation: cross-hand below threshold/i)).toBeTruthy();
  });

  it("renders measured vs required densities", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getByText(/cross_hand_rate/i)).toBeTruthy();
    expect(screen.getByText(/0.527/i)).toBeTruthy();
    expect(screen.getByText(/0.481/i)).toBeTruthy();
  });

  it("renders the raw LLM output and metadata", () => {
    render(<CoachGenerationDetails passage={passage} reviewMode />);
    expect(screen.getByText(/suggested_topics/i)).toBeTruthy();
    expect(screen.getByText(/test_cases/i)).toBeTruthy();
    expect(screen.getByText(/150000/i)).toBeTruthy();
    expect(screen.getByText(/The Silk Road/i)).toBeTruthy();
  });

  it("renders nothing when review mode is off", () => {
    const { container } = render(<CoachGenerationDetails passage={passage} reviewMode={false} />);
    expect(container.textContent ?? "").toBe("");
  });
});
```

`src/components/coach/CoachPassageAnnotation.test.tsx`:

```tsx
/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { CoachPassageAnnotation } from "./CoachPassageAnnotation";

afterEach(cleanup);

describe("CoachPassageAnnotation", () => {
  it("renders nothing when review mode is off", () => {
    const { container } = render(
      <CoachPassageAnnotation reviewMode={false} saved={false} onSave={vi.fn()} />,
    );
    expect(container.textContent ?? "").toBe("");
  });

  it("disables save until a verdict is chosen, then submits the payload", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CoachPassageAnnotation reviewMode saved={false} onSave={onSave} />);
    const save = screen.getByRole("button", { name: /save verdict/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /good/i }));
    fireEvent.click(screen.getByRole("button", { name: "4" }));
    fireEvent.click(screen.getByRole("button", { name: /good density/i }));
    expect((save as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      verdict: "good",
      rating: 4,
      tags: ["good density"],
    });
  });

  it("shows the saved state after annotation", () => {
    render(<CoachPassageAnnotation reviewMode saved onSave={vi.fn()} />);
    expect(screen.getByText(/saved/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/components/coach/CoachGenerationDetails.test.tsx src/components/coach/CoachPassageAnnotation.test.tsx`
Expected: FAIL — modules don't exist.

- [ ] **Step 3: Create CoachGenerationDetails**

`src/components/coach/CoachGenerationDetails.tsx`:

```tsx
import type { PassageRecord } from "#/server/coach/catalog";

type Props = {
  passage: PassageRecord;
  reviewMode: boolean;
};

/**
 * Review-mode only: collapsible panel showing the gate verdict, measured
 * densities vs required thresholds, the raw DeepSeek outputs, and passage
 * metadata. Rendered in the Coach briefing. Hidden when reviewMode is off.
 */
export function CoachGenerationDetails({ passage, reviewMode }: Props) {
  if (!reviewMode) return null;
  const gate = passage.qualityGate;
  const targets = passage.triggerTargets ?? {};
  const measured = passage.measuredDensity ?? {};
  const llm = passage.llmOutput;

  return (
    <details className="kerf-coach-details">
      <summary>Generation details</summary>
      <section aria-label="Gate verdict">
        <p>
          Gate: <strong>{gate.passed ? "passed" : "failed"}</strong>
        </p>
        {gate.violations.length > 0 && (
          <ul>
            {gate.violations.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Measured densities">
        {Object.entries(targets).map(([k, required]) => (
          <p key={k}>
            {k}: measured {measured[k] ?? "—"} vs required {required}
          </p>
        ))}
      </section>
      <section aria-label="Passage metadata">
        <p>
          {passage.title} · {passage.topic} · {passage.wordCount} words ·{" "}
          {passage.paragraphs} paragraph(s) · {passage.source} ·{" "}
          {passage.mechanisms.join(", ")}
        </p>
      </section>
      {llm && (
        <section aria-label="Raw LLM output">
          <p>
            {llm.model} · {llm.latencyMs}ms
          </p>
          <pre>{llm.analysis.content}</pre>
          <pre>{llm.generation.content}</pre>
        </section>
      )}
    </details>
  );
}
```

- [ ] **Step 4: Create CoachPassageAnnotation**

`src/components/coach/CoachPassageAnnotation.tsx`:

```tsx
import { useState } from "react";
import { REVIEW_TAGS, type ReviewTag, type ReviewVerdict } from "#/domain/coach/review";

type Props = {
  reviewMode: boolean;
  saved: boolean;
  onSave: (input: {
    verdict: ReviewVerdict;
    rating: number;
    tags: ReviewTag[];
    note: string;
  }) => Promise<void>;
};

/** Review-mode only: human verdict card shown after a Coach session. */
export function CoachPassageAnnotation({ reviewMode, saved, onSave }: Props) {
  const [verdict, setVerdict] = useState<ReviewVerdict | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<ReviewTag[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!reviewMode) return null;
  if (saved) {
    return (
      <section className="kerf-coach-review" aria-label="Passage annotation">
        <p>Saved — thank you.</p>
      </section>
    );
  }

  const toggleTag = (tag: ReviewTag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const canSave = verdict !== null && rating !== null;

  return (
    <section className="kerf-coach-review" aria-label="Passage annotation">
      <p>How was this passage?</p>
      <div>
        {(["good", "not_good"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVerdict(v)}
            aria-pressed={verdict === v}
          >
            {v}
          </button>
        ))}
      </div>
      <div>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            aria-pressed={rating === n}
          >
            {n}
          </button>
        ))}
      </div>
      <div>
        {REVIEW_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            aria-pressed={tags.includes(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note"
        rows={2}
      />
      <button
        type="button"
        disabled={!canSave || saving}
        onClick={async () => {
          if (!verdict || rating === null) return;
          setSaving(true);
          try {
            await onSave({ verdict, rating, tags, note });
          } finally {
            setSaving(false);
          }
        }}
      >
        Save verdict
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Wire the route**

In `src/routes/practice_.coach.tsx`:

a) Add imports:

```tsx
import { annotateCoachPassage } from "#/server/coach/review";
import { CoachGenerationDetails } from "#/components/coach/CoachGenerationDetails";
import { CoachPassageAnnotation } from "#/components/coach/CoachPassageAnnotation";
```

b) Add state alongside the existing `const [quota, setQuota] = ...`:

```tsx
  const [reviewMode, setReviewMode] = useState(false);
  const [annotated, setAnnotated] = useState(false);
```

c) In the fetch `.then((res) => {...})` (inside `cacheCoachSession`/restore and the success handler) — the cache shape + restore types: add `reviewMode: boolean` to the cached type (two places: the `cacheCoachSession` parameter type and the `restoreCoachSession` parse type) and set:

```tsx
        setReviewMode(res.reviewMode);
```

Also in `restoreCoachSession` success path add `setReviewMode(cached.reviewMode);`.

d) In the briefing render block (`stage === "pre" && report && passage && targetMechanism`), render the details panel above `CoachPreSessionStage`:

```tsx
            <CoachGenerationDetails passage={passage} reviewMode={reviewMode} />
```

e) In the post-stage render block, pass the annotation card after `CoachPostSessionStage` (inside the same `stage === "post"` fragment). `passage` is guaranteed non-null here (typing requires a fetched passage), so use the non-null assertion:

```tsx
            <CoachPassageAnnotation
              reviewMode={reviewMode}
              saved={annotated}
              onSave={async (input) => {
                await annotateCoachPassage({
                  data: { passageId: passage!.id, ...input },
                });
                setAnnotated(true);
              }}
            />
```

- [ ] **Step 6: Run all coach tests + typecheck**

Run: `pnpm vitest run src/domain/coach src/server/coach src/components/coach`
Expected: PASS (54 + new component/review tests).
Run: `pnpm typecheck`
Expected: only the pre-existing tsconfig deprecation error.

- [ ] **Step 7: Commit + push (staging deploy)**

```bash
git add src/components/coach/CoachGenerationDetails.tsx src/components/coach/CoachPassageAnnotation.tsx src/components/coach/CoachGenerationDetails.test.tsx src/components/coach/CoachPassageAnnotation.test.tsx src/routes/practice_.coach.tsx
git commit -m "feat(coach): review-mode UI — generation details panel + annotation card"
git push origin feat/coach-ai-adaptive
```

---

### Task 6: Enable on staging + verify

**Files:**
- Modify: `/opt/kerf-staging/.env` (on jumbo) — `COACH_REVIEW_MODE=true`
- Modify: `/opt/kerf-staging/README.md` (on jumbo)

- [ ] **Step 1: Add the flag to staging .env**

```bash
ssh jumbo 'grep -q "^COACH_REVIEW_MODE=" /opt/kerf-staging/.env || echo "COACH_REVIEW_MODE=true" >> /opt/kerf-staging/.env; chmod 600 /opt/kerf-staging/.env'
```

- [ ] **Step 2: Recreate the app container so the flag is picked up**

```bash
ssh jumbo 'cd /opt/kerf-staging && IMAGE_TAG=$(docker inspect -f "{{.Image}}" kerf-staging-app-1 | sed "s/sha256://" | cut -c1-12) && docker compose -f docker-compose.staging.yml up -d --force-recreate app'
```

(If the pinned image tag can't be derived, use `docker compose -f docker-compose.staging.yml up -d app` and accept the pull — the isolated DOCKER_CONFIG avoids the stale-credential failure.)

- [ ] **Step 3: Verify the flag + migration in the container**

```bash
ssh jumbo 'docker exec kerf-staging-app-1 sh -c "echo COACH_REVIEW_MODE=\$COACH_REVIEW_MODE"'
ssh jumbo 'docker exec kerf-staging-postgres-1 psql -U kerf -d kerf_staging -c "SELECT column_name FROM information_schema.columns WHERE table_name = '"'"'passages'"'"' AND column_name IN ('"'"'llm_output'"'"','"'"'review_verdict'"'"','"'"'review_rating'"'"','"'"'review_tags'"'"','"'"'review_note'"'"','"'"'reviewed_at'"'"');"'
```

Expected: flag prints `true`; psql returns all 6 columns.

- [ ] **Step 4: Update the VPS README**

Add a section to `/opt/kerf-staging/README.md`:

```markdown
## Coach review mode

COACH_REVIEW_MODE=true (staging only): the gate is advisory — every
generated passage is stored as needs_review and presented for typing.
The briefing shows "Generation details" (gate verdict, measured vs
required densities, raw DeepSeek output). After typing, the annotation
card records your verdict (good → active, not_good → retired) + rating,
tags, note. Unset on prod: gate failures are rejected as usual.
```

- [ ] **Step 5: Verify the full suite once more + report**

Run: `pnpm vitest run src/domain/coach src/server/coach src/components/coach`
Expected: PASS.
Report to the owner: what to test manually (generate → type → annotate → next session), and that prod is untouched (flag unset there).
