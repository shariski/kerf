import analysisPrompt from "./prompts/analysis.md?raw";
import generationPrompt from "./prompts/generation.md?raw";

export class CoachError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type LlmResponse = {
  content: string;
  usage: { promptTokens: number; completionTokens: number };
};

export type LlmClient = (
  messages: { role: "system" | "user"; content: string }[],
  opts?: { thinkingOff?: boolean; maxTokens?: number },
) => Promise<LlmResponse>;

const PROMPTS: Record<"analysis.md" | "generation.md", string> = {
  "analysis.md": analysisPrompt,
  "generation.md": generationPrompt,
};

function loadPromptFile(name: "analysis.md" | "generation.md"): string {
  return PROMPTS[name];
}

function parsePromptFile(text: string): { system: string; user: string } {
  const parts = text.split("\n## system\n");
  if (parts.length < 2) throw new CoachError("LLM_PROMPT", `bad prompt file: ${text.slice(0, 40)}`);
  const rest = parts[1] ?? "";
  const userParts = rest.split("\n## user\n");
  if (userParts.length < 2) throw new CoachError("LLM_PROMPT", "bad prompt file: no user section");
  return { system: (userParts[0] ?? "").trim(), user: (userParts[1] ?? "").trim() };
}

export function buildAnalysisMessages(
  whyReportJson: string,
  digest: string,
  verbatim: string[],
): { role: "system" | "user"; content: string }[] {
  const { system, user } = parsePromptFile(loadPromptFile("analysis.md"));
  let content = user.replace("<WHY_REPORT>", whyReportJson).replace("<DIGEST>", digest);
  for (let i = 0; i < 3; i++) {
    content = content.replace(`<VERBATIM_${i + 1}>`, verbatim[i] ?? "");
  }
  return [
    { role: "system", content: system },
    { role: "user", content },
  ];
}

export function buildGenerationMessages(
  analysisContent: string,
): { role: "system" | "user"; content: string }[] {
  const { system, user } = parsePromptFile(loadPromptFile("generation.md"));
  return [
    { role: "system", content: system },
    { role: "user", content: user.replace("<ROOT_CAUSE_RESULT>", analysisContent) },
  ];
}

export function extractJsonObject(content: string): unknown {
  let c = content.trim();
  if (c.startsWith("```")) {
    c = c.replace(/^```(?:json)?\s*|\s*```$/g, "");
  }
  const start = c.indexOf("{");
  const end = c.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new CoachError("LLM_PARSE", `no JSON object in content: ${c.slice(0, 120)}`);
  }
  try {
    return JSON.parse(c.slice(start, end + 1));
  } catch {
    throw new CoachError("LLM_PARSE", `invalid JSON: ${c.slice(start, end + 1).slice(0, 120)}`);
  }
}

const DEFAULT_MODEL = "deepseek-v4-flash";
const DEFAULT_BASE_URL = "https://api.deepseek.com/v1/chat/completions";

export function createLlmClient(fetchImpl: typeof fetch = fetch, apiKey?: string): LlmClient {
  const key = apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
  if (!key) {
    return async () => {
      throw new CoachError("LLM_CONFIG", "DEEPSEEK_API_KEY is not set");
    };
  }
  const model = process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL;

  return async (messages, opts = {}) => {
    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: 0.3,
      max_tokens: opts.maxTokens ?? 16000,
      response_format: { type: "json_object" },
    };
    if (opts.thinkingOff) body.thinking = { type: "disabled" };

    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetchImpl(baseUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(300_000),
        });
        if (!res.ok) {
          if (res.status === 429 || res.status >= 500) {
            lastError = new CoachError(
              "LLM_HTTP",
              `DeepSeek unavailable after retries (status ${res.status})`,
            );
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
            }
            continue;
          }
          throw new CoachError("LLM_HTTP", `DeepSeek HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          choices: { message: { content: string } }[];
          usage: { prompt_tokens: number; completion_tokens: number };
        };
        const content = data.choices[0]?.message?.content ?? "";
        if (!content) {
          throw new CoachError("LLM_EMPTY", "empty content from model (reasoning budget?)");
        }
        return {
          content,
          usage: {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          },
        };
      } catch (e) {
        if (
          e instanceof CoachError &&
          e.code === "LLM_HTTP" &&
          e.message.startsWith("DeepSeek HTTP 5")
        ) {
          lastError = e;
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  };
}
