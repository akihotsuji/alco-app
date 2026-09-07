import { PHOTO_CUTOUT_DIAG_KEY } from "@/shared/constants.ts";
import type { CutoutOutcome } from "./cutout-result.ts";

/**
 * 写真処理の工程別時間（Issue #48 9）。画像・ラベル文字・ユーザー情報は含めない。
 * 直近はメモリに残す。開発ビルドだけ `console.debug` する。
 * 本番では console に出さず、直近 1 件を sessionStorage `photo.cutout.diag` へ書く。
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

function persistCutoutDiagnostic(metric: CutoutMetric): void {
  if (typeof sessionStorage === "undefined") {
    return;
  }
  try {
    sessionStorage.setItem(PHOTO_CUTOUT_DIAG_KEY, JSON.stringify(metric));
  } catch {
    // プライベートモード等では保存できない
  }
}

export function recordCutoutMetric(stage: CutoutMetric["stage"], outcome: CutoutOutcome): void {
  const metric: CutoutMetric = { kind: "cutout", stage, at: Date.now(), outcome };
  push(metric);
  persistCutoutDiagnostic(metric);
}

export function getLastCutoutDiagnostic(): CutoutMetric | null {
  if (typeof sessionStorage === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(PHOTO_CUTOUT_DIAG_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as { kind?: unknown };
    return record.kind === "cutout" ? (parsed as CutoutMetric) : null;
  } catch {
    return null;
  }
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
