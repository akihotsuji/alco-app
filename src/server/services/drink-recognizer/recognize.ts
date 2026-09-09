import {
  DRINK_EXTRACT_PROMPT_VERSION,
  DRINK_LOOKUP_PROMPT_VERSION,
  DRINK_OUTPUT_SCHEMA_VERSION,
  type RecognizeSource,
  type TokenUsage,
} from "@/shared/ai-recognition.ts";
import { AI_RECOGNIZE_DAILY_LIMIT, AI_RECOGNIZE_OVERALL_TIMEOUT_MS } from "@/shared/constants.ts";
import type { DrinkRecognizeFields, DrinkRecognizeResponse } from "@/shared/drink-recognize.ts";
import type { AppSqliteDb } from "@/db/index.ts";
import { ApiError } from "../../errors.ts";
import { refundAiUsage, tryConsumeAiUsage } from "../ai-usage.ts";
import type { RecognitionAdapter } from "../ai-recognition/adapter.ts";
import { sha256Hex } from "../ai-recognition/bytes.ts";
import {
  type DrinkCacheValue,
  getCachedRecognition,
  getInflightRecognition,
  recognitionCacheKey,
  setCachedRecognition,
  setInflightRecognition,
} from "../ai-recognition/cache.ts";
import { isRecognizerConfigured } from "../ai-recognition/create-recognizer.ts";
import {
  DRINK_LOOKUP_GEMINI_SCHEMA,
  DRINK_LOOKUP_SYSTEM_PROMPT,
  drinkLookupUserPrompt,
  needsProductLookup,
  parseDrinkExtract,
  parseDrinkLookup,
  selectDrinkAutofillFields,
} from "../ai-recognition/drink-extract.ts";
import { createAdapterForProfile } from "../ai-recognition/factory.ts";
import {
  MODEL_PROFILES,
  readAiRecognizeDailyLimit,
  readGatewayCollectLog,
  readGatewayId,
  RecognitionConfigError,
  type ModelProfile,
} from "../ai-recognition/profiles.ts";
import { mergeUsage, normalizeTokenUsage } from "../ai-recognition/usage.ts";
import { ImageInspectFailure, inspectImageBytes } from "../image-inspect.ts";
import type { LabelRecognizer } from "../label-recognizer/index.ts";
import { RecognizeTimeoutError } from "../label-recognizer/recognize.ts";

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
  let searchUsed = false;
  try {
    const result = await runDrinkRecognition(input);
    fieldCount = Object.keys(result.fields).length;
    ok = true;
    searchUsed = result.searchUsed;
    return {
      fields: result.fields,
      provider: result.provider,
      remainingToday: Math.max(0, dailyLimit - consumed.count),
      profile: result.profile,
      modelId: result.modelId,
      durationMs: Date.now() - started,
      usage: result.usage,
      sources: result.sources,
      searchUsed: result.searchUsed,
    };
  } catch (error) {
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
      `[drink-recognize] ok=${ok} durationMs=${Date.now() - started} fieldCount=${fieldCount} searchUsed=${searchUsed} profile=${input.recognizer.profile}`,
    );
  }
}

async function runDrinkRecognition(input: {
  userId: string;
  bytes: Uint8Array;
  recognizer: LabelRecognizer;
  env?: object;
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
    promptVersion: `${DRINK_EXTRACT_PROMPT_VERSION}+${DRINK_LOOKUP_PROMPT_VERSION}`,
    schemaVersion: DRINK_OUTPUT_SCHEMA_VERSION,
    searchEnabled,
  });
  const cached = getCachedRecognition(key);
  if (cached) {
    return cached;
  }
  const pending = getInflightRecognition(key);
  if (pending) {
    return pending;
  }
  const promise = executeDrinkRecognition(input, profile);
  setInflightRecognition(key, promise);
  const value = await promise;
  setCachedRecognition(key, value);
  return value;
}

async function executeDrinkRecognition(
  input: {
    bytes: Uint8Array;
    recognizer: LabelRecognizer;
    env?: object;
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
    let selected = selectDrinkAutofillFields(extract, null);
    let usage = normalizeTokenUsage(extractRaw);
    let searchUsed = false;
    let sources: RecognizeSource[] = selected.sources;

    const canLookup =
      profile?.supportsSearch === true &&
      profile.requestFormat === "gemini-generate-content" &&
      input.env !== undefined &&
      needsProductLookup(selected.fields);

    if (canLookup && input.env && profile) {
      try {
        const lookup = await runLookup({
          env: input.env,
          profile,
          fields: selected.fields,
          signal: controller.signal,
        });
        usage = mergeUsage(usage, lookup.usage);
        searchUsed = lookup.searchUsed;
        selected = selectDrinkAutofillFields(extract, lookup.parsed);
        sources = selected.sources;
      } catch (error) {
        if (controller.signal.aborted) {
          throw new RecognizeTimeoutError();
        }
        if (error instanceof RecognitionConfigError) {
          throw error;
        }
        console.info("[drink-recognize] lookup_skipped");
      }
    }

    return {
      fields: selected.fields,
      sources,
      usage,
      searchUsed,
      profile: input.recognizer.profile,
      modelId: input.recognizer.modelId,
      provider: input.recognizer.provider,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runLookup(input: {
  env: object;
  profile: ModelProfile;
  fields: DrinkRecognizeFields;
  signal: AbortSignal;
}): Promise<{
  parsed: ReturnType<typeof parseDrinkLookup>;
  usage: TokenUsage;
  searchUsed: boolean;
}> {
  const adapter: RecognitionAdapter = createAdapterForProfile(input.env, input.profile);
  const result = await adapter.invoke({
    profile: input.profile,
    kind: "lookup",
    systemPrompt: DRINK_LOOKUP_SYSTEM_PROMPT,
    userPrompt: drinkLookupUserPrompt({
      drinkName: input.fields.drinkName?.value ?? "",
      producer: input.fields.producer?.value ?? "",
      vintage: input.fields.vintage?.value,
      drinkType: input.fields.drinkType?.value,
    }),
    schema: DRINK_LOOKUP_GEMINI_SCHEMA as Record<string, unknown>,
    search: true,
    signal: input.signal,
    gatewayId: readGatewayId(input.env),
    collectLog: readGatewayCollectLog(input.env),
  });
  return {
    parsed: parseDrinkLookup(result.payload, result.sources),
    usage: result.usage,
    searchUsed: result.searchUsed,
  };
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

function inspectRecognizeJpeg(bytes: Uint8Array) {
  try {
    const inspected = inspectImageBytes(bytes);
    if (inspected.contentType !== "image/jpeg") {
      throw new ApiError("unsupported_media_type");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof ImageInspectFailure) {
      if (error.code === "payload_too_large") {
        throw new ApiError("payload_too_large");
      }
      if (error.code === "unsupported_media_type") {
        throw new ApiError("unsupported_media_type");
      }
      throw new ApiError("validation_error", {
        fields: { file: ["画像のサイズが大きすぎます"] },
      });
    }
    throw error;
  }
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
