# Coach Review Mode — Manual Passage Evaluation on Staging

Date: 2026-08-06
Branch: `feat/coach-ai-adaptive`
Status: Approved (owner), design stage

## 1. Motivation

The owner wants to evaluate AI-generated Coach passages manually — see the
raw DeepSeek output, the gate verdict, the failure indicators, and record a
verdict per passage — while testing on the isolated staging instance
(/opt/kerf-staging). Rather than a separate review workspace, the evaluation
lives inside the existing Coach typing flow: **every generated passage (gate
pass or fail) is presented for typing, with generation details shown, and an
annotation card at the end.**

This is human-in-the-loop evaluation of the LLM pipeline output, intended to
inform prompt/gate tuning before rollout (status doc §9).

## 2. Scope & flag

- New env flag: `COACH_REVIEW_MODE=true` — set ONLY in staging `.env`.
- When set: gate becomes **advisory** (never blocks), all generations are
  stored for review, generation details + annotation UI are rendered.
- When unset (prod): behavior is byte-for-byte today's — gate failures throw
  `GATE_REJECTED`, nothing extra is stored, no new UI, new server fn absent
  (flag-gated). Staging `.env` already ships the other `COACH_*` levers
  (`COACH_DAILY_LIMIT=999`, `COACH_FORCE_GENERATION=true`).

## 3. Data model (migration 0007, additive only)

`passages` gains columns:

| column | type | notes |
|---|---|---|
| `llm_output` | jsonb | raw analysis response + generation response (test_cases), model, token usage, latency ms |
| `review_verdict` | text | `'good' \| 'not_good' \| null` |
| `review_rating` | smallint | 1–5, null until annotated |
| `review_tags` | text[] | tag chips (multi-select), null until annotated |
| `review_note` | text | free text, null until annotated |
| `reviewed_at` | timestamptz | set on annotation |

`status` already supports `'active' | 'retired' | 'needs_review'` — no change.

## 4. Server

### 4.1 Generation path (`src/server/coach.ts`)

In review mode (`COACH_REVIEW_MODE === "true"`):

- The gate result is computed and stored as today, but a failed gate does NOT
  throw `GATE_REJECTED`. The candidate is stored with
  `status='needs_review'` + `qualityGate`, `measuredDensity`,
  `triggerTargets`, and the new `llm_output` payload, and returned to the
  client exactly like a passing passage.
- A passing gate also stores `status='needs_review'` in review mode — the
  owner reviews everything; only their verdict flips it to `active`.
- Quota claim/increment logic unchanged (staging limit is 999 anyway).

Out of review mode: current behavior — gate failures throw, nothing stored.

### 4.2 Annotation server fn (new)

`annotateCoachPassage` (createServerFn POST), input:

```
{ passageId: uuid, verdict: "good" | "not_good", rating: 1..5,
  tags: string[], note: string (optional) }
```

- 404 when `COACH_REVIEW_MODE` is off (feature absent on prod).
- Requires an authenticated session (`auth.api.getSession`).
- Validates tags against a fixed allowed set (client uses the same set).
- Updates: `review_verdict`, `review_rating`, `review_tags`, `review_note`,
  `reviewed_at = now()`, and `status = verdict === "good" ? "active" :
  "retired"`. Returns the updated record.
- Idempotent (re-annotation overwrites).

## 5. Client (`src/routes/practice_.coach.tsx`)

- The coach session response includes `reviewMode: boolean` (server-derived
  from the flag) so the client renders the extra UI only when active.
- Briefing (`CoachPreSessionStage` or a wrapper): collapsible
  "Generation details" panel:
  - Gate verdict + violations list (from `qualityGate`)
  - Measured densities vs required thresholds (from `measuredDensity` +
    `triggerTargets`)
  - Raw analysis JSON + generation JSON (from `llm_output`), model, token
    usage, latency — rendered in a `<pre>` for fidelity
  - Title, topic, targeted mechanism, word count, source
- Post stage: annotation card with verdict buttons (Good / Not good), 1–5
  rating, tag chips (multi-select; fixed set shared with the server), note
  textarea, Save button. On save: calls `annotateCoachPassage`, shows a
  saved confirmation, and updates the local passage status. The card is
  hidden after a successful annotation (or shows "saved" state).
- Only rendered when `reviewMode` is true.

## 6. Data flow

```
generate (LLM analysis → generation → gate measured)
  → stored status='needs_review' + llm_output + qualityGate   [review mode]
  → returned to client
  → briefing shows details panel
  → owner types the passage (normal typing engine)
  → post-stage annotation card
  → annotateCoachPassage → status active|retired + review fields
  → "next session" → next generation
```

## 7. Error handling

- Generation LLM failures (HTTP/empty/parse) still throw `CoachError` as
  today — review mode only relaxes the gate, not the pipeline.
- Annotation with a bad passageId / invalid payload → validation error copy.
- Annotation endpoint on prod (flag off) → 404.

## 8. Testing

- Unit: review-mode generation branch (gate fail → stored, no throw; gate
  pass → `needs_review`); annotate validation (tags whitelist, rating range,
  verdict values); status mapping good→active, not_good→retired.
- Existing 54 coach tests stay green; run
  `pnpm vitest run src/domain/coach src/server/coach src/components/coach`.
- No end-to-end UI automation (owner tests manually on staging).

## 9. Out of scope

- Prompt/gate tuning from the collected verdicts (future work, §7/§9 of the
  status doc).
- Passage analytics (avg_user_accuracy) — unchanged.
- Making the feature available to other users (shared catalog) — review mode
  is staging-only by flag.
