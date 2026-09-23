import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
import type { BatchRowFailure } from "@/client/lib/bottle-batch-failure.ts";
import {
  type BottleFormErrors,
  type BottleFormState,
  canSubmitBottleForm,
  createEmptyBottleForm,
  toCreateBottleBody,
  validateBottleForm,
} from "@/client/lib/bottle-form.ts";
import type { RecognizeBannerStatus, RecognizeMarkField } from "@/client/lib/label-recognize.ts";
import { capturedAtToCalendarDate } from "@/client/lib/photo/captured-at.ts";
import type { CreateBottleInput } from "@/shared/bottles.ts";

export type BatchPhotoPhase = "queued" | "converting" | "uploading" | "ready" | "error";

/** 一度に積める行数（04-cellar G1） */
export const BOTTLE_BATCH_MAX_ROWS = 20;

export const BOTTLE_BATCH_MESSAGES = {
  rowLimit: `一度に ${BOTTLE_BATCH_MAX_ROWS} 本までです`,
  empty: "撮った写真がここに並びます",
  partialFailure: (failed: number) => `${failed} 行を並べられませんでした。もう一度お試しください`,
  overflow: (accepted: number, overflow: number) =>
    `${accepted}枚を受け付けました。${overflow}枚は上限のため追加できません`,
  progress: (input: { total: number; done: number; failed: number; processing: number }) =>
    `${input.total}枚中${input.done}枚完了・${input.failed}枚失敗・${input.processing}枚処理中`,
  stageQueued: "待機中",
  stageConverting: "変換中",
  stageUploading: "アップロード中",
  pickAgain: "写真を選び直す",
  cutoutFallback: "切り抜きに失敗したため、通常の写真で登録します",
  captureFirst: "撮る",
  captureNext: (remaining: number) => `次を撮る（あと ${remaining} 本）`,
  libraryProgress: (current: number, total: number) => `${current} / ${total} 枚を変換しています`,
  burstProcessing: (count: number) => `${count} 本を裏で処理しています`,
  discardBody: "入力した内容は保存されず、撮った写真も削除されます",
  leftover: (parts: readonly string[]) => `並べられなかった行を残しました（${parts.join("・")}）`,
  leftoverPhotoFailed: (n: number) => `写真を送れなかった行 ${n}`,
  leftoverProcessing: (n: number) => `写真を処理中の行 ${n}`,
  leftoverNameMissing: (n: number) => `品名が空の行 ${n}`,
  leftoverSaveFailed: (n: number) => `保存に失敗した行 ${n}`,
} as const;

/** 1 枚の写真 = 1 行 = 1 銘柄（本数 N 可） */
export type BottleBatchRow = {
  key: string;
  ingestId: string;
  photo: PhotoAttachment | null;
  /** 裏面（任意・最大 1。04-cellar G2b）。photo-edit を通さない JPEG */
  backPhoto: PhotoAttachment | null;
  /** 裏面を処理（デコード・トリミング）している間だけ true。アップロード中は `backPhoto.status` */
  backProcessing: boolean;
  form: BottleFormState;
  /** AI が入れた欄。ユーザーが編集すると外れる */
  aiMarks: readonly RecognizeMarkField[];
  recognize: RecognizeBannerStatus | null;
  drinkTypeTouched: boolean;
  detailsOpen: boolean;
  /** 直前の保存で失敗した行の汎用文 */
  error: string | null;
  phase: BatchPhotoPhase;
  failure: BatchRowFailure | null;
  cutoutFallback: boolean;
  saveOperationKey: string | null;
};

export function newBatchRow(
  key: string,
  photo: PhotoAttachment,
  now: Date = new Date(),
): BottleBatchRow {
  const form = createEmptyBottleForm(now);
  if (photo.capturedAt) {
    form.storedOn = capturedAtToCalendarDate(photo.capturedAt, now);
  }
  return {
    key,
    ingestId: key,
    photo,
    backPhoto: null,
    backProcessing: false,
    form,
    aiMarks: [],
    recognize: null,
    drinkTypeTouched: false,
    detailsOpen: false,
    error: null,
    phase: photo.status === "error" ? "error" : photo.status === "ready" ? "ready" : "uploading",
    failure: null,
    cutoutFallback: false,
    saveOperationKey: null,
  };
}

export function newQueuedBatchRow(
  key: string,
  ingestId: string,
  now: Date = new Date(),
): BottleBatchRow {
  return {
    ...newBatchRow(
      key,
      {
        previewUrl: "",
        blob: new Blob(),
        photoId: null,
        status: "uploading",
      },
      now,
    ),
    ingestId,
    photo: null,
    phase: "queued",
  };
}

export function canAddBatchRow(rows: readonly BottleBatchRow[]): boolean {
  return rows.length < BOTTLE_BATCH_MAX_ROWS;
}

export function remainingBatchRows(rows: readonly BottleBatchRow[]): number {
  return Math.max(0, BOTTLE_BATCH_MAX_ROWS - rows.length);
}

/** 連続撮影で確保済みの枠（既存行 + 今の写真 + 次の予約）が上限未満か */
export function canReserveBatchRow(reservedCount: number): boolean {
  return reservedCount < BOTTLE_BATCH_MAX_ROWS;
}

/** 写真が来た行を追加、または同じ key の写真を置き換える（再編集・再試行） */
export function upsertBatchPhoto(
  rows: readonly BottleBatchRow[],
  key: string,
  photo: PhotoAttachment,
): BottleBatchRow[] {
  const index = rows.findIndex((row) => row.key === key);
  if (index < 0) {
    if (!canAddBatchRow(rows)) {
      if (photo.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return [...rows];
    }
    return [...rows, newBatchRow(key, photo)];
  }
  return rows.map((row, rowIndex) => {
    if (rowIndex !== index) {
      return row;
    }
    if (
      row.photo &&
      row.photo.previewUrl !== photo.previewUrl &&
      row.photo.previewUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(row.photo.previewUrl);
    }
    return {
      ...row,
      photo,
      phase: photo.status === "error" ? "error" : photo.status === "ready" ? "ready" : "uploading",
      failure: photo.status === "error" ? row.failure : null,
    };
  });
}

/** 削除済みの行は復活させない（遅延アップロードの完了コールバック用） */
export function updateExistingBatchPhoto(
  rows: readonly BottleBatchRow[],
  key: string,
  photo: PhotoAttachment,
): BottleBatchRow[] {
  if (!rows.some((row) => row.key === key)) {
    if (photo.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    return [...rows];
  }
  return upsertBatchPhoto(rows, key, photo);
}

export function updateBatchRow(
  rows: readonly BottleBatchRow[],
  key: string,
  patch: Partial<BottleBatchRow> | ((row: BottleBatchRow) => Partial<BottleBatchRow>),
): BottleBatchRow[] {
  return rows.map((row) => {
    if (row.key !== key) {
      return row;
    }
    const next = typeof patch === "function" ? patch(row) : patch;
    return { ...row, ...next };
  });
}

/** 行のフォーム値を変える。AI が入れた欄をユーザーが触ったら印を外す（04-cellar G3） */
export function patchBatchRowForm(
  rows: readonly BottleBatchRow[],
  key: string,
  patch: Partial<BottleFormState>,
): BottleBatchRow[] {
  return updateBatchRow(rows, key, (row) => {
    const touched = (Object.keys(patch) as (keyof BottleFormState)[]).filter(
      (field): field is RecognizeMarkField =>
        field === "name" ||
        field === "producer" ||
        field === "origin" ||
        field === "variety" ||
        field === "vintage",
    );
    return {
      form: { ...row.form, ...patch },
      aiMarks: row.aiMarks.filter((mark) => !touched.includes(mark)),
      drinkTypeTouched: row.drinkTypeTouched || patch.drinkType !== undefined,
      error: null,
    };
  });
}

/** 行の裏面を置き換える（追加・再試行・アップロード完了）。`null` で外す */
export function setBatchBackPhoto(
  rows: readonly BottleBatchRow[],
  key: string,
  backPhoto: PhotoAttachment | null,
): BottleBatchRow[] {
  return updateBatchRow(rows, key, (row) => {
    if (
      row.backPhoto &&
      row.backPhoto.previewUrl !== backPhoto?.previewUrl &&
      row.backPhoto.previewUrl.startsWith("blob:")
    ) {
      URL.revokeObjectURL(row.backPhoto.previewUrl);
    }
    return { backPhoto, backProcessing: false };
  });
}

/** 行の写真の保存状態。裏面があれば裏面のアップロードも待つ（G9 の無効条件） */
export function batchRowPhotoStatus(row: BottleBatchRow): PhotoAttachment["status"] | "none" {
  if (row.phase === "queued" || row.phase === "converting") {
    return "uploading";
  }
  if (row.phase === "error") {
    return "error";
  }
  if (!row.photo) {
    return "none";
  }
  if (row.photo.status !== "ready") {
    return row.photo.status;
  }
  if (row.backProcessing) {
    return "uploading";
  }
  return row.backPhoto?.status ?? "ready";
}

export function removeBatchRow(rows: readonly BottleBatchRow[], key: string): BottleBatchRow[] {
  const target = rows.find((row) => row.key === key);
  if (target?.photo?.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(target.photo.previewUrl);
  }
  if (target?.backPhoto?.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(target.backPhoto.previewUrl);
  }
  return rows.filter((row) => row.key !== key);
}

export function batchRowErrors(row: BottleBatchRow): BottleFormErrors {
  return validateBottleForm(row.form);
}

/** 「棚に並べる（N 本）」の N（04-cellar G9） */
export function batchTotalCount(rows: readonly BottleBatchRow[]): number {
  return rows.reduce((sum, row) => sum + row.form.count, 0);
}

export function isBatchRowSavable(row: BottleBatchRow): boolean {
  if (row.phase !== "ready" || !row.photo?.photoId || row.photo.status !== "ready") {
    return false;
  }
  if (row.backProcessing || (row.backPhoto && row.backPhoto.status !== "ready")) {
    return false;
  }
  return canSubmitBottleForm(row.form, batchRowErrors(row), "ready");
}

export function savableBatchRows(rows: readonly BottleBatchRow[]): BottleBatchRow[] {
  return rows.filter((row) => isBatchRowSavable(row));
}

export function batchSavableCount(rows: readonly BottleBatchRow[]): number {
  return savableBatchRows(rows).reduce((sum, row) => sum + row.form.count, 0);
}

export function batchRowStageLabel(row: BottleBatchRow): string | null {
  if (row.phase === "queued") {
    return BOTTLE_BATCH_MESSAGES.stageQueued;
  }
  if (row.phase === "converting") {
    return BOTTLE_BATCH_MESSAGES.stageConverting;
  }
  if (row.phase === "uploading") {
    return BOTTLE_BATCH_MESSAGES.stageUploading;
  }
  if (row.phase === "error") {
    return row.failure?.message ?? row.error;
  }
  if (row.cutoutFallback) {
    return BOTTLE_BATCH_MESSAGES.cutoutFallback;
  }
  return null;
}

export function batchIngestProgress(rows: readonly BottleBatchRow[]): {
  total: number;
  done: number;
  failed: number;
  processing: number;
} {
  let done = 0;
  let failed = 0;
  let processing = 0;
  for (const row of rows) {
    if (row.phase === "error") {
      failed += 1;
    } else if (row.phase === "ready") {
      done += 1;
    } else {
      processing += 1;
    }
  }
  return { total: rows.length, done, failed, processing };
}

/**
 * 写真（表面・裏面）のアップロードだけが失敗した行。変換済みの画像は手元にあるので、
 * 「棚に並べる」で送り直してから保存する（G9）。変換失敗・品名不足は含めない
 */
export function isBatchRowRetryable(row: BottleBatchRow): boolean {
  const frontRetry =
    row.phase === "error" &&
    row.failure?.stage === "upload" &&
    row.photo?.status === "error" &&
    (row.photo.blob.size ?? 0) > 0;
  const frontReady =
    row.phase === "ready" && Boolean(row.photo?.photoId) && row.photo?.status === "ready";
  const backRetry = row.backPhoto?.status === "error";
  const backReady = !row.backProcessing && (!row.backPhoto || row.backPhoto.status === "ready");
  if (!frontRetry && !backRetry) {
    return false;
  }
  if (!(frontRetry || frontReady) || !(backRetry || backReady)) {
    return false;
  }
  return canSubmitBottleForm(row.form, batchRowErrors(row), "ready");
}

/** 「棚に並べる」を押したときに送る行（保存できる行 + 送り直せば保存できる行） */
export function batchSubmitRows(rows: readonly BottleBatchRow[]): BottleBatchRow[] {
  return rows.filter((row) => isBatchRowSavable(row) || isBatchRowRetryable(row));
}

/** 「棚に並べる（N 本）」の N */
export function batchSubmitCount(rows: readonly BottleBatchRow[]): number {
  return batchSubmitRows(rows).reduce((sum, row) => sum + row.form.count, 0);
}

/** 無効: 送る行が 0。変換失敗・処理中・品名が空の行は対象外（他の行は保存できる） */
export function canSubmitBatch(rows: readonly BottleBatchRow[]): boolean {
  return batchSubmitRows(rows).length > 0;
}

/** 保存後に残った行の理由（G9 一部失敗・未対象）。無ければ null */
export function batchLeftoverMessage(rows: readonly BottleBatchRow[]): string | null {
  let photoFailed = 0;
  let processing = 0;
  let nameMissing = 0;
  let saveFailed = 0;
  for (const row of rows) {
    if (row.phase === "error" || row.backPhoto?.status === "error") {
      photoFailed += 1;
    } else if (row.phase !== "ready" || batchRowPhotoStatus(row) === "uploading") {
      processing += 1;
    } else if (batchRowErrors(row).name) {
      nameMissing += 1;
    } else {
      saveFailed += 1;
    }
  }
  const parts = [
    photoFailed > 0 ? BOTTLE_BATCH_MESSAGES.leftoverPhotoFailed(photoFailed) : null,
    processing > 0 ? BOTTLE_BATCH_MESSAGES.leftoverProcessing(processing) : null,
    nameMissing > 0 ? BOTTLE_BATCH_MESSAGES.leftoverNameMissing(nameMissing) : null,
    saveFailed > 0 ? BOTTLE_BATCH_MESSAGES.leftoverSaveFailed(saveFailed) : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? BOTTLE_BATCH_MESSAGES.leftover(parts) : null;
}

export function batchRowBody(row: BottleBatchRow): CreateBottleInput | null {
  return toCreateBottleBody(row.form, row.photo?.photoId ?? null, {
    capturedAt: row.photo?.capturedAt,
    backPhotoId: row.backPhoto?.photoId ?? null,
  });
}

/** 未紐付けのままの写真 id（破棄・行削除で `DELETE /api/photos/:id` する） */
export function batchUnlinkedPhotoIds(rows: readonly BottleBatchRow[]): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.photo?.photoId) {
      ids.push(row.photo.photoId);
    }
    if (row.backPhoto?.photoId) {
      ids.push(row.backPhoto.photoId);
    }
  }
  return ids;
}

export function revokeBatchPreviewUrls(rows: readonly BottleBatchRow[]): void {
  for (const row of rows) {
    if (row.photo?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(row.photo.previewUrl);
    }
    if (row.backPhoto?.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(row.backPhoto.previewUrl);
    }
  }
}

export type BatchSubmitOutcome = {
  /** 成功した行の key（順序は送信順） */
  succeeded: string[];
  /** 失敗した行の key と汎用文 */
  failed: { key: string; message: string }[];
};

/** 送信結果を行に反映する。成功行は消し、失敗行は残して行内に汎用文（04-cellar G9） */
export function applyBatchOutcome(
  rows: readonly BottleBatchRow[],
  outcome: BatchSubmitOutcome,
): BottleBatchRow[] {
  const failedMessage = new Map(outcome.failed.map((item) => [item.key, item.message]));
  return rows
    .filter((row) => !outcome.succeeded.includes(row.key))
    .map((row) => {
      const message = failedMessage.get(row.key);
      return message === undefined ? row : { ...row, error: message };
    });
}
