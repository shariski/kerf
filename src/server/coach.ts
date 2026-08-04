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
  targetKeyFor, findPassage, insertPassage, incrementUsage, countActiveForKey,
  type PassageRecord,
} from "./coach/catalog";
import {
  coachQuotaUsed, incrementQuota, DAILY_COACH_LIMIT, utcDateString,
} from "./coach/quota";
import {
  createLlmClient, buildAnalysisMessages, buildGenerationMessages,
  extractJsonObject, CoachError,
} from "./coach/llm";

const RECENT_SESSION_LIMIT = 50;
const TOP_MECHANISMS = 3;

export const getCoachSessionSchema = z.object({
  keyboardProfileId: z.string().uuid(),
});

type CoachResponse = {
  quota: { usedToday: number; remaining: number };
  report: WhyReport;
  passage: PassageRecord;
};

function fingerTableFor(layout: KeyboardLayout): FingerTable {
  return layout === "sofle" ? SOFLE_BASE_LAYER : LILY58_BASE_LAYER;
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
    (charMs.get(e.targetChar) ?? charMs.set(e.targetChar, []).get(e.targetChar)!).push(e.keystrokeMs);
    if (e.prevChar) {
      const bg = e.prevChar + e.targetChar;
      bgAttempts.set(bg, (bgAttempts.get(bg) ?? 0) + 1);
      if (e.isError) bgErrors.set(bg, (bgErrors.get(bg) ?? 0) + 1);
      (bgMs.get(bg) ?? bgMs.set(bg, []).get(bg)!).push(e.keystrokeMs);
    }
    if (e.isError && e.actualChar !== e.targetChar) {
      const k = `${e.targetChar}->${e.actualChar}`;
      confusions.set(k, (confusions.get(k) ?? 0) + 1);
    }
  }

  const avg = (ms: number[]) => (ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : 0);
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
    const { userId, fingerTable, report, topMechanisms, events } = await loadCoachContext(
      data.keyboardProfileId,
      request.headers,
    );
    if (topMechanisms.length === 0) {
      throw new CoachError("INSUFFICIENT_DATA", "not enough typing data yet");
    }

    const today = utcDateString();
    const usedToday = await coachQuotaUsed(db, userId, today);
    if (usedToday >= DAILY_COACH_LIMIT) {
      throw new CoachError("QUOTA_EXCEEDED", `daily coach limit reached (${DAILY_COACH_LIMIT})`);
    }

    const difficulty = "hard";
    const targetKey = targetKeyFor(topMechanisms, difficulty);
    // Catalog rotation: once a weakness-set has 2+ active variants, serve the
    // least-used one (variety + balanced usage); while fewer exist, generate a
    // new variant so the catalog grows.
    const [existing, existingCount] = await Promise.all([
      findPassage(db, targetKey, difficulty),
      countActiveForKey(db, targetKey, difficulty),
    ]);
    if (existing && existingCount >= 2) {
      await db.transaction(async (tx) => {
        const txDb = tx as unknown as Database;
        await incrementUsage(txDb, existing.id);
        await incrementQuota(txDb, userId, today);
      });
      return {
        quota: { usedToday: usedToday + 1, remaining: 0 },
        report,
        passage: existing,
      };
    }

    const digest = buildLlmDigest(events);
    const llm = createLlmClient();
    const analysisMsgs = buildAnalysisMessages(
      JSON.stringify(report),
      digest,
      [
        events.slice(0, 305),
        [],
        [],
      ].map(() => ""), // verbatim sessions are post-MVP; analysis call gets digest + report only
    );
    const analysisRes = await llm(analysisMsgs);
    const analysis = extractJsonObject(analysisRes.content) as {
      suggested_topics?: string[];
      priority_order?: string[];
    };
    const topic = analysis.suggested_topics?.[0] ?? "general knowledge";

    // The passage always targets the priority mechanism (hard passage).
    // The gate enforces it too, so the model gets the exact required rates.
    const targetMechanism = topMechanisms[0]!;
    const targets = gateTargetsFor(targetMechanism);
    const requirementsBlock = targets
      ? [
          "REQUIRED TRIGGER MINIMUMS — the quality gate enforces these on your",
          "passage text (measured on the passage you return). Below these, the",
          "passage is rejected:",
          ...Object.entries(targets).map(([k, v]) => `- ${k} >= ${v}`),
          `Targeted mechanism for this passage: ${targetMechanism}`,
        ].join("\n")
      : `Targeted mechanism for this passage: ${targetMechanism}`;

    let gateResult: GateResult | undefined;
    let passageText = "";
    let generationRaw = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const genMsgs = buildGenerationMessages(analysisRes.content);
      const feedback = gateResult?.violations?.length
        ? `\nPrevious attempt was rejected by the gate: ${gateResult.violations.join("; ")}. Rewrite the passage so it passes.`
        : "";
      genMsgs[genMsgs.length - 1]!.content += `\n\n${requirementsBlock}${feedback}`;
      const genRes = await llm(genMsgs, { thinkingOff: true });
      generationRaw = genRes.content;
      const gen = extractJsonObject(generationRaw) as {
        test_cases?: { mechanism?: string; title?: string; topic?: string; text?: string }[];
      };
      const tc = gen.test_cases?.[0];
      if (!tc?.text) throw new CoachError("LLM_PARSE", "generation missing test_cases[0].text");
      passageText = tc.text;
      gateResult = evaluateGate(targetMechanism, passageText, fingerTable);
      if (gateResult.passed) break;
    }
    if (!gateResult?.passed) {
      throw new CoachError("GATE_REJECTED", `passage failed gate: ${gateResult?.violations.join("; ")}`);
    }
    // The gate validates the raw multi-paragraph text; the typing engine
    // types character-by-character and cannot type newlines, so the stored
    // passage is normalized to a single line of regular spaces.
    passageText = normalizePassageText(passageText);

    const parsed = extractJsonObject(generationRaw) as {
      test_cases?: { mechanism?: string; title?: string; topic?: string; text?: string }[];
    };
    const tc = parsed.test_cases?.[0];
    const passage = {
      title: tc?.title ?? "Coach passage",
      topic: tc?.topic ?? topic,
      difficulty,
      mechanisms: topMechanisms,
      triggerTargets: null,
      measuredDensity: gateResult.measured as unknown as Record<string, number>,
      qualityGate: gateResult,
      text: passageText,
      wordCount: passageText.split(/\s+/).filter(Boolean).length,
      paragraphs: Math.min((passageText.match(/\n\n/g)?.length ?? 0) + 1, 3),
      source: "ai:deepseek-v4-flash:v6",
      targetKey,
    } satisfies Omit<PassageRecord, "id" | "usageCount" | "status">;

    const passageId = await db.transaction(async (tx) => {
      const txDb = tx as unknown as Database;
      const inserted = await insertPassage(txDb, passage);
      const id =
        inserted?.id ??
        (await findPassage(txDb, passage.targetKey, passage.difficulty))!.id;
      await incrementQuota(txDb, userId, today);
      await incrementUsage(txDb, id);
      return id;
    });

    return {
      quota: { usedToday: usedToday + 1, remaining: 0 },
      report,
      passage: { ...passage, id: passageId, usageCount: 1, status: "active" } as PassageRecord,
    };
  });

export function coachErrorStatus(code: string): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "QUOTA_EXCEEDED":
      return 402;
    case "INSUFFICIENT_DATA":
      return 422;
    default:
      return 503;
  }
}
