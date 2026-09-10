import type {
  DrinkLookupRequest,
  DrinkLookupResponse,
  DrinkRecognizeFields,
  DrinkRecognizeResponse,
} from "@/shared/drink-recognize.ts";
import {
  countDrinkRecognizeFields,
  type DrinkRecognizeStatus,
  type DrinkRecognizeTouched,
  planDrinkLookup,
  settledRecognizeStatus,
} from "./drink-recognize.ts";
import type { LogFormState } from "./log-form.ts";

export type ApplyCount = { marked: number; applied: number };

export type DrinkRecognizeFlowDeps = {
  recognize: (jpeg: Blob) => Promise<DrinkRecognizeResponse>;
  lookup: (body: DrinkLookupRequest) => Promise<DrinkLookupResponse>;
  /** 呼ばれた時点のフォーム値と AI 印。照合の要否は反映後の値で判断する */
  snapshot: () => { state: LogFormState; marks: ReadonlySet<string> };
  touched: DrinkRecognizeTouched;
  /** 撮り直し・保存・画面離脱で true。以降は何も反映しない */
  isStale: () => boolean;
  /** 欄へ反映する。`marked` は AI 印の付いた欄の数（状態行の N）、`applied` は量・度数を含む反映数 */
  apply: (fields: DrinkRecognizeFields) => ApplyCount;
  onStatus: (status: DrinkRecognizeStatus, appliedCount: number) => void;
  onOriginCandidate: (value: string | null) => void;
};

/**
 * 酒記録の写真読み取り（二段階。ai-recognition.md 7a / 03-log.md N2）。
 * 1. 抽出: 品名・生産者・ヴィンテージ・種類などを即反映し、状態行を結果文にする
 * 2. 照合: サーバーが勧め、国か品種がまだ空なら別リクエストで補完する。この間は「調べています…」
 * 照合の失敗は抽出結果を消さず、結果文に戻すだけ（黙ってよい）。
 */
export async function runDrinkRecognizeFlow(
  jpeg: Blob,
  deps: DrinkRecognizeFlowDeps,
): Promise<void> {
  deps.onStatus("loading", 0);
  deps.onOriginCandidate(null);
  let result: DrinkRecognizeResponse;
  try {
    result = await deps.recognize(jpeg);
  } catch {
    if (!deps.isStale()) {
      deps.onStatus("failure", 0);
    }
    return;
  }
  if (deps.isStale()) {
    return;
  }
  deps.onOriginCandidate(result.originCandidate?.value ?? null);
  if (countDrinkRecognizeFields(result.fields) === 0) {
    deps.onStatus("empty", 0);
    return;
  }
  const extracted = deps.apply(result.fields);
  let appliedCount = extracted.marked;
  // 量・度数だけ入ったときも「読み取れなかった」とは言わない（印は無いが値は変わっている）
  let anyApplied = extracted.applied > 0;

  const afterExtract = deps.snapshot();
  const plan = planDrinkLookup(result, afterExtract.state, deps.touched, afterExtract.marks);
  if (!plan) {
    deps.onStatus(settledRecognizeStatus(appliedCount, anyApplied), appliedCount);
    return;
  }

  deps.onStatus("lookup", appliedCount);
  try {
    const looked = await deps.lookup(plan);
    if (deps.isStale()) {
      return;
    }
    if (looked.matched) {
      const merged = deps.apply(looked.fields);
      appliedCount += merged.marked;
      anyApplied ||= merged.applied > 0;
    }
  } catch {
    if (deps.isStale()) {
      return;
    }
  }
  deps.onStatus(settledRecognizeStatus(appliedCount, anyApplied), appliedCount);
}
