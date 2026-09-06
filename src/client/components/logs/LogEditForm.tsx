import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { AbvField } from "@/client/components/logs/AbvField.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { DrunkAtRow } from "@/client/components/logs/DrunkAtRow.tsx";
import { MemoField } from "@/client/components/logs/MemoField.tsx";
import { VolumeField } from "@/client/components/logs/VolumeField.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import {
  useDeleteDrinkLog,
  useDrinkLog,
  useUpdateDrinkLog,
} from "@/client/hooks/use-drink-logs.ts";
import { deletePhoto, photoContentUrl } from "@/client/hooks/use-photos.ts";
import { isApiClientError } from "@/client/lib/api.ts";
import { logDayHref } from "@/client/lib/app-routes.ts";
import { haptic } from "@/client/lib/haptic.ts";
import {
  canSubmitLogForm,
  describeSaveFailure,
  formatGrams,
  isLogFormDirty,
  type LogFormErrors,
  logFormStateFromDrinkLog,
  liveAlcoholGrams,
  type PhotoSaveStatus,
  saveButtonLabel,
  toUpdateDrinkLogBody,
  validateLogForm,
} from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import type { DrinkLog } from "@/shared/drink-logs.ts";

export function LogEditForm({ logId }: { logId: string | undefined }) {
  const query = useDrinkLog(logId);
  if (query.isPending) {
    return <DetailSkeleton />;
  }
  if (query.isError) {
    return isApiClientError(query.error) && query.error.code === "not_found" ? (
      <NotFoundPage />
    ) : (
      <QueryError onRetry={() => query.refetch()} retrying={query.isFetching} />
    );
  }
  return <LoadedLogEditForm key={query.data.id} log={query.data} />;
}

function LoadedLogEditForm({ log }: { log: DrinkLog }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { setGuard } = useLeaveGuard();
  const {
    attachments,
    startCapture,
    editAttachment,
    retryUpload,
    clearAttachment,
    releaseAttachment,
  } = usePhotoEdit();
  const updateLog = useUpdateDrinkLog();
  const deleteLog = useDeleteDrinkLog();
  const [initial] = useState(() => logFormStateFromDrinkLog(log));
  const [state, setState] = useState(initial);
  const [existingPhotoId, setExistingPhotoId] = useState(log.thumbPhotoId);
  const [photoDeleting, setPhotoDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<LogFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const attachment = attachments.log;
  const photoStatus: PhotoSaveStatus = attachment ? attachment.status : "none";
  const errors = { ...validateLogForm(state, new Date()), ...serverErrors };
  const dirty = isLogFormDirty(state, initial) || attachment !== undefined;
  const canSubmit =
    dirty && canSubmitLogForm(state, errors, photoStatus) && !photoDeleting && !deleteLog.isPending;
  const grams = liveAlcoholGrams(state);

  useEffect(() => {
    if (!dirty || savedRef.current) {
      setGuard(null);
      return;
    }
    setGuard((proceed) => {
      pendingLeave.current = proceed;
      setDiscardOpen(true);
    });
    return () => setGuard(null);
  }, [dirty, setGuard]);

  function update(patch: Partial<typeof state>) {
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    const body = toUpdateDrinkLogBody(state, initial, attachment?.photoId ?? null);
    if (!body || !canSubmit || updateLog.isPending) {
      return;
    }
    setSaveState("loading");
    setFormError(null);
    setServerErrors({});
    updateLog.mutate(
      { id: log.id, body },
      {
        onSuccess: (updated) => {
          savedRef.current = true;
          setGuard(null);
          haptic("success");
          releaseAttachment("log");
          navigate(`${logDayHref(updated.drunkOn)}?highlight=${updated.id}`, { replace: true });
          showToast({ message: TOAST_MESSAGES.saved });
        },
        onError: (error) => {
          const failure = describeSaveFailure(error, navigator.onLine);
          setSaveState("error");
          setFormError(failure.formMessage);
          setServerErrors(failure.fieldErrors);
          if (failure.dropPhoto) {
            releaseAttachment("log");
          }
        },
      },
    );
  }

  async function removeExistingPhoto() {
    if (!existingPhotoId || photoDeleting) {
      return;
    }
    setPhotoDeleting(true);
    try {
      await deletePhoto(existingPhotoId);
      setExistingPhotoId(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.drinkLogs });
    } catch {
      showToast({ message: TOAST_MESSAGES.saveFailed });
    } finally {
      setPhotoDeleting(false);
    }
  }

  async function discard() {
    await clearAttachment("log");
    savedRef.current = true;
    setGuard(null);
    setDiscardOpen(false);
    pendingLeave.current?.();
    pendingLeave.current = null;
  }

  function confirmDelete() {
    deleteLog.mutate(log.id, {
      onSuccess: () => {
        savedRef.current = true;
        setGuard(null);
        releaseAttachment("log");
        navigate(logDayHref(log.drunkOn), { replace: true });
        showToast({ message: TOAST_MESSAGES.deleted, cheer: false });
      },
      onError: () => {
        setDeleteOpen(false);
        showToast({ message: TOAST_MESSAGES.saveFailed });
      },
    });
  }

  return (
    <div className="form-page log-form">
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      {attachment ? (
        <PhotoTile
          onClick={() => void startCapture("log")}
          attachment={attachment}
          onEdit={() => void editAttachment("log")}
          onRetry={() => void retryUpload("log")}
          onClear={() => void clearAttachment("log")}
          error={errors.photoIds}
        />
      ) : existingPhotoId ? (
        <div className="photo-thumb-row">
          <div className="photo-thumb photo-thumb-log">
            <img className="photo-thumb-img" src={photoContentUrl(existingPhotoId)} alt="" />
          </div>
          <div className="photo-thumb-actions">
            <button
              type="button"
              className="header-text-link"
              onClick={() => void startCapture("log")}
            >
              編集
            </button>
            <button
              type="button"
              className="header-text-link"
              disabled={photoDeleting}
              onClick={() => void removeExistingPhoto()}
            >
              {photoDeleting ? "削除中" : "削除"}
            </button>
          </div>
        </div>
      ) : (
        <PhotoTile onClick={() => void startCapture("log")} />
      )}
      <DrinkTypeChips value={state.drinkType} onChange={(drinkType) => update({ drinkType })} />
      <VolumeField
        drinkType={state.drinkType}
        value={state.volumeMl}
        error={errors.volumeMl}
        onChange={(volumeMl) => update({ volumeMl })}
      />
      <AbvField
        value={state.abvPercent}
        error={errors.abvPercent}
        onChange={(abvPercent) => update({ abvPercent })}
      />
      <p className="live-grams" aria-live="polite">
        ＝ {formatGrams(grams)} g
      </p>
      <DrunkAtRow
        value={state.drunkAt}
        now={new Date()}
        error={errors.drunkAt}
        onChange={(drunkAt) => update({ drunkAt })}
      />
      <MemoField value={state.memo} error={errors.memo} onChange={(memo) => update({ memo })} />
      <SaveBar
        label={saveButtonLabel(updateLog.isPending, photoStatus)}
        pending={updateLog.isPending}
        disabled={!canSubmit}
        state={updateLog.isPending ? "loading" : saveState}
        onSave={submit}
      />
      <button type="button" className="log-delete" onClick={() => setDeleteOpen(true)}>
        この記録を削除
      </button>
      <Dialog
        open={discardOpen}
        title="入力を破棄しますか"
        body={attachment ? "入力した内容は保存されず、写真も削除されます" : "入力した内容は保存されません"}
        primaryLabel="破棄する"
        destructive
        onPrimary={() => void discard()}
        onClose={() => {
          setDiscardOpen(false);
          pendingLeave.current = null;
        }}
      />
      <Dialog
        open={deleteOpen}
        title="この記録を削除しますか"
        body="削除した記録は元に戻せません"
        primaryLabel="削除する"
        destructive
        pending={deleteLog.isPending}
        onPrimary={confirmDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
