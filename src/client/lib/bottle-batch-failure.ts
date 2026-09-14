import { isApiClientError } from "@/client/lib/api.ts";
import { PhotoDecodeError } from "@/client/lib/photo/decode-image.ts";
import { PhotoSizeError } from "@/client/lib/photo/to-jpeg-blob.ts";
import { RecognitionCancelledError } from "@/client/lib/recognize-session.ts";

export const BATCH_FAILURE_CODES = [
  "file_unreadable",
  "convert_failed",
  "size_exceeded",
  "network",
  "rate_limited",
  "daily_limit",
  "unauthorized",
  "unsupported_media",
  "ai_timeout",
  "ai_empty",
  "ai_failed",
  "bottle_save_failed",
  "unknown",
] as const;

export type BatchFailureCode = (typeof BATCH_FAILURE_CODES)[number];

export type BatchFailureContext = "convert" | "upload" | "recognize" | "bottle";

export type BatchRowFailure = {
  code: BatchFailureCode;
  message: string;
  stage: BatchFailureContext;
  httpStatus?: number;
};

export const BATCH_FAILURE_MESSAGES: Record<BatchFailureCode, string> = {
  file_unreadable: "この写真を読み込めませんでした",
  convert_failed: "画像の変換に失敗しました",
  size_exceeded: "画像が大きすぎて送れません",
  network: "通信できませんでした",
  rate_limited: "混み合っています。少し待ってから再試行してください",
  daily_limit: "本日の利用上限に達しました",
  unauthorized: "ログインの有効期限が切れました",
  unsupported_media: "この形式は使えません",
  ai_timeout: "読み取りが時間切れになりました",
  ai_empty: "ラベルから項目を取れませんでした",
  ai_failed: "ラベルを読み取れませんでした",
  bottle_save_failed: "この行を並べられませんでした",
  unknown: "処理に失敗しました",
};

export function isCancelledFailure(error: unknown): boolean {
  return (
    error instanceof RecognitionCancelledError ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TaskQueueCancelledError"))
  );
}

export function isTransientHttpFailure(error: unknown, online = true): boolean {
  if (!online) {
    return true;
  }
  if (error instanceof PhotoSizeError || error instanceof PhotoDecodeError) {
    return false;
  }
  if (!isApiClientError(error)) {
    return error instanceof TypeError;
  }
  if (
    error.code === "payload_too_large" ||
    error.code === "unauthorized" ||
    error.code === "unsupported_media_type" ||
    error.code === "rate_limited" ||
    error.code === "validation_error"
  ) {
    return false;
  }
  return error.status >= 500;
}

export function classifyBatchFailure(
  error: unknown,
  context: BatchFailureContext,
  online = true,
): BatchRowFailure {
  if (!online) {
    return failure("network", context);
  }
  if (error instanceof PhotoDecodeError) {
    return failure("file_unreadable", context);
  }
  if (error instanceof PhotoSizeError) {
    return failure("size_exceeded", context);
  }
  if (isApiClientError(error)) {
    if (error.code === "unauthorized") {
      return failure("unauthorized", context, error.status);
    }
    if (error.code === "payload_too_large") {
      return failure("size_exceeded", context, error.status);
    }
    if (error.code === "unsupported_media_type") {
      return failure("unsupported_media", context, error.status);
    }
    if (error.code === "rate_limited") {
      return failure(
        error.retryAfterSec != null ? "rate_limited" : "daily_limit",
        context,
        error.status,
      );
    }
    if (error.code === "upstream_error") {
      return failure(context === "recognize" ? "ai_failed" : "unknown", context, error.status);
    }
    if (error.status >= 500) {
      return failure("network", context, error.status);
    }
  }
  if (error instanceof TypeError) {
    return failure("network", context);
  }
  if (
    context === "recognize" &&
    error instanceof Error &&
    (error.name === "RecognizeTimeoutError" || error.name === "TimeoutError")
  ) {
    return failure("ai_timeout", context);
  }
  if (context === "convert") {
    return failure("convert_failed", context);
  }
  if (context === "bottle") {
    return failure("bottle_save_failed", context);
  }
  if (context === "recognize") {
    return failure("ai_failed", context);
  }
  return failure("unknown", context);
}

function failure(
  code: BatchFailureCode,
  stage: BatchFailureContext,
  httpStatus?: number,
): BatchRowFailure {
  return { code, message: BATCH_FAILURE_MESSAGES[code], stage, httpStatus };
}

export async function retryTransient<T>(
  run: () => Promise<T>,
  options: {
    retries?: number;
    sleep: (ms: number) => Promise<void>;
    random?: () => number;
    online?: boolean;
    retryAfterSec?: (error: unknown) => number | undefined;
  },
): Promise<T> {
  const max = options.retries ?? 2;
  const random = options.random ?? Math.random;
  let last: unknown;
  for (let attempt = 0; attempt <= max; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      last = error;
      if (!isTransientHttpFailure(error, options.online ?? true) || attempt === max) {
        throw error;
      }
      const retryAfter = options.retryAfterSec?.(error);
      const backoff =
        retryAfter != null
          ? retryAfter * 1000
          : Math.min(400 * 2 ** attempt, 3200) + Math.round(random() * 200);
      await options.sleep(backoff);
    }
  }
  throw last;
}
