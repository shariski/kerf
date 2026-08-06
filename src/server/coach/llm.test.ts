import { describe, expect, it, vi } from "vitest";
import {
  buildAnalysisMessages,
  buildGenerationMessages,
  createLlmClient,
  extractJsonObject,
} from "./llm";

describe("extractJsonObject", () => {
  it("parses bare JSON", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips markdown fences", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("slices surrounding prose", () => {
    expect(extractJsonObject('Here you go: {"a":1} thanks!')).toEqual({ a: 1 });
  });
  it("throws CoachError LLM_PARSE on garbage", () => {
    expect(() => extractJsonObject("no json here")).toThrowError(
      expect.objectContaining({ code: "LLM_PARSE" }),
    );
  });
});

describe("createLlmClient", () => {
  it("throws LLM_CONFIG when no api key and env unset", async () => {
    const client = createLlmClient(fetch, "");
    await expect(client([{ role: "user", content: "hi" }])).rejects.toThrowError(
      expect.objectContaining({ code: "LLM_CONFIG" }),
    );
  });

  it("calls the API and returns parsed content", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });
    const client = createLlmClient(fakeFetch as unknown as typeof fetch, "sk-test");
    const res = await client([{ role: "user", content: "hi" }]);
    expect(res.content).toBe('{"ok":true}');
    expect(res.usage.promptTokens).toBe(10);
    expect(fakeFetch).toHaveBeenCalledWith(
      expect.stringContaining("chat/completions"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("retries on 503 then succeeds", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{}" } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      });
    const client = createLlmClient(fakeFetch as unknown as typeof fetch, "sk-test");
    const res = await client([{ role: "user", content: "hi" }]);
    expect(res.content).toBe("{}");
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it("rejects with CoachError LLM_HTTP when retries are exhausted", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    const client = createLlmClient(fakeFetch as unknown as typeof fetch, "sk-test");
    const promise = client([{ role: "user", content: "hi" }]);
    await expect(promise).rejects.toMatchObject({ code: "LLM_HTTP" });
    expect(fakeFetch).toHaveBeenCalledTimes(4);
  }, 40000);
});

describe("prompt assembly", () => {
  it("builds analysis messages with data substituted", () => {
    const msgs = buildAnalysisMessages('{"total":1}', "digest", ["v1", "v2", "v3"]);
    const user = msgs[1]!.content;
    expect(user).toContain('"total":1');
    expect(user).toContain("digest");
    expect(user).toContain("v1");
    expect(user).toContain("v3");
    expect(msgs[0]!.role).toBe("system");
  });

  it("sends the full V6 system prompt, not an empty string", () => {
    const msgs = buildAnalysisMessages('{"total":1}', "digest", ["v1", "v2", "v3"]);
    expect(msgs[0]!.content.length).toBeGreaterThan(100);
    expect(msgs[0]!.content).toMatch(/\S/);
    expect(msgs[0]!.content).toContain("root_causes");
  });

  it("builds generation messages with the analysis result injected", () => {
    const msgs = buildGenerationMessages('{"root_causes":[]}');
    expect(msgs[1]!.content).toContain('{"root_causes":[]}');
  });
});
