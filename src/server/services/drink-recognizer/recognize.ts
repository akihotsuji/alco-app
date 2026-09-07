import type { AppSqliteDb } from "@/db/index.ts";
import { AI_RECOGNIZE_DAILY_LIMIT, AI_RECOGNIZE_TIMEOUT_MS } from "@/shared/constants.ts";
import {
  type DrinkRecognizeResponse,
  parseDrinkRecognizePayload,
} from "@/shared/drink-recognize.ts";
import { ApiError } from "../../errors.ts";
import { refundAiUsage, tryConsumeAiUsage } from "../ai-usage.ts";
import { ImageInspectFailure, inspectImageBytes } from "../image-inspect.ts";
import type { LabelRecognizer } from "../label-recognizer/index.ts";
import { RecognizeTimeoutError } from "../label-recognizer/recognize.ts";

export async function recognizeDrinkPhoto(input: {
  db: AppSqliteDb;
  userId: string;
  bytes: Uint8Array;
  recognizer: LabelRecognizer;
  now?: Date;
  timeoutMs?: number;
}): Promise<DrinkRecognizeResponse> {
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
    const output = await withTimeout(
      input.recognizer.recognize(input.bytes),
      input.timeoutMs ?? AI_RECOGNIZE_TIMEOUT_MS,
    );
    providerMs = Date.now() - started;
    const parseStarted = Date.now();
    const fields = parseDrinkRecognizePayload(output);
    parseMs = Date.now() - parseStarted;
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
      `[drink-recognize] ok=${ok} durationMs=${Date.now() - started} providerMs=${providerMs} parseMs=${parseMs} fieldCount=${fieldCount}`,
    );
  }
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
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
