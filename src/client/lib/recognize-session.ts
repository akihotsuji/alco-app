import { recognizeLabel } from "@/client/hooks/use-bottles.ts";
import { recognizeDrinkPhoto } from "@/client/hooks/use-drink-logs.ts";
import { recognizeNotePhoto } from "@/client/hooks/use-tasting-notes.ts";
import type { DrinkRecognizeResponse } from "@/shared/drink-recognize.ts";
import type { RecognizeResponse } from "@/shared/label-recognize.ts";
import type { NoteRecognizeResponse } from "@/shared/note-recognize.ts";
import { recordRecognizeMetric } from "./photo/photo-metrics.ts";

export type RecognizeRunner = (jpeg: Blob, back?: Blob | null) => Promise<RecognizeResponse>;
export type DrinkRecognizeRunner = (jpeg: Blob) => Promise<DrinkRecognizeResponse>;

export type LabelRecognitionOptions = {
  /** 裏面の読み取り用 JPEG。表面と同じ 1 リクエストに載せる */
  back?: Blob | null;
  /** 「再読み取り」。同じ組でも進行中・完了済みの記録を捨てて再リクエストする */
  force?: boolean;
  /** 順番待ちの間に行が外れたら、リクエストを出さずに打ち切る（回数を消費しない） */
  signal?: AbortSignal;
};

export class RecognitionCancelledError extends Error {
  constructor() {
    super("recognition_cancelled");
    this.name = "RecognitionCancelledError";
  }
}

/** 一括登録で同時に走らせるラベル読み取りの上限（cellar.md 3.3b）。超えた分は順番待ち */
export const LABEL_RECOGNIZE_CONCURRENCY = 2;

type LabelSession = { back: Blob | null; promise: Promise<RecognizeResponse> };

/**
 * 同じ読み取り用 JPEG（表面 + 裏面の組）に対するラベル読み取りを 1 リクエストにまとめる。
 * `photo-edit` が JPEG を作った時点で開始し、背景除去・アップロードを待たずに走らせる（Issue #48 D-1）。
 * 結果を受け取るのは `BottleForm` / `useBottleBatch` で、どの Blob に対する結果かを見て stale を捨てる。
 * 裏面が変わったら同じ表面でも別リクエスト（古い記録は置き換える）。Blob が参照されなくなれば WeakMap から消える。
 */
const sessions = new WeakMap<Blob, LabelSession>();

let labelActive = 0;
const labelWaiting: Array<() => void> = [];

function acquireLabelSlot(): Promise<void> {
  if (labelActive < LABEL_RECOGNIZE_CONCURRENCY) {
    labelActive += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    labelWaiting.push(() => {
      labelActive += 1;
      resolve();
    });
  });
}

function releaseLabelSlot(): void {
  labelActive = Math.max(0, labelActive - 1);
  labelWaiting.shift()?.();
}

export function startLabelRecognition(
  jpeg: Blob,
  run: RecognizeRunner = recognizeLabel,
  options: LabelRecognitionOptions = {},
): Promise<RecognizeResponse> {
  const back = options.back ?? null;
  const existing = sessions.get(jpeg);
  if (existing && existing.back === back && !options.force) {
    return existing.promise;
  }
  const started = performance.now();
  const promise = acquireLabelSlot()
    .then(() => {
      if (options.signal?.aborted) {
        throw new RecognitionCancelledError();
      }
      return run(jpeg, back);
    })
    .then(
      (result) => {
        recordRecognizeMetric({
          ok: true,
          requestMs: Math.round(performance.now() - started),
          fieldCount: Object.keys(result.fields).length,
        });
        return result;
      },
      (error: unknown) => {
        if (!(error instanceof RecognitionCancelledError)) {
          recordRecognizeMetric({
            ok: false,
            requestMs: Math.round(performance.now() - started),
            fieldCount: 0,
          });
        }
        throw error;
      },
    )
    .finally(releaseLabelSlot);
  sessions.set(jpeg, { back, promise });
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

/** 破棄・セッション失効。3 機能の WeakMap から同じ Blob を外す */
export function forgetAllRecognition(jpeg: Blob): void {
  forgetLabelRecognition(jpeg);
  forgetDrinkRecognition(jpeg);
  forgetNoteRecognition(jpeg);
}
