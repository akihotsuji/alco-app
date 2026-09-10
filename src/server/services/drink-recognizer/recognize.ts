import type { AppSqliteDb } from "@/db/index.ts";
import {
  DRINK_EXTRACT_PROMPT_VERSION,
  DRINK_LOOKUP_PROMPT_VERSION,
  DRINK_OUTPUT_SCHEMA_VERSION,
  type RecognizeSource,
} from "@/shared/ai-recognition.ts";
import { AI_RECOGNIZE_DAILY_LIMIT, AI_RECOGNIZE_OVERALL_TIMEOUT_MS } from "@/shared/constants.ts";
import type {
  DrinkLookupFields,
  DrinkLookupRequest,
  DrinkLookupResponse,
  DrinkRecognizeResponse,
} from "@/shared/drink-recognize.ts";
import { normalizeOriginToJa } from "@/shared/origin-countries.ts";
import { ApiError } from "../../errors.ts";
import { sha256Hex } from "../ai-recognition/bytes.ts";
import {
  type DrinkCacheValue,
  type DrinkLookupCacheValue,
  recognitionCacheKey,
  withRecognitionCache,
} from "../ai-recognition/cache.ts";
import { isRecognizerConfigured } from "../ai-recognition/create-recognizer.ts";
import {
  needsProductLookup,
  parseDrinkExtract,
  parseDrinkLookup,
  selectDrinkAutofillFields,
  selectOriginCandidate,
  summarizeDrinkParse,
} from "../ai-recognition/drink-extract.ts";
import { summarizeAiError } from "../ai-recognition/error-summary.ts";
import { inspectRecognizeJpeg } from "../ai-recognition/inspect-jpeg.ts";
import {
  MODEL_PROFILES,
  type ModelProfile,
  RecognitionConfigError,
  readAiRecognizeDailyLimit,
} from "../ai-recognition/profiles.ts";
import { normalizeTokenUsage } from "../ai-recognition/usage.ts";
import { refundAiUsage, tryConsumeAiUsage } from "../ai-usage.ts";
import type { LabelRecognizer } from "../label-recognizer/index.ts";
import { RecognizeTimeoutError } from "../label-recognizer/recognize.ts";
import type { DrinkLookupRunner } from "./lookup-runner.ts";

/**
 * 二段階の前半（spec/features/ai-recognition.md 7a）。画像から抽出だけして返す。
 * 照合（検索）は待たず、`lookupSuggested` でクライアントに後追いを勧める。
 */
export async function recognizeDrinkPhoto(input: {
  db: AppSqliteDb;
  userId: string;
  bytes: Uint8Array;
  recognizer: LabelRecognizer;
  env?: object;
  now?: Date;
  timeoutMs?: number;
  dailyLimit?: number;
}): Promise<DrinkRecognizeResponse> {
  inspectRecognizeJpeg(input.bytes);
  if (!isRecognizerConfigured(input.recognizer)) {
    throw new ApiError("misconfigured");
  }

  const dailyLimit = input.dailyLimit ?? AI_RECOGNIZE_DAILY_LIMIT;
  const consumed = await tryConsumeAiUsage({
    db: input.db,
    userId: input.userId,
    now: input.now,
    limit: dailyLimit,
  });
  if (!consumed) {
    throw new ApiError("rate_limited");
  }

  const started = Date.now();
  let ok = false;
  let fieldCount = 0;
  let lookupSuggested = false;
  let failReason = "";
  try {
    const result = await runDrinkRecognition(input);
    fieldCount = Object.keys(result.fields).length;
    ok = true;
    lookupSuggested = result.lookupSuggested;
    return {
      fields: result.fields,
      provider: result.provider,
      remainingToday: Math.max(0, dailyLimit - consumed.count),
      profile: result.profile,
      modelId: result.modelId,
      durationMs: Date.now() - started,
      usage: result.usage,
      sources: result.sources,
      searchUsed: false,
      lookupSuggested: result.lookupSuggested,
      ...(result.originCandidate ? { originCandidate: result.originCandidate } : {}),
      ...(result.appellation ? { appellation: result.appellation.slice(0, 100) } : {}),
    };
  } catch (error) {
    failReason = summarizeAiError(error);
    await refundAiUsage({ db: input.db, userId: input.userId, now: input.now });
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof RecognitionConfigError) {
      throw new ApiError("misconfigured");
    }
    throw new ApiError("upstream_error");
  } finally {
    console.info(
      `[drink-recognize] ok=${ok} durationMs=${Date.now() - started} fieldCount=${fieldCount} lookupSuggested=${lookupSuggested} profile=${input.recognizer.profile} reason=${failReason || "-"}`,
    );
  }
}

async function runDrinkRecognition(input: {
  userId: string;
  bytes: Uint8Array;
  recognizer: LabelRecognizer;
  timeoutMs?: number;
}): Promise<DrinkCacheValue> {
  const profile = MODEL_PROFILES[input.recognizer.profile as keyof typeof MODEL_PROFILES];
  const searchEnabled = Boolean(profile?.supportsSearch);
  const imageHash = await sha256Hex(input.bytes);
  const key = recognitionCacheKey({
    userId: input.userId,
    imageHash,
    profile: input.recognizer.profile,
    modelId: input.recognizer.modelId,
    promptVersion: DRINK_EXTRACT_PROMPT_VERSION,
    schemaVersion: DRINK_OUTPUT_SCHEMA_VERSION,
    searchEnabled,
  });
  return withRecognitionCache(key, () => executeDrinkExtraction(input, profile));
}

async function executeDrinkExtraction(
  input: {
    bytes: Uint8Array;
    recognizer: LabelRecognizer;
    timeoutMs?: number;
  },
  profile: ModelProfile | undefined,
): Promise<DrinkCacheValue> {
  const overallMs = input.timeoutMs ?? profile?.timeoutMs ?? AI_RECOGNIZE_OVERALL_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), overallMs);
  try {
    const extractRaw = await withAbort(
      input.recognizer.recognize(input.bytes, { signal: controller.signal }),
      controller.signal,
    );
    const extract = parseDrinkExtract(extractRaw);
    const selected = selectDrinkAutofillFields(extract, null);
    console.info(
      `[drink-recognize] parse ${summarizeDrinkParse(extractRaw, extract, selected.fields)}`,
    );
    const lookupSuggested =
      profile?.supportsSearch === true &&
      profile.requestFormat === "gemini-generate-content" &&
      needsProductLookup(selected.fields);
    const originCandidate = selectOriginCandidate(extract, selected.fields);

    return {
      fields: selected.fields,
      sources: selected.sources,
      usage: normalizeTokenUsage(extractRaw),
      searchUsed: false,
      profile: input.recognizer.profile,
      modelId: input.recognizer.modelId,
      provider: input.recognizer.provider,
      lookupSuggested,
      originCandidate,
      appellation: extract.appellation,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 二段階の後半。抽出で得た品名・生産者から国・品種だけを検索で照合する。
 * 日次上限を 1 回消費する（無制限ループ防止）。検索非対応の設定では消費せず matched=false。
 */
export async function lookupDrinkProduct(input: {
  db: AppSqliteDb;
  userId: string;
  request: DrinkLookupRequest;
  runner: DrinkLookupRunner;
  now?: Date;
  timeoutMs?: number;
  dailyLimit?: number;
}): Promise<DrinkLookupResponse> {
  if (!isRecognizerConfigured(input.runner)) {
    throw new ApiError("misconfigured");
  }
  const dailyLimit = input.dailyLimit ?? AI_RECOGNIZE_DAILY_LIMIT;
  const started = Date.now();
  const meta = {
    provider: input.runner.provider,
    profile: input.runner.profile,
    modelId: input.runner.modelId,
  };

  if (!input.runner.supportsSearch) {
    console.info(
      `[drink-lookup] ok=true durationMs=0 matched=false profile=${meta.profile} reason=search_unsupported`,
    );
    return {
      fields: {},
      matched: false,
      ...meta,
      remainingToday: dailyLimit,
      durationMs: 0,
      usage: { inputTokens: null, outputTokens: null, thinkingTokens: null, searchCount: null },
      sources: [],
      searchUsed: false,
    };
  }

  const consumed = await tryConsumeAiUsage({
    db: input.db,
    userId: input.userId,
    now: input.now,
    limit: dailyLimit,
  });
  if (!consumed) {
    throw new ApiError("rate_limited");
  }

  let ok = false;
  let matched = false;
  let failReason = "";
  try {
    const result = await runDrinkLookup(input);
    ok = true;
    matched = result.matched;
    return {
      fields: result.fields,
      matched: result.matched,
      ...meta,
      remainingToday: Math.max(0, dailyLimit - consumed.count),
      durationMs: Date.now() - started,
      usage: result.usage,
      sources: result.sources,
      searchUsed: result.searchUsed,
    };
  } catch (error) {
    failReason = summarizeAiError(error);
    await refundAiUsage({ db: input.db, userId: input.userId, now: input.now });
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof RecognitionConfigError) {
      throw new ApiError("misconfigured");
    }
    throw new ApiError("upstream_error");
  } finally {
    console.info(
      `[drink-lookup] ok=${ok} durationMs=${Date.now() - started} matched=${matched} profile=${meta.profile} reason=${failReason || "-"}`,
    );
  }
}

function lookupCacheImageHash(request: DrinkLookupRequest): string {
  return [
    request.drinkName.toLowerCase(),
    request.producer.toLowerCase(),
    request.vintage ?? "",
    request.drinkType ?? "",
    (request.appellation ?? "").toLowerCase(),
  ].join("\u0000");
}

async function runDrinkLookup(input: {
  userId: string;
  request: DrinkLookupRequest;
  runner: DrinkLookupRunner;
  timeoutMs?: number;
}): Promise<DrinkLookupCacheValue> {
  const key = recognitionCacheKey({
    userId: input.userId,
    imageHash: await sha256Hex(new TextEncoder().encode(lookupCacheImageHash(input.request))),
    profile: input.runner.profile,
    modelId: input.runner.modelId,
    promptVersion: DRINK_LOOKUP_PROMPT_VERSION,
    schemaVersion: DRINK_OUTPUT_SCHEMA_VERSION,
    searchEnabled: true,
  });
  return withRecognitionCache(key, () => executeDrinkLookup(input));
}

async function executeDrinkLookup(input: {
  request: DrinkLookupRequest;
  runner: DrinkLookupRunner;
  timeoutMs?: number;
}): Promise<DrinkLookupCacheValue> {
  const budgetMs = input.timeoutMs ?? input.runner.timeoutMs;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    const result = await withAbort(
      input.runner.lookup(input.request, { signal: controller.signal }),
      controller.signal,
    );
    const parsed = parseDrinkLookup(result.payload, result.sources);
    const fields: DrinkLookupFields = {};
    const sources: RecognizeSource[] = [];
    if (parsed.matched) {
      if (parsed.origin) {
        const ja = normalizeOriginToJa(parsed.origin);
        if (ja) {
          fields.origin = { value: ja, confidence: 0.8 };
          sources.push(
            ...parsed.sources.filter((item) => (item.supports ?? ["origin"]).includes("origin")),
          );
        }
      }
      if (parsed.variety) {
        fields.variety = { value: parsed.variety, confidence: 0.8 };
        sources.push(
          ...parsed.sources.filter((item) => (item.supports ?? ["variety"]).includes("variety")),
        );
      }
    }
    return {
      fields,
      matched: parsed.matched && Object.keys(fields).length > 0,
      sources,
      usage: result.usage,
      searchUsed: result.searchUsed,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    throw new RecognizeTimeoutError();
  }
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(new RecognizeTimeoutError()), { once: true });
    }),
  ]);
}

export function readDailyLimitFromEnv(env: object | undefined): number {
  if (!env) {
    return AI_RECOGNIZE_DAILY_LIMIT;
  }
  try {
    return readAiRecognizeDailyLimit(env, AI_RECOGNIZE_DAILY_LIMIT);
  } catch {
    return AI_RECOGNIZE_DAILY_LIMIT;
  }
}
