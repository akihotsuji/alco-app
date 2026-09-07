import type { CutoutOutcome } from "./cutout-result.ts";

/**
 * 写真処理の工程別時間（Issue #48 9）。画像・ラベル文字・ユーザー情報は含めない。
 * 直近の記録をメモリに残し、開発ビルドでだけ `console.debug` する。本番では何も出さない。
 */
export type CutoutMetric = {
  kind: "cutout";
  stage: "preview" | "save";
  at: number;
  outcome: CutoutOutcome;
};

export type RecognizeMetric = {
  kind: "recognize";
  at: number;
  ok: boolean;
  requestMs: number;
  fieldCount: number;
};

export type PhotoMetric = CutoutMetric | RecognizeMetric;

const RECENT_LIMIT = 30;
const recent: PhotoMetric[] = [];

function push(metric: PhotoMetric): void {
  recent.push(metric);
  if (recent.length > RECENT_LIMIT) {
    recent.shift();
  }
  if (import.meta.env.DEV) {
    console.debug("[photo]", metric);
  }
}

export function recordCutoutMetric(stage: CutoutMetric["stage"], outcome: CutoutOutcome): void {
  push({ kind: "cutout", stage, at: Date.now(), outcome });
}

export function recordRecognizeMetric(input: {
  ok: boolean;
  requestMs: number;
  fieldCount: number;
}): void {
  push({ kind: "recognize", at: Date.now(), ...input });
}

export function getRecentPhotoMetrics(): readonly PhotoMetric[] {
  return [...recent];
}

export function clearPhotoMetrics(): void {
  recent.length = 0;
}
