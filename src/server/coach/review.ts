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
