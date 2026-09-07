/**
 * 背景除去の失敗理由（機械可読）。UI には全部出さず、ログ・テスト・実機評価で追跡する。
 * Issue #48 A-5 / 10。文字列 `Error` と blob MIME で判定していた構造を置き換える。
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

export class CutoutError extends Error {
  readonly reason: CutoutFailureReason;
  /** 品質判定などの補足。ユーザー情報や画像を含めない */
  readonly detail: string | undefined;

  constructor(reason: CutoutFailureReason, detail?: string, options?: { cause?: unknown }) {
    super(detail ? `cutout_${reason}: ${detail}` : `cutout_${reason}`, options);
    this.name = "CutoutError";
    this.reason = reason;
    this.detail = detail;
  }
}

export function toCutoutFailureReason(error: unknown): CutoutFailureReason {
  return error instanceof CutoutError ? error.reason : "unknown";
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
  | { status: "failed"; reason: CutoutFailureReason; detail?: string; timing: CutoutTiming }
  | { status: "skipped"; reason: "off" | "unsupported" };
