import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  type PhotoCollectSession,
  usePhotoEdit,
  usePhotoFormSession,
} from "@/client/components/layout/photo-edit-context.tsx";
import { createBottles } from "@/client/hooks/use-bottles.ts";
import { markCellarLocalWrite, newOperationKey } from "@/client/lib/cellar-share.ts";
import { deletePhoto } from "@/client/hooks/use-photos.ts";
import {
  applyBatchOutcome,
  type BatchSubmitOutcome,
  type BottleBatchRow,
  batchRowBody,
  batchUnlinkedPhotoIds,
  canAddBatchRow,
  canReserveBatchRow,
  patchBatchRowForm,
  remainingBatchRows,
  removeBatchRow,
  revokeBatchPreviewUrls,
  updateBatchRow,
  upsertBatchPhoto,
} from "@/client/lib/bottle-batch.ts";
import type { BottleFormState } from "@/client/lib/bottle-form.ts";
import { describeBottleSaveFailure } from "@/client/lib/bottle-form.ts";
import { applyRecognizeToForm, countRecognizeFields } from "@/client/lib/label-recognize.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import { type ImagePickSource, pickImages } from "@/client/lib/photo/pick-image.ts";
import { processCellarFile, takeFilesForBatch } from "@/client/lib/photo/process-file.ts";
import { offerMatchesSession } from "@/client/lib/photo-recognize-offer.ts";
import { getCellarRecognizePref } from "@/client/lib/preferences.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { startLabelRecognition } from "@/client/lib/recognize-session.ts";
import type { Bottle } from "@/shared/bottles.ts";

export type BatchSubmitResult = {
  created: Bottle[];
  failedCount: number;
};

/**
 * `bottle-batch` の行の状態（04-cellar）。写真は `photo-edit` の collect セッションで行ごとに受け取り、
 * 到着した行にラベル読み取りを掛ける。保存は行を上から順に `POST /api/bottles`（1 行 = 1 リクエスト）。
 */
export function useBottleBatch(autoCapture: boolean) {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const session = usePhotoFormSession("cellar", "batch");
  const { startCapture, editFromBlob, retryCollectedUpload, pendingRecognize, ingestCollected } =
    usePhotoEdit();
  const [rows, setRows] = useState<BottleBatchRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [libraryProgress, setLibraryProgress] = useState<{ current: number; total: number } | null>(
    null,
  );
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  /** 連続撮影で確保した枠（既存行 + 今の写真 + 次の予約）。addPhoto のたびに既存行数へ戻す */
  const reservedRef = useRef(0);
  const libraryBusyRef = useRef(false);
  // 行ごとに「どの JPEG を読み取ったか」。再編集で写真が変われば読み直す
  const recognizedJpegRef = useRef(new Map<string, Blob>());

  const bindKey = useCallback((key: string, previousPhotoId?: string | null) => {
    const session: PhotoCollectSession = {
      previousPhotoId,
      onUpdate: (attachment) => {
        setRows((current) => upsertBatchPhoto(current, key, attachment));
      },
    };
    return session;
  }, []);

  const reserveCollect = useCallback(() => {
    reservedRef.current += 1;
    return bindKey(crypto.randomUUID());
  }, [bindKey]);

  const addLibraryPhotos = useCallback(async () => {
    const remaining = remainingBatchRows(rowsRef.current);
    if (remaining <= 0 || libraryBusyRef.current) {
      return;
    }
    const files = await pickImages("library", { multiple: true });
    const taken = takeFilesForBatch(files, remaining);
    if (taken.length === 0) {
      return;
    }
    libraryBusyRef.current = true;
    setLibraryProgress({ current: 0, total: taken.length });
    try {
      for (const [index, file] of taken.entries()) {
        setLibraryProgress({ current: index + 1, total: taken.length });
        try {
          const processed = await processCellarFile(file);
          void ingestCollected(processed, bindKey(crypto.randomUUID()));
        } catch {
          // 読めないファイルは飛ばす。残りは続ける
        }
      }
    } finally {
      libraryBusyRef.current = false;
      setLibraryProgress(null);
    }
  }, [bindKey, ingestCollected]);

  const addPhoto = useCallback(
    async (source: ImagePickSource = "camera") => {
      if (!canAddBatchRow(rowsRef.current)) {
        return;
      }
      if (source === "library") {
        await addLibraryPhotos();
        return;
      }
      reservedRef.current = rowsRef.current.length;
      await startCapture("cellar", {
        collect: reserveCollect(),
        source,
        burst: {
          canCollectMore: () => canReserveBatchRow(reservedRef.current),
          nextCollect: reserveCollect,
        },
      });
    },
    [addLibraryPhotos, reserveCollect, startCapture],
  );

  const camera = searchParams.get("camera") === "1";
  const capturedRef = useRef(false);
  useEffect(() => {
    if (!autoCapture || !camera || capturedRef.current) {
      return;
    }
    capturedRef.current = true;
    void addPhoto();
  }, [addPhoto, autoCapture, camera]);

  useEffect(() => {
    return () => {
      revokeBatchPreviewUrls(rowsRef.current);
    };
  }, []);

  // 「使う」直後、切り抜き・アップロードを待たずに読み取りを始める（Issue #48 D-1）
  useEffect(() => {
    if (!getCellarRecognizePref() || !offerMatchesSession(pendingRecognize, session)) {
      return;
    }
    startLabelRecognition(pendingRecognize.jpeg).catch(() => {});
  }, [pendingRecognize, session]);

  // 行ごとのラベル読み取り（04-cellar G7）。設定 OFF なら呼ばない
  useEffect(() => {
    if (!getCellarRecognizePref()) {
      return;
    }
    for (const row of rows) {
      const jpeg = row.photo.recognizeJpeg;
      if (!jpeg || recognizedJpegRef.current.get(row.key) === jpeg) {
        continue;
      }
      recognizedJpegRef.current.set(row.key, jpeg);
      const key = row.key;
      setRows((current) => updateBatchRow(current, key, { recognize: "loading" }));
      void startLabelRecognition(jpeg)
        .then((result) => {
          if (recognizedJpegRef.current.get(key) !== jpeg) {
            return;
          }
          if (countRecognizeFields(result.fields) === 0) {
            setRows((current) => updateBatchRow(current, key, { recognize: "failure" }));
            return;
          }
          setRows((current) =>
            updateBatchRow(current, key, (target) => {
              const applied = applyRecognizeToForm({
                state: target.form,
                fields: result.fields,
                drinkTypeTouched: target.drinkTypeTouched,
                marks: new Set(target.aiMarks),
              });
              return {
                form: applied.next,
                aiMarks: [...applied.marks],
                detailsOpen: target.detailsOpen || applied.openDetails,
                recognize: "success",
              };
            }),
          );
        })
        .catch(() => {
          if (recognizedJpegRef.current.get(key) !== jpeg) {
            return;
          }
          setRows((current) => updateBatchRow(current, key, { recognize: "failure" }));
        });
    }
  }, [rows]);

  const patchRow = useCallback((key: string, patch: Partial<BottleFormState>) => {
    setRows((current) => patchBatchRowForm(current, key, patch));
  }, []);

  const toggleDetails = useCallback((key: string) => {
    setRows((current) =>
      updateBatchRow(current, key, (row) => ({ detailsOpen: !row.detailsOpen })),
    );
  }, []);

  const editPhoto = useCallback(
    async (key: string) => {
      const current = rowsRef.current.find((row) => row.key === key);
      if (!current) {
        return;
      }
      await editFromBlob("cellar", current.photo.blob, bindKey(key, current.photo.photoId));
    },
    [bindKey, editFromBlob],
  );

  const retryPhoto = useCallback(
    async (key: string) => {
      const current = rowsRef.current.find((row) => row.key === key);
      if (!current) {
        return;
      }
      await retryCollectedUpload(current.photo, bindKey(key));
    },
    [bindKey, retryCollectedUpload],
  );

  const removeRow = useCallback(async (key: string) => {
    const current = rowsRef.current.find((row) => row.key === key);
    if (!current) {
      return;
    }
    recognizedJpegRef.current.delete(key);
    if (current.photo.photoId) {
      try {
        await deletePhoto(current.photo.photoId);
      } catch {
        // 破棄に失敗してもローカルは消す。残党は 24h GC
      }
    }
    setRows((items) => removeBatchRow(items, key));
  }, []);

  /** 戻る → 破棄。未紐付けの写真をすべて消す */
  const discardAll = useCallback(async () => {
    const ids = batchUnlinkedPhotoIds(rowsRef.current);
    await Promise.all(ids.map((id) => deletePhoto(id).catch(() => {})));
  }, []);

  /** 行を上から順に送る。成功行は消え、失敗行は残る（04-cellar G9） */
  const submit = useCallback(async (cellarId?: string): Promise<BatchSubmitResult> => {
    setSubmitting(true);
    const outcome: BatchSubmitOutcome = { succeeded: [], failed: [] };
    const created: Bottle[] = [];
    try {
      for (const row of rowsRef.current) {
        const body = batchRowBody(row);
        if (!body) {
          outcome.failed.push({ key: row.key, message: FORM_ERROR_MESSAGES.generic });
          continue;
        }
        try {
          const result = await createBottles({
            ...body,
            ...(cellarId ? { cellarId } : {}),
            operationKey: newOperationKey(),
          });
          created.push(...result.items);
          outcome.succeeded.push(row.key);
        } catch (error) {
          const failure = describeBottleSaveFailure(error, navigator.onLine);
          outcome.failed.push({
            key: row.key,
            message:
              failure.formMessage ??
              Object.values(failure.fieldErrors)[0] ??
              FORM_ERROR_MESSAGES.generic,
          });
        }
      }
    } finally {
      setSubmitting(false);
    }
    if (created.length > 0) {
      markCellarLocalWrite();
      void queryClient.invalidateQueries({ queryKey: queryKeys.bottles });
      void queryClient.invalidateQueries({ queryKey: queryKeys.cellars });
    }
    setRows((current) => applyBatchOutcome(current, outcome));
    return { created, failedCount: outcome.failed.length };
  }, [queryClient]);

  return {
    rows,
    submitting,
    libraryProgress,
    canAdd: canAddBatchRow(rows),
    addPhoto,
    addLibraryPhotos,
    editPhoto,
    retryPhoto,
    removeRow,
    patchRow,
    toggleDetails,
    discardAll,
    submit,
  };
}

export type BottleBatchApi = ReturnType<typeof useBottleBatch>;
