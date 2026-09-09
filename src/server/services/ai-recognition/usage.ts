import { isHttpsSourceUrl, type TokenUsage, unknownTokenUsage } from "@/shared/ai-recognition.ts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonNegativeInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return Math.round(value);
}

/** 取得できない使用量は null。0 と記録しない */
export function normalizeTokenUsage(output: unknown): TokenUsage {
  const record = asRecord(output);
  if (!record) {
    return { ...unknownTokenUsage };
  }
  const gemini = asRecord(record.usageMetadata);
  if (gemini) {
    return {
      inputTokens: asNonNegativeInt(gemini.promptTokenCount),
      outputTokens: asNonNegativeInt(gemini.candidatesTokenCount),
      thinkingTokens: asNonNegativeInt(gemini.thoughtsTokenCount),
      searchCount: null,
    };
  }
  const usage = asRecord(record.usage);
  if (usage) {
    return {
      inputTokens: asNonNegativeInt(usage.prompt_tokens ?? usage.input_tokens),
      outputTokens: asNonNegativeInt(usage.completion_tokens ?? usage.output_tokens),
      thinkingTokens: asNonNegativeInt(usage.reasoning_tokens ?? usage.thoughts_tokens),
      searchCount: null,
    };
  }
  return { ...unknownTokenUsage };
}

export function mergeUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
  return {
    inputTokens: addNullable(left.inputTokens, right.inputTokens),
    outputTokens: addNullable(left.outputTokens, right.outputTokens),
    thinkingTokens: addNullable(left.thinkingTokens, right.thinkingTokens),
    searchCount: addNullable(left.searchCount, right.searchCount),
  };
}

function addNullable(left: number | null, right: number | null): number | null {
  if (left === null && right === null) {
    return null;
  }
  return (left ?? 0) + (right ?? 0);
}

export function extractGroundingSources(output: unknown): Array<{ url: string; title?: string }> {
  const record = asRecord(output);
  if (!record) {
    return [];
  }
  const candidates = record.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }
  const first = asRecord(candidates[0]);
  const metadata = first ? asRecord(first.groundingMetadata) : asRecord(record.groundingMetadata);
  const chunks = metadata?.groundingChunks;
  if (!Array.isArray(chunks)) {
    return [];
  }
  const sources: Array<{ url: string; title?: string }> = [];
  for (const chunk of chunks) {
    const row = asRecord(chunk);
    const web = row ? asRecord(row.web) : null;
    const uri = web && typeof web.uri === "string" ? web.uri : null;
    if (!uri || !isHttpsSourceUrl(uri)) {
      continue;
    }
    sources.push({
      url: uri,
      title: web && typeof web.title === "string" ? web.title.slice(0, 200) : undefined,
    });
  }
  return sources;
}
