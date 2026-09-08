import { recognizeLabel } from "@/client/hooks/use-bottles.ts";
import { recognizeDrinkPhoto } from "@/client/hooks/use-drink-logs.ts";
import { recognizeNotePhoto } from "@/client/hooks/use-tasting-notes.ts";
import type { DrinkRecognizeResponse } from "@/shared/drink-recognize.ts";
import type { RecognizeResponse } from "@/shared/label-recognize.ts";
import type { NoteRecognizeResponse } from "@/shared/note-recognize.ts";
import { recordRecognizeMetric } from "./photo/photo-metrics.ts";

export type RecognizeRunner = (jpeg: Blob) => Promise<RecognizeResponse>;
export type DrinkRecognizeRunner = (jpeg: Blob) => Promise<DrinkRecognizeResponse>;

/**
 * 同じ読み取り用 JPEG に対するラベル読み取りを 1 リクエストにまとめる。
 * `photo-edit` が JPEG を作った時点で開始し、背景除去・アップロードを待たずに走らせる（Issue #48 D-1）。
 * 結果を受け取るのは `BottleForm` / `useBottleBatch` で、どの Blob に対する結果かを見て stale を捨てる。
 * Blob が参照されなくなれば WeakMap から消える。
 */
const sessions = new WeakMap<Blob, Promise<RecognizeResponse>>();

export function startLabelRecognition(
  jpeg: Blob,
  run: RecognizeRunner = recognizeLabel,
): Promise<RecognizeResponse> {
  const existing = sessions.get(jpeg);
  if (existing) {
    return existing;
  }
  const started = performance.now();
  const promise = run(jpeg).then(
    (result) => {
      recordRecognizeMetric({
        ok: true,
        requestMs: Math.round(performance.now() - started),
        fieldCount: Object.keys(result.fields).length,
      });
      return result;
    },
    (error: unknown) => {
      recordRecognizeMetric({
        ok: false,
        requestMs: Math.round(performance.now() - started),
        fieldCount: 0,
      });
      throw error;
    },
  );
  sessions.set(jpeg, promise);
  // 早期開始では購読者がまだ居ないので、unhandled rejection にしない（結果は後で購読者が受け取る）
  promise.catch(() => {});
  return promise;
}

const drinkSessions = new WeakMap<Blob, Promise<DrinkRecognizeResponse>>();

export function startDrinkRecognition(
  jpeg: Blob,
  run: DrinkRecognizeRunner = recognizeDrinkPhoto,
): Promise<DrinkRecognizeResponse> {
  const existing = drinkSessions.get(jpeg);
  if (existing) {
    return existing;
  }
  const started = performance.now();
  const promise = run(jpeg).then(
    (result) => {
      recordRecognizeMetric({
        ok: true,
        requestMs: Math.round(performance.now() - started),
        fieldCount: Object.keys(result.fields).length,
      });
      return result;
    },
    (error: unknown) => {
      recordRecognizeMetric({
        ok: false,
        requestMs: Math.round(performance.now() - started),
        fieldCount: 0,
      });
      throw error;
    },
  );
  drinkSessions.set(jpeg, promise);
  promise.catch(() => {});
  return promise;
}

/** テスト用。同じ Blob の記録を捨てて再実行できるようにする */
export function forgetLabelRecognition(jpeg: Blob): void {
  sessions.delete(jpeg);
}

export function forgetDrinkRecognition(jpeg: Blob): void {
  drinkSessions.delete(jpeg);
}

export type NoteRecognizeRunner = (jpeg: Blob) => Promise<NoteRecognizeResponse>;

const noteSessions = new WeakMap<Blob, Promise<NoteRecognizeResponse>>();

export function startNoteRecognition(
  jpeg: Blob,
  run: NoteRecognizeRunner = recognizeNotePhoto,
): Promise<NoteRecognizeResponse> {
  const existing = noteSessions.get(jpeg);
  if (existing) {
    return existing;
  }
  const started = performance.now();
  const promise = run(jpeg).then(
    (result) => {
      recordRecognizeMetric({
        ok: true,
        requestMs: Math.round(performance.now() - started),
        fieldCount: Object.keys(result.fields).length,
      });
      return result;
    },
    (error: unknown) => {
      recordRecognizeMetric({
        ok: false,
        requestMs: Math.round(performance.now() - started),
        fieldCount: 0,
      });
      throw error;
    },
  );
  noteSessions.set(jpeg, promise);
  promise.catch(() => {});
  return promise;
}

export function forgetNoteRecognition(jpeg: Blob): void {
  noteSessions.delete(jpeg);
}
