import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { auth } from "./auth";
import { db, type Database } from "./db";
import { keyboardProfiles, sessions, keystrokeEvents } from "./db/schema";
import { SOFLE_BASE_LAYER } from "#/domain/finger/sofle";
import { LILY58_BASE_LAYER } from "#/domain/finger/lily58";
import type { KeyboardLayout, FingerTable } from "#/domain/finger/types";
import type { KeystrokeEvent } from "#/domain/stats/types";
import { computeWhyReport, type WhyReport } from "#/domain/coach/whyReport";
import { evaluateGate, gateTargetsFor, type GateResult } from "#/domain/coach/gate";
import { normalizePassageText } from "#/domain/coach/normalize";
import type { MechanismKey } from "#/domain/coach/mechanisms";
import {
  targetKeyFor,
  findPassage,
  findPassageAny,
  insertPassage,
  incrementUsage,
  countActiveForKey,
  listTopicsForTargetKey,
  textExists,
  type PassageRecord,
} from "./coach/catalog";
import { DEFAULT_WORD_RANGE, type WordRange } from "#/domain/coach/gate";
import {
  coachQuotaUsed, claimCoachQuota, DAILY_COACH_LIMIT, utcDateString,
} from "./coach/quota";
import {
  createLlmClient,
  buildAnalysisMessages,
  buildGenerationMessages,
  extractJsonObject,
  CoachError,
  type LlmResponse,
} from "./coach/llm";
import { buildLlmOutput, passageStatusFor } from "./coach/review";

const RECENT_SESSION_LIMIT = 50;
const TOP_MECHANISMS = 3;

export const getCoachSessionSchema = z.object({
  keyboardProfileId: z.string().uuid(),
});

type CoachResponse = {
  quota: { usedToday: number; remaining: number };
  report: WhyReport;
  /** The mechanism the passage was generated and gated for. */
  targetMechanism: MechanismKey;
  passage: PassageRecord;
  /** True when COACH_REVIEW_MODE is on (staging) — drives the review UI. */
  reviewMode: boolean;
};

function fingerTableFor(layout: KeyboardLayout): FingerTable {
  return layout === "sofle" ? SOFLE_BASE_LAYER : LILY58_BASE_LAYER;
}

const TOPIC_STOPWORDS = new Set([
  "the",
  "and",
  "its",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "from",
  "a",
  "an",
  "was",
  "not",
  "are",
  "is",
]);

/** Significant tokens of a topic — stopwords + 1-2 letter words dropped. */
function significantTokens(topic: string): Set<string> {
  return new Set(
    topic
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !TOPIC_STOPWORDS.has(w)),
  );
}

/**
 * Rotate the targeted mechanism across the user's top weaknesses while
 * keeping the main one dominant. Pattern [0, 0, 1, 0, 2] by session
 * index → the #1 weakness gets 60% of sessions, #2 and #3 get 20% each.
 * Clamps to the available mechanism count. Deterministic per day so
 * consecutive Coach sessions stay varied without ever losing focus on
 * the main weakness.
 */
const MECHANISM_ROTATION = [0, 0, 1, 0, 2];

export function pickTargetMechanism(
  mechanisms: MechanismKey[],
  sessionIndex: number,
): MechanismKey {
  const pattern = MECHANISM_ROTATION[sessionIndex % MECHANISM_ROTATION.length] ?? 0;
  const index = Math.min(pattern, mechanisms.length - 1);
  return mechanisms[index]!;
}

/**
 * Choose the generation topic. The analysis call suggests several topics;
 * prefer one that does not overlap with any topic already used for this
 * weakness-set, so repeated generations (same analysis input → same theme
 * suggestions) produce visibly distinct passages. Overlap is judged on
 * significant tokens, so "The Silk Road" and "The history of the Silk Road
 * and its impact on trade" count as the same theme.
 */
export function pickTopic(suggested: string[], used: string[]): string {
  const usedTokens = used.map((t) => significantTokens(t));
  const fresh = suggested.find((s) => {
    const tokens = significantTokens(s);
    return tokens.size > 0 && !usedTokens.some((u) => [...tokens].some((t) => u.has(t)));
  });
  return fresh ?? suggested[0] ?? "general knowledge";
}

/**
 * Review mode: candidates are evaluated individually, so a repeated exact
 * topic must never silently re-serve an existing row via the unique-key
 * collision fallback. When the LLM repeats a used topic (cycling
 * exhausted), append a variant marker to make the insert unique.
 */
export function reviewTopic(topic: string, used: string[]): string {
  return used.some((t) => t.toLowerCase() === topic.toLowerCase())
    ? `${topic} — review #${used.length + 1}`
    : topic;
}

/**
 * The passage topic is part of the catalog's unique key, so in review
 * mode the cycled topic is authoritative — the LLM's echoed topic would
 * otherwise re-collide with an existing row (the model tends to repeat
 * the first suggested topic). Outside review mode the model's refined
 * topic wins, falling back to the cycled one.
 */
export function passageTopicFor(
  reviewMode: boolean,
  cycledTopic: string,
  llmTopic: string | undefined,
): string {
  return reviewMode ? cycledTopic : (llmTopic ?? cycledTopic);
}

/**
 * Passage length range (words). Env-overridable for staging testing
 * (COACH_WORD_RANGE="60,140" → ~1 min sessions at typical speeds);
 * unset/invalid keeps the default 120-350.
 */
export function parseWordRange(raw: string | undefined): WordRange {
  if (!raw) return DEFAULT_WORD_RANGE;
  const [minRaw, maxRaw] = raw.split(",").map((s) => Number(s.trim()));
  if (
    minRaw === undefined ||
    maxRaw === undefined ||
    !Number.isFinite(minRaw) ||
    !Number.isFinite(maxRaw) ||
    minRaw < 1 ||
    maxRaw <= minRaw
  ) {
    return DEFAULT_WORD_RANGE;
  }
  return { min: Math.floor(minRaw), max: Math.floor(maxRaw) };
}

/** Append `ms` to the bucket for `key`, creating the bucket on first use. */
function pushTiming(buckets: Map<string, number[]>, key: string, ms: number): void {
  const bucket = buckets.get(key);
  if (bucket) bucket.push(ms);
  else buckets.set(key, [ms]);
}

export function buildLlmDigest(events: KeystrokeEvent[]): string {
  const charAttempts = new Map<string, number>();
  const charErrors = new Map<string, number>();
  const charMs = new Map<string, number[]>();
  const bgAttempts = new Map<string, number>();
  const bgErrors = new Map<string, number>();
  const bgMs = new Map<string, number[]>();
  const confusions = new Map<string, number>();

  for (const e of events) {
    charAttempts.set(e.targetChar, (charAttempts.get(e.targetChar) ?? 0) + 1);
    if (e.isError) charErrors.set(e.targetChar, (charErrors.get(e.targetChar) ?? 0) + 1);
    pushTiming(charMs, e.targetChar, e.keystrokeMs);
    if (e.prevChar) {
      const bg = e.prevChar + e.targetChar;
      bgAttempts.set(bg, (bgAttempts.get(bg) ?? 0) + 1);
      if (e.isError) bgErrors.set(bg, (bgErrors.get(bg) ?? 0) + 1);
      pushTiming(bgMs, bg, e.keystrokeMs);
    }
    if (e.isError && e.actualChar !== e.targetChar) {
      const k = `${e.targetChar}->${e.actualChar}`;
      confusions.set(k, (confusions.get(k) ?? 0) + 1);
    }
  }

  const avg = (ms: number[]) =>
    ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0;
  const charStats = [...charAttempts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 35)
    .map(([c, n]) => ({
      char: c,
      attempts: n,
      err_rate: Math.round(((charErrors.get(c) ?? 0) / n) * 10000) / 10000,
      avg_ms: avg(charMs.get(c) ?? []),
    }));
  const bgRows = [...bgAttempts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 80)
    .map(([bg, n]) => ({
      bigram: bg,
      attempts: n,
      err_rate: Math.round(((bgErrors.get(bg) ?? 0) / n) * 10000) / 10000,
      avg_ms: avg(bgMs.get(bg) ?? []),
    }));
  const worstBigrams = bgRows
    .filter((r) => r.attempts >= 60 && r.err_rate > 0)
    .sort((a, b) => b.err_rate - a.err_rate)
    .slice(0, 25);

  return JSON.stringify({
    user_profile: {
      keystrokes: events.length,
      errors: events.filter((e) => e.isError).length,
      true_confusions: events.filter((e) => e.isError && e.actualChar !== e.targetChar).length,
    },
    character_stats: charStats,
    bigram_stats: bgRows,
    worst_bigrams: worstBigrams,
    confusions: [...confusions.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([k, n]) => ({ pair: k, count: n })),
  });
}

/** One entry of the generation call's `test_cases` array. */
type GeneratedCase = {
  mechanism?: string;
  title?: string;
  topic?: string;
  text?: string;
};

type CoachContext = {
  userId: string;
  fingerTable: FingerTable;
  report: WhyReport;
  topMechanisms: MechanismKey[];
  events: KeystrokeEvent[];
};

async function loadCoachContext(
  keyboardProfileId: string,
  requestHeaders: Headers,
): Promise<CoachContext> {
  const authSession = await auth.api.getSession({ headers: requestHeaders });
  if (!authSession) throw new CoachError("UNAUTHORIZED", "not signed in");
  const userId = authSession.user.id;

  const [profile] = await db
    .select({ id: keyboardProfiles.id, keyboardType: keyboardProfiles.keyboardType })
    .from(keyboardProfiles)
    .where(and(eq(keyboardProfiles.id, keyboardProfileId), eq(keyboardProfiles.userId, userId)))
    .limit(1);
  if (!profile) throw new CoachError("PROFILE_NOT_FOUND", "profile not found");

  const layout = profile.keyboardType as KeyboardLayout;
  const fingerTable = fingerTableFor(layout);

  const recent = await db
    .select({ id: sessions.id, startedAt: sessions.startedAt, phase: sessions.phaseAtSession })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.keyboardProfileId, profile.id)))
    .orderBy(desc(sessions.startedAt))
    .limit(RECENT_SESSION_LIMIT);
  const sessionIds = recent.map((s) => s.id);
  const events = sessionIds.length
    ? ((await db
        .select()
        .from(keystrokeEvents)
        .where(inArray(keystrokeEvents.sessionId, sessionIds))) as unknown as KeystrokeEvent[])
    : [];

  const report = computeWhyReport(events, fingerTable);
  const topMechanisms = report.mechanisms
    .filter((m) => m.mechanism !== "non-alpha")
    .slice(0, TOP_MECHANISMS)
    .map((m) => m.mechanism);

  return { userId, fingerTable, report, topMechanisms, events };
}

export type CoachPreview = {
  report: WhyReport;
  dominantMechanism: MechanismKey | null;
  quota: { usedToday: number; remaining: number };
};

/**
 * Non-consuming preview for the practice-page Coach panel: why-report,
 * dominant mechanism, and quota state. Does NOT serve or generate a
 * passage and does NOT touch coach_quota.
 */
export const getCoachPreview = createServerFn({ method: "POST" })
  .inputValidator(getCoachSessionSchema)
  .handler(async ({ data }): Promise<CoachPreview> => {
    const context = await loadCoachContext(data.keyboardProfileId, getRequest().headers);
    const today = utcDateString();
    const usedToday = await coachQuotaUsed(db, context.userId, today);
    return {
      report: context.report,
      dominantMechanism: context.topMechanisms[0] ?? null,
      quota: {
        usedToday,
        remaining: Math.max(0, DAILY_COACH_LIMIT - usedToday),
      },
    };
  });

export const getCoachSession = createServerFn({ method: "POST" })
  .inputValidator(getCoachSessionSchema)
  .handler(async ({ data }): Promise<CoachResponse> => {
    const request = getRequest();
    const reviewMode = process.env.COACH_REVIEW_MODE === "true";
    const { userId, fingerTable, report, topMechanisms, events } = await loadCoachContext(
      data.keyboardProfileId,
      request.headers,
    );
    const today = utcDateString();
    const usedToday = await coachQuotaUsed(db, userId, today);
    if (usedToday >= DAILY_COACH_LIMIT) {
      throw new CoachError("QUOTA_EXCEEDED", `daily coach limit reached (${DAILY_COACH_LIMIT})`);
    }
    // The mechanism this session is built around. `topMechanisms` already has
    // `non-alpha` filtered out, so this can differ from `report.mechanisms[0]`
    // — it is returned explicitly so the UI names the same target the passage
    // was generated (and gated) for. Rotates across the top weaknesses so
    // practice isn't the same mechanism every session — the main weakness
    // still dominates (60% of the rotation).
    if (topMechanisms.length === 0) {
      throw new CoachError("INSUFFICIENT_DATA", "not enough typing data yet");
    }
    const targetMechanism = pickTargetMechanism(topMechanisms, usedToday);

    const difficulty = "hard";
    const targetKey = targetKeyFor(topMechanisms, difficulty);
    // Catalog rotation: once a weakness-set has 2+ active variants, serve the
    // least-used one (variety + balanced usage); while fewer exist, generate a
    // new variant so the catalog grows.
    //
    // COACH_FORCE_GENERATION=true (staging test lever only; unset in prod)
    // skips the catalog entirely and always runs the LLM generation path, so
    // the AI pipeline can be exercised repeatedly without waiting for the
    // catalog to drain or resetting the DB.
    const forceGeneration = process.env.COACH_FORCE_GENERATION === "true";
    const [existing, existingCount] = await Promise.all([
      findPassage(db, targetKey, difficulty),
      countActiveForKey(db, targetKey, difficulty),
    ]);
    if (!forceGeneration && existing && existingCount >= 2) {
      let claimed = false;
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as Database;
        claimed = await claimCoachQuota(txDb, userId, today);
        await incrementUsage(txDb, existing.id);
      });
      if (!claimed) {
        throw new CoachError("QUOTA_EXCEEDED", `daily coach limit reached (${DAILY_COACH_LIMIT})`);
      }
      return {
        quota: {
          usedToday: usedToday + 1,
          remaining: Math.max(0, DAILY_COACH_LIMIT - usedToday - 1),
        },
        report,
        targetMechanism,
        reviewMode,
        passage: existing,
      };
    }

    const digest = buildLlmDigest(events);
    const llm = createLlmClient();
    // Verbatim session transcripts are post-MVP — the analysis call gets the
    // why-report plus the digest only, so the three verbatim slots stay empty.
    // COACH_ANALYSIS_THINKING_OFF (staging lever) drops the reasoning mode,
    // cutting the analysis call from ~60-90s to a few seconds — quality
    // tradeoff, so it stays off in prod by default.
    //
    // Review mode: seed the analysis with the topics already used for this
    // weakness-set so the model stops re-suggesting the same theme (the
    // cycling below can only pick from what the model suggests).
    const usedTopics = await listTopicsForTargetKey(db, targetKey);
    const analysisMsgs = buildAnalysisMessages(
      JSON.stringify(report),
      digest,
      ["", "", ""],
      reviewMode ? usedTopics : [],
    );
    const analysisRes = await llm(analysisMsgs, {
      thinkingOff: process.env.COACH_ANALYSIS_THINKING_OFF === "true",
    });
    const analysis = extractJsonObject(analysisRes.content) as {
      suggested_topics?: string[];
      priority_order?: string[];
    };
    // Cycle suggested topics (prefer one unused for this weakness-set) so
    // consecutive generations don't repeat the same theme. In review mode
    // a repeated exact topic is uniquified so a fresh row always inserts.
    const topic = reviewMode
      ? reviewTopic(pickTopic(analysis.suggested_topics ?? [], usedTopics), usedTopics)
      : pickTopic(analysis.suggested_topics ?? [], usedTopics);

    // The gate enforces the same target, so the model gets the exact
    // required trigger rates for it. The word range (staging lever via
    // COACH_WORD_RANGE) is injected too so the model writes to it.
    const wordRange = parseWordRange(process.env.COACH_WORD_RANGE);
    const targets = gateTargetsFor(targetMechanism);
    const requirementsBlock = targets
      ? [
          "REQUIRED TRIGGER MINIMUMS — the quality gate enforces these on your",
          "passage text (measured on the passage you return). Below these, the",
          "passage is rejected:",
          ...Object.entries(targets).map(([k, v]) => `- ${k} >= ${v}`),
          `WORD RANGE: the passage must be between ${wordRange.min} and ${wordRange.max} words.`,
          `Targeted mechanism for this passage: ${targetMechanism}`,
        ].join("\n")
      : `WORD RANGE: the passage must be between ${wordRange.min} and ${wordRange.max} words.\nTargeted mechanism for this passage: ${targetMechanism}`;

    let gateResult: GateResult | undefined;
    let testCase: GeneratedCase | undefined;
    let rawPassageText = "";
    let passageText = "";
    let duplicate = false;
    let lastGenRes: LlmResponse | undefined;
    const generationStartedAt = Date.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      const genMsgs = buildGenerationMessages(analysisRes.content);
      // Retry feedback: gate violations, or a duplicate-text note so the
      // model paraphrases instead of repeating an existing passage.
      const feedback = duplicate
        ? "\nThe previous passage text is identical to an existing passage. Write a DIFFERENT passage (the same topic is fine — paraphrase it)."
        : gateResult?.violations?.length
          ? `\nPrevious attempt was rejected by the gate: ${gateResult.violations.join("; ")}. Rewrite the passage so it passes.`
          : "";
      const userMsg = genMsgs[genMsgs.length - 1];
      if (!userMsg) {
        throw new CoachError("LLM_PROMPT", "generation prompt has no user message");
      }
      userMsg.content += `\n\nWrite the passage on the topic: ${topic}\n\n${requirementsBlock}${feedback}`;
      const genRes = await llm(genMsgs, { thinkingOff: true });
      lastGenRes = genRes;
      const gen = extractJsonObject(genRes.content) as { test_cases?: GeneratedCase[] };
      testCase = gen.test_cases?.[0];
      if (!testCase?.text) {
        throw new CoachError("LLM_PARSE", "generation missing test_cases[0].text");
      }
      rawPassageText = testCase.text;
      gateResult = evaluateGate(targetMechanism, rawPassageText, fingerTable, undefined, wordRange);
      if (!gateResult.passed) {
        duplicate = false;
        continue;
      }
      passageText = normalizePassageText(rawPassageText);
      duplicate = await textExists(db, passageText);
      if (!duplicate) break;
    }
    // A duplicate text is never accepted — a user must not be served the
    // same passage twice, regardless of review mode (the gate is advisory
    // there, the dedup is not).
    if (duplicate) {
      throw new CoachError("LLM_DUPLICATE", "passage text duplicates an existing passage");
    }
    // Review mode treats the gate as advisory: the verdict is stored and
    // shown, but a miss never blocks the owner from typing + annotating.
    if (!reviewMode && !gateResult?.passed) {
      throw new CoachError(
        "GATE_REJECTED",
        `passage failed gate: ${gateResult?.violations.join("; ")}`,
      );
    }
    // The generation loop always assigns gateResult (3 attempts); keep the
    // type narrowed for the code below.
    if (!gateResult) {
      throw new CoachError("GATE_REJECTED", "passage failed gate: no measurement");
    }

    // Paragraph count must be read off the raw text — the normalization
    // below collapses the very blank lines that delimit paragraphs.
    const paragraphs = Math.min((rawPassageText.match(/\n\s*\n/g)?.length ?? 0) + 1, 3);
    // The gate validates the raw multi-paragraph text; the typing engine
    // types character-by-character and cannot type newlines, so the stored
    // passage is normalized to a single line of regular spaces.
    const normalizedPassageText = passageText || normalizePassageText(rawPassageText);

    const passage = {
      title: testCase?.title ?? "Coach passage",
      topic: passageTopicFor(reviewMode, topic, testCase?.topic),
      difficulty,
      mechanisms: topMechanisms,
      triggerTargets: null,
      measuredDensity: gateResult.measured as unknown as Record<string, number>,
      qualityGate: gateResult,
      text: normalizedPassageText,
      wordCount: normalizedPassageText.split(/\s+/).filter(Boolean).length,
      paragraphs,
      source: "ai:deepseek-v4-flash:v6",
      targetKey,
      status: passageStatusFor(reviewMode),
      ...(lastGenRes
        ? { llmOutput: buildLlmOutput(analysisRes, lastGenRes, generationStartedAt) }
        : {}),
    } satisfies Omit<PassageRecord, "id" | "usageCount">;

    let claimed = false;
    const passageId = await db.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      // `insertPassage` returns no row when the unique-key upsert collides
      // with a concurrent insert; fall back to reading the winner's id.
      const inserted = await insertPassage(txDb, passage);
      const existingRow =
        inserted ??
        (await findPassageAny(txDb, passage.targetKey, passage.topic, passage.difficulty));
      if (!existingRow) {
        throw new CoachError("CATALOG_WRITE", "passage insert produced no row");
      }
      const id = existingRow.id;
      claimed = await claimCoachQuota(txDb, userId, today);
      await incrementUsage(txDb, id);
      return id;
    });
    if (!claimed) {
      // Another fetch won the daily slot; the passage stays cached for
      // tomorrow's session.
      throw new CoachError("QUOTA_EXCEEDED", `daily coach limit reached (${DAILY_COACH_LIMIT})`);
    }

    return {
      quota: {
        usedToday: usedToday + 1,
        remaining: Math.max(0, DAILY_COACH_LIMIT - usedToday - 1),
      },
      report,
      targetMechanism,
      reviewMode,
      passage: { ...passage, id: passageId, usageCount: 1, status: passage.status } as PassageRecord,
    };
  });
