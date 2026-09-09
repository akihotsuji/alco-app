import { AI_RECOGNIZE_RETRY_LIMIT } from "@/shared/constants.ts";
import type { RecognitionAdapter } from "./adapter.ts";
import { bytesToBase64 } from "./bytes.ts";
import { type ModelProfile, RecognitionConfigError } from "./profiles.ts";
import { extractGroundingSources, normalizeTokenUsage } from "./usage.ts";

type GeminiPart = Record<string, unknown>;

export function createGeminiGatewayAdapter(ai: Ai): RecognitionAdapter {
  return {
    async invoke(request) {
      if (request.profile.requestFormat !== "gemini-generate-content") {
        throw new RecognitionConfigError("unknown_profile", request.profile.key);
      }
      if (request.search && !request.profile.supportsSearch) {
        throw new RecognitionConfigError("unknown_profile", "search_unsupported");
      }
      const body = buildGeminiBody(request);
      const options = {
        gateway: {
          id: request.gatewayId,
          skipCache: true,
          collectLog: request.collectLog,
        },
      };
      const raw = await runWithRetry(
        () => ai.run(request.profile.modelId, body, options),
        request.signal,
        request.profile,
      );
      return {
        payload: raw,
        raw,
        usage: normalizeTokenUsage(raw),
        sources: extractGroundingSources(raw),
        searchUsed: request.search,
      };
    },
  };
}

function buildGeminiBody(request: {
  profile: ModelProfile;
  jpegBytes?: Uint8Array;
  systemPrompt: string;
  userPrompt: string;
  schema: Record<string, unknown>;
  search: boolean;
  kind: "extract" | "lookup";
}): Record<string, unknown> {
  const parts: GeminiPart[] = [{ text: request.userPrompt }];
  if (request.jpegBytes) {
    parts.unshift({
      inlineData: {
        mimeType: "image/jpeg",
        data: bytesToBase64(request.jpegBytes),
      },
    });
  }
  const generationConfig: Record<string, unknown> = {
    temperature: request.profile.temperature,
    maxOutputTokens:
      request.kind === "lookup"
        ? request.profile.lookupMaxOutputTokens
        : request.profile.maxOutputTokens,
  };
  if (request.profile.supportsStructuredOutput) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = request.schema;
  }
  if (
    request.profile.emitThinkingConfig &&
    request.profile.supportsThinking &&
    request.profile.thinkingLevel
  ) {
    generationConfig.thinkingConfig = { thinkingLevel: request.profile.thinkingLevel };
  }
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts }],
    systemInstruction: { parts: [{ text: request.systemPrompt }] },
    generationConfig,
  };
  if (request.search && request.profile.supportsSearch) {
    body.tools = [{ googleSearch: {} }];
  }
  return body;
}

async function runWithRetry(
  run: () => Promise<unknown>,
  signal: AbortSignal | undefined,
  profile: ModelProfile,
): Promise<unknown> {
  let lastError: unknown;
  const attempts = AI_RECOGNIZE_RETRY_LIMIT + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    throwIfAborted(signal);
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (signal?.aborted || !isRetryable(error) || attempt >= AI_RECOGNIZE_RETRY_LIMIT) {
        throw error;
      }
      await delay(Math.min(400 * 2 ** attempt, profile.timeoutMs / 4), signal);
    }
  }
  throw lastError;
}

function isRetryable(error: unknown): boolean {
  const status = readStatus(error);
  return status === 429 || (status !== null && status >= 500);
}

function readStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const status = Reflect.get(error, "status");
  return typeof status === "number" ? status : null;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw abortError();
  }
}

function abortError(): Error {
  const error = new Error("aborted");
  error.name = "AbortError";
  return error;
}
