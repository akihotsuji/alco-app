import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
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

/** 一度に積める行数（04-cellar G1） */
export const BOTTLE_BATCH_MAX_ROWS = 20;

export const BOTTLE_BATCH_MESSAGES = {
  rowLimit: `一度に ${BOTTLE_BATCH_MAX_ROWS} 本までです`,
  empty: "撮った写真がここに並びます",
  partialFailure: (failed: number) => `${failed} 行を並べられませんでした。もう一度お試しください`,
  captureFirst: "撮る",
  captureNext: (remaining: number) => `次を撮る（あと ${remaining} 本）`,
  libraryProgress: (current: number, total: number) => `${current} / ${total} 枚を変換しています`,
  burstProcessing: (count: number) => `${count} 本を裏で処理しています`,
  discardBody: "入力した内容は保存されず、撮った写真も削除されます",
} as const;

/** 1 枚の写真 = 1 行 = 1 銘柄（本数 N 可） */
export type BottleBatchRow = {
  key: string;
  photo: PhotoAttachment;
  form: BottleFormState;
  /** AI が入れた欄。ユーザーが編集すると外れる */
  aiMarks: readonly RecognizeMarkField[];
  recognize: RecognizeBannerStatus | null;
  drinkTypeTouched: boolean;
  detailsOpen: boolean;
  /** 直前の保存で失敗した行の汎用文 */
  error: string | null;
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
    photo,
    form,
    aiMarks: [],
    recognize: null,
    drinkTypeTouched: false,
    detailsOpen: false,
    error: null,
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
    if (row.photo.previewUrl !== photo.previewUrl && row.photo.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(row.photo.previewUrl);
    }
    return { ...row, photo };
  });
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
        field === "name" || field === "producer" || field === "origin" || field === "vintage",
    );
    return {
      form: { ...row.form, ...patch },
      aiMarks: row.aiMarks.filter((mark) => !touched.includes(mark)),
      drinkTypeTouched: row.drinkTypeTouched || patch.drinkType !== undefined,
      error: null,
    };
  });
}

export function removeBatchRow(rows: readonly BottleBatchRow[], key: string): BottleBatchRow[] {
  const target = rows.find((row) => row.key === key);
  if (target?.photo.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(target.photo.previewUrl);
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

/** 無効: 行 0 / 銘柄名が空・範囲外の行 / アップロード中・失敗の行（04-cellar G9） */
export function canSubmitBatch(rows: readonly BottleBatchRow[]): boolean {
  return (
    rows.length > 0 &&
    rows.every((row) => canSubmitBottleForm(row.form, batchRowErrors(row), row.photo.status))
  );
}

export function batchRowBody(row: BottleBatchRow): CreateBottleInput | null {
  return toCreateBottleBody(row.form, row.photo.photoId, {
    capturedAt: row.photo.capturedAt,
  });
}

/** 未紐付けのままの写真 id（破棄・行削除で `DELETE /api/photos/:id` する） */
export function batchUnlinkedPhotoIds(rows: readonly BottleBatchRow[]): string[] {
  return rows
    .filter((row): row is BottleBatchRow & { photo: { photoId: string } } =>
      Boolean(row.photo.photoId),
    )
    .map((row) => row.photo.photoId);
}

export function revokeBatchPreviewUrls(rows: readonly BottleBatchRow[]): void {
  for (const row of rows) {
    if (row.photo.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(row.photo.previewUrl);
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
