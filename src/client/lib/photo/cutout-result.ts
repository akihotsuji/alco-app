/**
 * 背景除去の失敗理由（機械可読）。UI には読み込み失敗と切り抜けなかったの 2 種だけ出す。
 * 詳細は `photo.cutout.diag` と `getRecentPhotoMetrics` で追跡する。
 */
export const CUTOUT_FAILURE_REASONS = [
  "unsupported",
  "model_download",
  "session_init",
  "timeout",
  "inference",
  "invalid_output",
  "invalid_mask",
  "empty_mask",
  "encode",
  "superseded",
  "unknown",
] as const;

export type CutoutFailureReason = (typeof CUTOUT_FAILURE_REASONS)[number];

export const CUTOUT_LOAD_FAILURE_REASONS = [
  "unsupported",
  "model_download",
  "session_init",
] as const;

export type CutoutLoadFailureReason = (typeof CUTOUT_LOAD_FAILURE_REASONS)[number];

const LOAD_FAILED_MESSAGE = "切り抜きの読み込みに失敗しました。長方形のまま保存します";
const SUBJECT_FAILED_MESSAGE = "うまく抜けませんでした。長方形のまま保存します";

export class CutoutError extends Error {
  readonly reason: CutoutFailureReason;
  /** 品質判定などの補足。ユーザー情報や画像を含めない */
  readonly detail: string | undefined;
  readonly causeName: string | undefined;
  readonly causeMessage: string | undefined;

  constructor(reason: CutoutFailureReason, detail?: string, options?: { cause?: unknown }) {
    super(detail ? `cutout_${reason}: ${detail}` : `cutout_${reason}`, options);
    this.name = "CutoutError";
    this.reason = reason;
    this.detail = detail;
    const cause = describeUnknownError(options?.cause);
    this.causeName = cause.name;
    this.causeMessage = cause.message;
  }
}

export function toCutoutFailureReason(error: unknown): CutoutFailureReason {
  return error instanceof CutoutError ? error.reason : "unknown";
}

export function describeUnknownError(error: unknown): { name?: string; message?: string } {
  if (error instanceof Error) {
    return {
      name: clip(error.name, 64),
      message: sanitizeErrorMessage(error.message),
    };
  }
  if (error != null) {
    return { message: sanitizeErrorMessage(String(error)) };
  }
  return {};
}

export function sanitizeErrorMessage(message: string): string {
  return clip(
    message
      .replace(/cookie[=:]\s*[^;\s]*/gi, "cookie=redacted")
      .replace(/authorization[=:]\s*\S+/gi, "authorization=redacted")
      .replace(/bearer\s+\S+/gi, "bearer redacted"),
    240,
  );
}

export function cutoutFailureFields(error: unknown): {
  reason: CutoutFailureReason;
  detail?: string;
  causeName?: string;
  causeMessage?: string;
} {
  if (error instanceof CutoutError) {
    return {
      reason: error.reason,
      detail: error.detail,
      causeName: error.causeName,
      causeMessage: error.causeMessage,
    };
  }
  const cause = describeUnknownError(error);
  return { reason: "unknown", causeName: cause.name, causeMessage: cause.message };
}

export function isCutoutLoadFailure(reason: CutoutFailureReason): boolean {
  return (CUTOUT_LOAD_FAILURE_REASONS as readonly string[]).includes(reason);
}

export function cutoutFailedUserMessage(reason: CutoutFailureReason): string {
  return isCutoutLoadFailure(reason) ? LOAD_FAILED_MESSAGE : SUBJECT_FAILED_MESSAGE;
}

/** 背景除去の工程別時間（ms）。0 は工程を通らなかったことを表す */
export type CutoutTiming = {
  modelDownloadMs: number;
  ortLoadMs: number;
  sessionCreateMs: number;
  preprocessMs: number;
  queueWaitMs: number;
  inferenceMs: number;
  postprocessMs: number;
  encodeMs: number;
  totalMs: number;
};

export function emptyCutoutTiming(): CutoutTiming {
  return {
    modelDownloadMs: 0,
    ortLoadMs: 0,
    sessionCreateMs: 0,
    preprocessMs: 0,
    queueWaitMs: 0,
    inferenceMs: 0,
    postprocessMs: 0,
    encodeMs: 0,
    totalMs: 0,
  };
}

/**
 * セラー写真の切り抜き結果。`success` は透過 WebP、`failed` は理由付きで長方形 JPEG へフォールバック済み、
 * `skipped` は切り抜き OFF / 非対応で最初から JPEG。
 */
export type CutoutOutcome =
  | { status: "success"; cached: boolean; timing: CutoutTiming }
  | {
      status: "failed";
      reason: CutoutFailureReason;
      detail?: string;
      causeName?: string;
      causeMessage?: string;
      timing: CutoutTiming;
    }
  | { status: "skipped"; reason: "off" | "unsupported" };

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}
