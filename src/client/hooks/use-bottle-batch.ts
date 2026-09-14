import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import {
  type PhotoAttachment,
  type PhotoCollectSession,
  usePhotoEdit,
  usePhotoFormSession,
} from "@/client/components/layout/photo-edit-context.tsx";
import { createBottles } from "@/client/hooks/use-bottles.ts";
import { deletePhoto, uploadPhoto } from "@/client/hooks/use-photos.ts";
import { backPhotoDraft, backPhotoFailed, backPhotoReady } from "@/client/lib/bottle-back-photo.ts";
import {
  applyBatchOutcome,
  type BatchSubmitOutcome,
  BOTTLE_BATCH_MESSAGES,
  type BottleBatchRow,
  batchRowBody,
  batchUnlinkedPhotoIds,
  canAddBatchRow,
  canReserveBatchRow,
  isBatchRowSavable,
  newQueuedBatchRow,
  patchBatchRowForm,
  remainingBatchRows,
  removeBatchRow,
  revokeBatchPreviewUrls,
  savableBatchRows,
  setBatchBackPhoto,
  updateBatchRow,
  updateExistingBatchPhoto,
  upsertBatchPhoto,
} from "@/client/lib/bottle-batch.ts";
import {
  classifyBatchFailure,
  isCancelledFailure,
  retryTransient,
} from "@/client/lib/bottle-batch-failure.ts";
import {
  acceptFilesForBatch,
  BATCH_CONVERT_CONCURRENCY,
  BATCH_TRANSIENT_RETRY_LIMIT,
  BATCH_UPLOAD_CONCURRENCY,
  runBatchPhotoJobs,
  runBatchUploadJob,
} from "@/client/lib/bottle-batch-pipeline.ts";
import { blobTraceFields, traceBatchEvent } from "@/client/lib/bottle-batch-trace.ts";
import type { BottleFormState } from "@/client/lib/bottle-form.ts";
import { describeBottleSaveFailure } from "@/client/lib/bottle-form.ts";
import { markCellarLocalWrite, newOperationKey } from "@/client/lib/cellar-share.ts";
import { applyRecognizeToForm, countRecognizeFields } from "@/client/lib/label-recognize.ts";
import { FORM_ERROR_MESSAGES } from "@/client/lib/log-form.ts";
import { type ImagePickSource, pickImage, pickImages } from "@/client/lib/photo/pick-image.ts";
import type { ProcessedPhoto } from "@/client/lib/photo/process.ts";
import { processBackPhotoFile, processCellarFile } from "@/client/lib/photo/process-file.ts";
import { createTaskQueue } from "@/client/lib/photo/task-queue.ts";
import { offerMatchesSession } from "@/client/lib/photo-recognize-offer.ts";
import { getCellarRecognizePref } from "@/client/lib/preferences.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { startLabelRecognition } from "@/client/lib/recognize-session.ts";
import type { Bottle } from "@/shared/bottles.ts";

export type BatchSubmitResult = {
  created: Bottle[];
  failedCount: number;
};

function attachmentFromProcessed(
  processed: ProcessedPhoto,
  status: PhotoAttachment["status"] = "uploading",
  photoId: string | null = null,
): PhotoAttachment {
  return {
    previewUrl: processed.previewUrl,
    blob: processed.blob,
    photoId,
    status,
    recognizeJpeg: processed.recognizeJpeg,
    capturedAt: processed.capturedAt,
  };
}

/**
 * `bottle-batch` の行の状態（04-cellar）。ライブラリは選択直後に行を足し、
 * 変換 1 件・アップロード同時 2 件で裏処理する。保存は行ごと `POST /api/bottles`。
 */
export function useBottleBatch(autoCapture: boolean) {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const session = usePhotoFormSession("cellar", "batch");
  const { startCapture, editFromBlob, retryCollectedUpload, pendingRecognize } = usePhotoEdit();
  const [rows, setRows] = useState<BottleBatchRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const reservedRef = useRef(0);
  const pickerLockRef = useRef(false);
  const discardedRef = useRef(new Set<string>());
  const reservedKeysRef = useRef(new Set<string>());
  const tokensRef = useRef(new Map<string, number>());
  const filesRef = useRef(new Map<string, File>());
  const retryLockRef = useRef(new Set<string>());
  const recognizedRef = useRef(new Map<string, { jpeg: Blob; back: Blob | null }>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const convertQueueRef = useRef(createTaskQueue(BATCH_CONVERT_CONCURRENCY));
  const uploadQueueRef = useRef(createTaskQueue(BATCH_UPLOAD_CONCURRENCY));

  const isActive = useCallback((key: string) => !discardedRef.current.has(key), []);

  const bumpToken = useCallback((key: string) => {
    const next = (tokensRef.current.get(key) ?? 0) + 1;
    tokensRef.current.set(key, next);
    return next;
  }, []);

  const isCurrentToken = useCallback(
    (key: string, token: number) => {
      return isActive(key) && tokensRef.current.get(key) === token;
    },
    [isActive],
  );

  const bindKey = useCallback(
    (key: string, previousPhotoId?: string | null): PhotoCollectSession => {
      reservedKeysRef.current.add(key);
      return {
        previousPhotoId,
        upload: (blob) =>
          uploadQueueRef.current.run(async () => {
            if (!isActive(key)) {
              throw new DOMException("aborted", "AbortError");
            }
            return uploadPhoto(blob);
          }),
        onUpdate: (attachment, error) => {
          if (discardedRef.current.has(key)) {
            if (attachment.photoId) {
              void deletePhoto(attachment.photoId).catch(() => {});
            }
            return;
          }
          setRows((current) => {
            const next = current.some((row) => row.key === key)
              ? updateExistingBatchPhoto(current, key, attachment)
              : upsertBatchPhoto(current, key, attachment);
            if (attachment.status !== "error") {
              return next;
            }
            return updateBatchRow(next, key, {
              phase: "error",
              failure: classifyBatchFailure(error, "upload", navigator.onLine),
            });
          });
        },
      };
    },
    [isActive],
  );

  const reserveCollect = useCallback(() => {
    reservedRef.current += 1;
    return bindKey(crypto.randomUUID());
  }, [bindKey]);

  const runRowRecognition = useCallback(
    (key: string, jpeg: Blob, back: Blob | null, force: boolean) => {
      if (!isActive(key) || !getCellarRecognizePref()) {
        return;
      }
      controllersRef.current.get(key)?.abort();
      const controller = new AbortController();
      controllersRef.current.set(key, controller);
      recognizedRef.current.set(key, { jpeg, back });
      const isCurrent = () => {
        const recognized = recognizedRef.current.get(key);
        return (
          isActive(key) &&
          recognized?.jpeg === jpeg &&
          recognized.back === back &&
          controllersRef.current.get(key) === controller
        );
      };
      setRows((current) => updateBatchRow(current, key, { recognize: "loading" }));
      const started = performance.now();
      void startLabelRecognition(jpeg, undefined, { back, force, signal: controller.signal })
        .then((result) => {
          if (!isCurrent()) {
            return;
          }
          traceBatchEvent({
            ingestId: key,
            rowKey: key,
            stage: "recognize",
            outcome: countRecognizeFields(result.fields) === 0 ? "error" : "ok",
            code: countRecognizeFields(result.fields) === 0 ? "ai_empty" : undefined,
            elapsedMs: Math.round(performance.now() - started),
            ...blobTraceFields(jpeg),
          });
          if (countRecognizeFields(result.fields) === 0) {
            setRows((current) =>
              updateBatchRow(current, key, {
                recognize: "failure",
                failure: {
                  code: "ai_empty",
                  message: "ラベルから項目を取れませんでした",
                  stage: "recognize",
                },
              }),
            );
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
                failure: target.phase === "error" ? target.failure : null,
              };
            }),
          );
        })
        .catch((error: unknown) => {
          if (!isCurrent() || isCancelledFailure(error)) {
            return;
          }
          const failure = classifyBatchFailure(error, "recognize", navigator.onLine);
          traceBatchEvent({
            ingestId: key,
            rowKey: key,
            stage: "recognize",
            outcome: "error",
            code: failure.code,
            httpStatus: failure.httpStatus,
            elapsedMs: Math.round(performance.now() - started),
          });
          setRows((current) =>
            updateBatchRow(current, key, {
              recognize: "failure",
              failure:
                current.find((row) => row.key === key)?.phase === "error"
                  ? (current.find((row) => row.key === key)?.failure ?? failure)
                  : failure,
            }),
          );
        });
    },
    [isActive],
  );

  const applyConverted = useCallback(
    (key: string, processed: ProcessedPhoto) => {
      const cutoutFallback = processed.cutout?.status === "failed";
      setRows((current) =>
        updateBatchRow(current, key, (row) => ({
          photo: attachmentFromProcessed(processed),
          phase: "uploading",
          failure: null,
          cutoutFallback,
          form: processed.capturedAt ? { ...row.form, storedOn: row.form.storedOn } : row.form,
        })),
      );
      if (processed.recognizeJpeg) {
        runRowRecognition(key, processed.recognizeJpeg, null, false);
      }
    },
    [runRowRecognition],
  );

  const enqueueJobs = useCallback(
    (jobs: Array<{ key: string; ingestId: string; file: File }>) => {
      void runBatchPhotoJobs(jobs, {
        convertQueue: convertQueueRef.current,
        uploadQueue: uploadQueueRef.current,
        isActive,
        convert: async (job) => {
          const started = performance.now();
          setRows((current) =>
            updateBatchRow(current, job.key, { phase: "converting", failure: null }),
          );
          try {
            const processed = await processCellarFile(job.file);
            traceBatchEvent({
              ingestId: job.ingestId,
              rowKey: job.key,
              stage: "convert",
              outcome: "ok",
              elapsedMs: Math.round(performance.now() - started),
              ...blobTraceFields(processed.blob),
            });
            return processed;
          } catch (error) {
            traceBatchEvent({
              ingestId: job.ingestId,
              rowKey: job.key,
              stage: "convert",
              outcome: "error",
              code: classifyBatchFailure(error, "convert", navigator.onLine).code,
              elapsedMs: Math.round(performance.now() - started),
            });
            throw error;
          }
        },
        upload: async (job) => {
          const started = performance.now();
          try {
            const meta = await uploadPhoto(job.blob);
            traceBatchEvent({
              ingestId: job.ingestId,
              rowKey: job.key,
              stage: "upload",
              outcome: "ok",
              elapsedMs: Math.round(performance.now() - started),
              ...blobTraceFields(job.blob),
            });
            return meta;
          } catch (error) {
            const failure = classifyBatchFailure(error, "upload", navigator.onLine);
            traceBatchEvent({
              ingestId: job.ingestId,
              rowKey: job.key,
              stage: "upload",
              outcome: "error",
              code: failure.code,
              httpStatus: failure.httpStatus,
              elapsedMs: Math.round(performance.now() - started),
              ...blobTraceFields(job.blob),
            });
            throw error;
          }
        },
        onConvertDone: (key, processed) => {
          if (!isActive(key)) {
            URL.revokeObjectURL(processed.previewUrl);
            return;
          }
          applyConverted(key, processed);
        },
        onConvertError: (key, error) => {
          if (!isActive(key) || isCancelledFailure(error)) {
            return;
          }
          setRows((current) =>
            updateBatchRow(current, key, {
              phase: "error",
              failure: classifyBatchFailure(error, "convert", navigator.onLine),
            }),
          );
        },
        onUploadDone: (key, photoId) => {
          if (!isActive(key)) {
            void deletePhoto(photoId).catch(() => {});
            return;
          }
          setRows((current) =>
            updateBatchRow(current, key, (row) => ({
              photo: row.photo ? { ...row.photo, photoId, status: "ready" } : row.photo,
              phase: "ready",
              failure: row.failure?.stage === "recognize" ? row.failure : null,
            })),
          );
        },
        onUploadError: (key, error) => {
          if (!isActive(key) || isCancelledFailure(error)) {
            return;
          }
          setRows((current) =>
            updateBatchRow(current, key, (row) => ({
              photo: row.photo ? { ...row.photo, status: "error" } : row.photo,
              phase: "error",
              failure: classifyBatchFailure(error, "upload", navigator.onLine),
            })),
          );
        },
      });
    },
    [applyConverted, isActive],
  );

  const addLibraryPhotos = useCallback(async () => {
    if (pickerLockRef.current || remainingBatchRows(rowsRef.current) <= 0) {
      return;
    }
    pickerLockRef.current = true;
    setPicking(true);
    try {
      const files = await pickImages("library", { multiple: true });
      const remaining = remainingBatchRows(rowsRef.current);
      const accepted = acceptFilesForBatch(files, remaining);
      traceBatchEvent({
        ingestId: "library",
        stage: "pick",
        outcome: "ok",
        picked: accepted.picked,
        accepted: accepted.taken.length,
        overflow: accepted.overflow,
      });
      if (accepted.overflow > 0) {
        setNotice(BOTTLE_BATCH_MESSAGES.overflow(accepted.taken.length, accepted.overflow));
      } else if (accepted.taken.length > 0) {
        setNotice(null);
      }
      if (accepted.taken.length === 0) {
        return;
      }
      const jobs = accepted.taken.map((file) => {
        const key = crypto.randomUUID();
        const ingestId = crypto.randomUUID();
        filesRef.current.set(key, file);
        discardedRef.current.delete(key);
        reservedKeysRef.current.add(key);
        bumpToken(key);
        return { key, ingestId, file };
      });
      setRows((current) => [
        ...current,
        ...jobs.map((job) => newQueuedBatchRow(job.key, job.ingestId)),
      ]);
      enqueueJobs(jobs);
    } finally {
      pickerLockRef.current = false;
      setPicking(false);
    }
  }, [bumpToken, enqueueJobs]);

  const addPhoto = useCallback(
    async (source: ImagePickSource = "camera") => {
      if (!canAddBatchRow(rowsRef.current) || pickerLockRef.current) {
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

  useEffect(() => {
    if (!getCellarRecognizePref() || !offerMatchesSession(pendingRecognize, session)) {
      return;
    }
    startLabelRecognition(pendingRecognize.jpeg).catch(() => {});
  }, [pendingRecognize, session]);

  useEffect(() => {
    if (!getCellarRecognizePref()) {
      return;
    }
    for (const row of rows) {
      const jpeg = row.photo?.recognizeJpeg;
      if (!jpeg) {
        continue;
      }
      const recognized = recognizedRef.current.get(row.key);
      if (recognized?.jpeg === jpeg) {
        continue;
      }
      runRowRecognition(row.key, jpeg, null, false);
    }
  }, [rows, runRowRecognition]);

  const recognizeRow = useCallback(
    (key: string) => {
      const row = rowsRef.current.find((item) => item.key === key);
      const jpeg = row?.photo?.recognizeJpeg;
      if (!row || !jpeg || row.recognize === "loading" || !getCellarRecognizePref()) {
        return;
      }
      runRowRecognition(key, jpeg, row.backPhoto?.recognizeJpeg ?? null, true);
    },
    [runRowRecognition],
  );

  const addBackPhoto = useCallback(async (key: string, source: ImagePickSource = "camera") => {
    const row = rowsRef.current.find((item) => item.key === key);
    if (!row || row.backProcessing || retryLockRef.current.has(`back:${key}`)) {
      return;
    }
    retryLockRef.current.add(`back:${key}`);
    const file = await pickImage(source);
    if (!file) {
      retryLockRef.current.delete(`back:${key}`);
      return;
    }
    setRows((current) => updateBatchRow(current, key, { backProcessing: true }));
    try {
      const processed = await processBackPhotoFile(file);
      const previous = rowsRef.current.find((item) => item.key === key)?.backPhoto;
      const previousId = previous?.photoId;
      if (previousId) {
        void deletePhoto(previousId).catch(() => {});
      }
      const draft = backPhotoDraft(processed);
      setRows((current) => setBatchBackPhoto(current, key, draft));
      try {
        const meta = await uploadQueueRef.current.run(() => uploadPhoto(draft.blob));
        if (!rowsRef.current.some((item) => item.key === key && item.backPhoto === draft)) {
          void deletePhoto(meta.id).catch(() => {});
          return;
        }
        setRows((current) => setBatchBackPhoto(current, key, backPhotoReady(draft, meta.id)));
      } catch {
        setRows((current) => setBatchBackPhoto(current, key, backPhotoFailed(draft)));
      }
    } catch {
      setRows((current) => updateBatchRow(current, key, { backProcessing: false }));
    } finally {
      retryLockRef.current.delete(`back:${key}`);
    }
  }, []);

  const retryBackPhoto = useCallback(async (key: string) => {
    const current = rowsRef.current.find((row) => row.key === key)?.backPhoto;
    if (current?.status !== "error" || retryLockRef.current.has(`back:${key}`)) {
      return;
    }
    retryLockRef.current.add(`back:${key}`);
    const draft: PhotoAttachment = { ...current, status: "uploading" };
    setRows((items) => setBatchBackPhoto(items, key, draft));
    try {
      const meta = await uploadQueueRef.current.run(() => uploadPhoto(draft.blob));
      if (!rowsRef.current.some((item) => item.key === key && item.backPhoto === draft)) {
        void deletePhoto(meta.id).catch(() => {});
        return;
      }
      setRows((items) => setBatchBackPhoto(items, key, backPhotoReady(draft, meta.id)));
    } catch {
      setRows((items) => setBatchBackPhoto(items, key, backPhotoFailed(draft)));
    } finally {
      retryLockRef.current.delete(`back:${key}`);
    }
  }, []);

  const removeBackPhoto = useCallback((key: string) => {
    const current = rowsRef.current.find((row) => row.key === key)?.backPhoto;
    setRows((items) => setBatchBackPhoto(items, key, null));
    if (current?.photoId) {
      void deletePhoto(current.photoId).catch(() => {});
    }
  }, []);

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
      if (!current?.photo?.blob.size) {
        return;
      }
      await editFromBlob("cellar", current.photo.blob, bindKey(key, current.photo.photoId));
    },
    [bindKey, editFromBlob],
  );

  const retryPhoto = useCallback(
    async (key: string) => {
      const current = rowsRef.current.find((row) => row.key === key);
      if (current?.phase !== "error" || retryLockRef.current.has(key)) {
        return;
      }
      retryLockRef.current.add(key);
      try {
        const file = filesRef.current.get(key);
        if (file && (current.failure?.stage === "convert" || !current.photo?.blob.size)) {
          bumpToken(key);
          enqueueJobs([{ key, ingestId: current.ingestId, file }]);
          return;
        }
        if (current.photo?.blob.size) {
          const token = bumpToken(key);
          setRows((items) =>
            updateBatchRow(items, key, (row) => ({
              photo: row.photo ? { ...row.photo, status: "uploading" } : row.photo,
              phase: "uploading",
              failure: null,
            })),
          );
          await runBatchUploadJob(
            { key, ingestId: current.ingestId, blob: current.photo.blob },
            {
              uploadQueue: uploadQueueRef.current,
              isActive: (rowKey) => isCurrentToken(rowKey, token),
              upload: async (job) => uploadPhoto(job.blob),
              onUploadDone: (rowKey, photoId) => {
                if (!isCurrentToken(rowKey, token)) {
                  void deletePhoto(photoId).catch(() => {});
                  return;
                }
                setRows((items) =>
                  updateBatchRow(items, rowKey, (row) => ({
                    photo: row.photo ? { ...row.photo, photoId, status: "ready" } : row.photo,
                    phase: "ready",
                  })),
                );
              },
              onUploadError: (rowKey, error) => {
                if (!isCurrentToken(rowKey, token)) {
                  return;
                }
                setRows((items) =>
                  updateBatchRow(items, rowKey, (row) => ({
                    photo: row.photo ? { ...row.photo, status: "error" } : row.photo,
                    phase: "error",
                    failure: classifyBatchFailure(error, "upload", navigator.onLine),
                  })),
                );
              },
            },
          );
          return;
        }
        await retryCollectedUpload(current.photo as PhotoAttachment, bindKey(key));
      } finally {
        retryLockRef.current.delete(key);
      }
    },
    [bindKey, bumpToken, enqueueJobs, isCurrentToken, retryCollectedUpload],
  );

  const replacePhoto = useCallback(
    async (key: string) => {
      const current = rowsRef.current.find((row) => row.key === key);
      if (!current || pickerLockRef.current) {
        return;
      }
      pickerLockRef.current = true;
      setPicking(true);
      try {
        const file = await pickImage("library");
        if (!file) {
          return;
        }
        discardedRef.current.delete(key);
        controllersRef.current.get(key)?.abort();
        if (current.photo?.photoId) {
          void deletePhoto(current.photo.photoId).catch(() => {});
        }
        filesRef.current.set(key, file);
        bumpToken(key);
        setRows((items) =>
          updateBatchRow(items, key, {
            photo: null,
            phase: "queued",
            failure: null,
            recognize: null,
            cutoutFallback: false,
          }),
        );
        enqueueJobs([{ key, ingestId: current.ingestId, file }]);
      } finally {
        pickerLockRef.current = false;
        setPicking(false);
      }
    },
    [bumpToken, enqueueJobs],
  );

  const removeRow = useCallback(async (key: string) => {
    const current = rowsRef.current.find((row) => row.key === key);
    if (!current) {
      return;
    }
    discardedRef.current.add(key);
    reservedKeysRef.current.delete(key);
    filesRef.current.delete(key);
    recognizedRef.current.delete(key);
    controllersRef.current.get(key)?.abort();
    controllersRef.current.delete(key);
    const ids = [current.photo?.photoId, current.backPhoto?.photoId].filter((id): id is string =>
      Boolean(id),
    );
    await Promise.all(
      ids.map((id) =>
        deletePhoto(id).catch(() => {
          // 破棄に失敗してもローカルは消す。残党は 24h GC
        }),
      ),
    );
    setRows((items) => removeBatchRow(items, key));
  }, []);

  const discardAll = useCallback(async () => {
    for (const key of reservedKeysRef.current) {
      discardedRef.current.add(key);
    }
    for (const row of rowsRef.current) {
      discardedRef.current.add(row.key);
    }
    for (const controller of controllersRef.current.values()) {
      controller.abort();
    }
    controllersRef.current.clear();
    filesRef.current.clear();
    const ids = batchUnlinkedPhotoIds(rowsRef.current);
    await Promise.all(ids.map((id) => deletePhoto(id).catch(() => {})));
  }, []);

  const submit = useCallback(
    async (cellarId?: string): Promise<BatchSubmitResult> => {
      setSubmitting(true);
      const outcome: BatchSubmitOutcome = { succeeded: [], failed: [] };
      const created: Bottle[] = [];
      try {
        for (const row of rowsRef.current) {
          if (!isBatchRowSavable(row)) {
            continue;
          }
          const body = batchRowBody(row);
          if (!body) {
            outcome.failed.push({ key: row.key, message: FORM_ERROR_MESSAGES.generic });
            continue;
          }
          const operationKey = row.saveOperationKey ?? newOperationKey();
          setRows((current) =>
            updateBatchRow(current, row.key, { saveOperationKey: operationKey }),
          );
          try {
            const result = await retryTransient(
              () =>
                createBottles({
                  ...body,
                  ...(cellarId ? { cellarId } : {}),
                  operationKey,
                }),
              {
                retries: BATCH_TRANSIENT_RETRY_LIMIT,
                sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
                online: navigator.onLine,
                retryAfterSec: (error) =>
                  error && typeof error === "object" && "retryAfterSec" in error
                    ? (error.retryAfterSec as number | undefined)
                    : undefined,
              },
            );
            created.push(...result.items);
            outcome.succeeded.push(row.key);
            traceBatchEvent({
              ingestId: row.ingestId,
              rowKey: row.key,
              stage: "save",
              outcome: "ok",
            });
          } catch (error) {
            const failure = describeBottleSaveFailure(error, navigator.onLine);
            const classified = classifyBatchFailure(error, "bottle", navigator.onLine);
            outcome.failed.push({
              key: row.key,
              message:
                failure.formMessage ?? Object.values(failure.fieldErrors)[0] ?? classified.message,
            });
            setRows((current) => updateBatchRow(current, row.key, { failure: classified }));
            traceBatchEvent({
              ingestId: row.ingestId,
              rowKey: row.key,
              stage: "save",
              outcome: "error",
              code: classified.code,
              httpStatus: classified.httpStatus,
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
    },
    [queryClient],
  );

  return {
    rows,
    submitting,
    picking,
    notice,
    canAdd: canAddBatchRow(rows) && !picking,
    savableCount: savableBatchRows(rows).reduce((sum, row) => sum + row.form.count, 0),
    addPhoto,
    addLibraryPhotos,
    editPhoto,
    retryPhoto,
    replacePhoto,
    removeRow,
    recognizeRow,
    addBackPhoto,
    retryBackPhoto,
    removeBackPhoto,
    patchRow,
    toggleDetails,
    discardAll,
    submit,
  };
}

export type BottleBatchApi = ReturnType<typeof useBottleBatch>;
