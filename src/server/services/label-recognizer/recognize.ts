import type { AppSqliteDb } from "@/db/index.ts";
import {
  LABEL_EXTRACT_PROMPT_VERSION,
  LABEL_OUTPUT_SCHEMA_VERSION,
} from "@/shared/ai-recognition.ts";
import { AI_RECOGNIZE_DAILY_LIMIT } from "@/shared/constants.ts";
import {
  extractModelPayload,
  pickRecognizeFields,
  type RecognizeFields,
  type RecognizeResponse,
} from "@/shared/label-recognize.ts";
import { ApiError } from "../../errors.ts";
import { sha256Hex } from "../ai-recognition/bytes.ts";
import { recognitionCacheKey, withRecognitionCache } from "../ai-recognition/cache.ts";
import { summarizeAiError } from "../ai-recognition/error-summary.ts";
import { inspectRecognizeJpeg } from "../ai-recognition/inspect-jpeg.ts";
import { timeoutMsForRecognizer } from "../ai-recognition/profiles.ts";
import { normalizeTokenUsage, readFinishReason } from "../ai-recognition/usage.ts";
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
  /** 裏面（任意）。表面と同じ検証を通し、同じ 1 回の呼び出しに渡す。回数は 1 回。 */
  backBytes?: Uint8Array;
  recognizer: LabelRecognizer;
  now?: Date;
  timeoutMs?: number;
}): Promise<RecognizeResponse> {
  inspectRecognizeJpeg(input.bytes);
  if (input.backBytes) {
    inspectRecognizeJpeg(input.backBytes);
  }

  const consumed = await tryConsumeAiUsage({
    db: input.db,
    userId: input.userId,
    now: input.now,
  });
  if (!consumed) {
    throw new ApiError("rate_limited");
  }

  const started = Date.now();
  const images = input.backBytes ? 2 : 1;
  let ok = false;
  let fieldCount = 0;
  let providerMs = 0;
  let parseMs = 0;
  let failReason = "";
  try {
    // 表 1 枚と表 + 裏でキーが衝突しないよう、裏面があるときだけハッシュを連結する。
    const imageHash = input.backBytes
      ? `${await sha256Hex(input.bytes)}+${await sha256Hex(input.backBytes)}`
      : await sha256Hex(input.bytes);
    const key = recognitionCacheKey({
      userId: input.userId,
      imageHash,
      profile: input.recognizer.profile,
      modelId: input.recognizer.modelId,
      promptVersion: LABEL_EXTRACT_PROMPT_VERSION,
      schemaVersion: LABEL_OUTPUT_SCHEMA_VERSION,
      searchEnabled: false,
    });
    const fields = await withRecognitionCache(
      key,
      async () => {
        const output = await withTimeout(
          (signal) =>
            input.recognizer.recognize(input.bytes, {
              backJpegBytes: input.backBytes,
              signal,
            }),
          timeoutMsForRecognizer(input.recognizer, input.timeoutMs, { multiImage: images > 1 }),
        );
        providerMs = Date.now() - started;
        const parseStarted = Date.now();
        const payload = extractModelPayload(output);
        const parsed = pickRecognizeFields(payload);
        parseMs = Date.now() - parseStarted;
        console.info(`[recognize] parse ${summarizeLabelParse(output, payload, parsed, images)}`);
        return parsed;
      },
      { shouldCache: (value) => Object.keys(value).length > 0 },
    );
    fieldCount = Object.keys(fields).length;
    ok = true;
    return {
      fields,
      provider: input.recognizer.provider,
      remainingToday: Math.max(0, AI_RECOGNIZE_DAILY_LIMIT - consumed.count),
    };
  } catch (error) {
    failReason = summarizeAiError(error);
    await refundAiUsage({ db: input.db, userId: input.userId, now: input.now });
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError("upstream_error");
  } finally {
    console.info(
      `[recognize] ok=${ok} durationMs=${Date.now() - started} providerMs=${providerMs} parseMs=${parseMs} fieldCount=${fieldCount} images=${images} profile=${input.recognizer.profile} reason=${failReason || "-"}`,
    );
  }
}

/** 値は出さない。終了理由・応答のキー名・トークン数だけ（spec/features/ai-recognition.md 10 章） */
function summarizeLabelParse(
  output: unknown,
  payload: unknown,
  fields: RecognizeFields,
  images: number,
): string {
  const usage = normalizeTokenUsage(output);
  const record =
    typeof payload === "object" && payload !== null && !Array.isArray(payload) ? payload : null;
  const keys = record
    ? Object.keys(record).sort().join(",")
    : payload === null
      ? "null"
      : typeof payload;
  return [
    `images=${images}`,
    `fieldCount=${Object.keys(fields).length}`,
    `finishReason=${readFinishReason(output)}`,
    `payloadKeys=${keys.slice(0, 200) || "-"}`,
    `inputTokens=${usage.inputTokens ?? "-"}`,
    `outputTokens=${usage.outputTokens ?? "-"}`,
    `thinkingTokens=${usage.thinkingTokens ?? "-"}`,
  ].join(" ");
}

export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await withAbort(run(controller.signal), controller.signal);
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
