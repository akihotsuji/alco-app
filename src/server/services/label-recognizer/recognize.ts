import type { AppSqliteDb } from "@/db/index.ts";
import {
  LABEL_EXTRACT_PROMPT_VERSION,
  LABEL_OUTPUT_SCHEMA_VERSION,
} from "@/shared/ai-recognition.ts";
import { AI_RECOGNIZE_DAILY_LIMIT } from "@/shared/constants.ts";
import {
  extractModelPayload,
  pickRecognizeFields,
  type RecognizeResponse,
} from "@/shared/label-recognize.ts";
import { ApiError } from "../../errors.ts";
import { sha256Hex } from "../ai-recognition/bytes.ts";
import { recognitionCacheKey, withRecognitionCache } from "../ai-recognition/cache.ts";
import { inspectRecognizeJpeg } from "../ai-recognition/inspect-jpeg.ts";
import { timeoutMsForRecognizer } from "../ai-recognition/profiles.ts";
import { refundAiUsage, tryConsumeAiUsage } from "../ai-usage.ts";
import type { LabelRecognizer } from "./index.ts";

export class RecognizeTimeoutError extends Error {
  constructor() {
    super("recognize_timeout");
    this.name = "RecognizeTimeoutError";
  }
}

export async function recognizeBottleLabel(input: {
  db: AppSqliteDb;
  userId: string;
  bytes: Uint8Array;
  recognizer: LabelRecognizer;
  now?: Date;
  timeoutMs?: number;
}): Promise<RecognizeResponse> {
  inspectRecognizeJpeg(input.bytes);

  const consumed = await tryConsumeAiUsage({
    db: input.db,
    userId: input.userId,
    now: input.now,
  });
  if (!consumed) {
    throw new ApiError("rate_limited");
  }

  const started = Date.now();
  let ok = false;
  let fieldCount = 0;
  let providerMs = 0;
  let parseMs = 0;
  try {
    const imageHash = await sha256Hex(input.bytes);
    const key = recognitionCacheKey({
      userId: input.userId,
      imageHash,
      profile: input.recognizer.profile,
      modelId: input.recognizer.modelId,
      promptVersion: LABEL_EXTRACT_PROMPT_VERSION,
      schemaVersion: LABEL_OUTPUT_SCHEMA_VERSION,
      searchEnabled: false,
    });
    const fields = await withRecognitionCache(key, async () => {
      const output = await withTimeout(
        input.recognizer.recognize(input.bytes),
        timeoutMsForRecognizer(input.recognizer, input.timeoutMs),
      );
      providerMs = Date.now() - started;
      const parseStarted = Date.now();
      const parsed = pickRecognizeFields(extractModelPayload(output));
      parseMs = Date.now() - parseStarted;
      return parsed;
    });
    fieldCount = Object.keys(fields).length;
    ok = true;
    return {
      fields,
      provider: input.recognizer.provider,
      remainingToday: Math.max(0, AI_RECOGNIZE_DAILY_LIMIT - consumed.count),
    };
  } catch (error) {
    await refundAiUsage({ db: input.db, userId: input.userId, now: input.now });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("upstream_error");
  } finally {
    console.info(
      `[recognize] ok=${ok} durationMs=${Date.now() - started} providerMs=${providerMs} parseMs=${parseMs} fieldCount=${fieldCount}`,
    );
  }
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RecognizeTimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
