import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { DetailSkeleton } from "@/client/components/feedback/LoadingSkeleton.tsx";
import { QueryError } from "@/client/components/feedback/QueryError.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { FieldWithAiMark } from "@/client/components/form/FieldWithAiMark.tsx";
import { IdentityFields } from "@/client/components/form/IdentityFields.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { AbvField } from "@/client/components/logs/AbvField.tsx";
import { BottlePickerRow } from "@/client/components/logs/BottlePickerRow.tsx";
import { DrinkTypeSelect } from "@/client/components/logs/DrinkTypeSelect.tsx";
import { DrunkAtRow } from "@/client/components/logs/DrunkAtRow.tsx";
import { MemoField } from "@/client/components/logs/MemoField.tsx";
import { PlaceField } from "@/client/components/logs/PlaceField.tsx";
import { VolumeField } from "@/client/components/logs/VolumeField.tsx";
import { CompactPhotoField } from "@/client/components/photo/CompactPhotoField.tsx";
import { PhotoViewer } from "@/client/components/photo/PhotoViewer.tsx";
import { Input } from "@/client/components/ui/input.tsx";
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
  applyRecognizeToLogForm,
  countDrinkRecognizeFields,
  DRINK_RECOGNIZE_BANNER,
  type DrinkRecognizeTouched,
  lockInheritedRecognizeFields,
} from "@/client/lib/drink-recognize.ts";
import { startDrinkRecognition } from "@/client/lib/recognize-session.ts";
import {
  applySelectedBottle,
  canSubmitLogForm,
  clearSelectedBottle,
  describeSaveFailure,
  isLogFormDirty,
  type LogFormErrors,
  type LogFormField,
  logFormStateFromDrinkLog,
  logSaveDisabledHint,
  type PhotoSaveStatus,
  saveButtonLabel,
  toUpdateDrinkLogBody,
  validateLogForm,
  visibleLogFormErrors,
} from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { queryKeys } from "@/client/lib/query-keys.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { NotFoundPage } from "@/client/pages/NotFoundPage.tsx";
import { DRINK_NAME_MAX_LENGTH, type DrinkLog } from "@/shared/drink-logs.ts";
import { IDENTITY_FIELD_LABELS } from "@/shared/identity.ts";

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
    pendingRecognizeJpeg,
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
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<LogFormField, boolean>>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [recognizeStatus, setRecognizeStatus] = useState<"loading" | "success" | null>(null);
  const [aiMarks, setAiMarks] = useState<Set<string>>(new Set());
  const aiMarksRef = useRef(aiMarks);
  aiMarksRef.current = aiMarks;
  const touchedRef = useRef<DrinkRecognizeTouched>(
    (() => {
      const touched: DrinkRecognizeTouched = {
        drinkName: false,
        drinkType: false,
        volumeMl: false,
        abvPercent: false,
        producer: false,
        origin: false,
        variety: false,
        vintage: false,
      };
      lockInheritedRecognizeFields(touched, initial, {
        lockDrinkType: true,
        lockVolume: true,
      });
      return touched;
    })(),
  );
  const recognizedJpegRef = useRef<Blob | null>(null);
  const recognizeRequestRef = useRef(0);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const attachment = attachments.log;
  const photoStatus: PhotoSaveStatus = attachment ? attachment.status : "none";
  const errors = { ...validateLogForm(state, new Date()), ...serverErrors };
  const visibleErrors = visibleLogFormErrors(errors, { submitted, touched });
  const dirty = isLogFormDirty(state, initial) || attachment !== undefined;
  const canSubmit =
    dirty && canSubmitLogForm(state, errors, photoStatus) && !photoDeleting && !deleteLog.isPending;

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

  useEffect(() => {
    if (!pendingRecognizeJpeg) {
      return;
    }
    startDrinkRecognition(pendingRecognizeJpeg).catch(() => {});
  }, [pendingRecognizeJpeg]);

  useEffect(() => {
    const jpeg = attachment?.recognizeJpeg ?? pendingRecognizeJpeg;
    if (!jpeg || recognizedJpegRef.current === jpeg) {
      return;
    }
    recognizedJpegRef.current = jpeg;
    const requestId = recognizeRequestRef.current + 1;
    recognizeRequestRef.current = requestId;
    setRecognizeStatus("loading");
    void startDrinkRecognition(jpeg)
      .then((result) => {
        if (requestId !== recognizeRequestRef.current || savedRef.current) {
          return;
        }
        if (countDrinkRecognizeFields(result.fields) === 0) {
          setRecognizeStatus(null);
          return;
        }
        setState((current) => {
          const applied = applyRecognizeToLogForm({
            state: current,
            fields: result.fields,
            touched: touchedRef.current,
            marks: aiMarksRef.current,
          });
          setAiMarks(applied.marks);
          return applied.next;
        });
        setRecognizeStatus("success");
      })
      .catch(() => {
        if (requestId !== recognizeRequestRef.current || savedRef.current) {
          return;
        }
        setRecognizeStatus(null);
      });
  }, [attachment?.recognizeJpeg, pendingRecognizeJpeg]);

  useEffect(() => {
    return () => {
      recognizeRequestRef.current += 1;
    };
  }, []);

  function update(patch: Partial<typeof state>, field?: LogFormField) {
    if (field) {
      setTouched((current) => ({ ...current, [field]: true }));
      if (field in touchedRef.current) {
        touchedRef.current[field as keyof DrinkRecognizeTouched] = true;
        setAiMarks((current) => {
          const next = new Set(current);
          next.delete(field);
          return next;
        });
      }
    }
    setState((current) => ({ ...current, ...patch }));
    setServerErrors({});
    setFormError(null);
  }

  function submit() {
    setSubmitted(true);
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
          const failure = describeSaveFailure(error, navigator.onLine, {
            hasPhoto: Boolean(attachment?.photoId),
            hasBottle: Boolean(state.bottleId),
          });
          setSaveState("error");
          setFormError(failure.formMessage);
          setServerErrors(failure.fieldErrors);
          if (failure.dropPhoto) {
            releaseAttachment("log");
          }
          if (failure.dropBottle) {
            setState((current) => clearSelectedBottle(current));
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
      <CompactPhotoField
        actions="retake"
        onCapture={() => void startCapture("log")}
        onLibrary={() => void startCapture("log", { source: "library" })}
        attachment={attachment}
        existingPreviewUrl={existingPhotoId ? photoContentUrl(existingPhotoId) : null}
        onPreview={() => setPreviewOpen(true)}
        onRetry={() => void retryUpload("log")}
        onClear={() => {
          recognizeRequestRef.current += 1;
          recognizedJpegRef.current = null;
          setRecognizeStatus(null);
          setPreviewOpen(false);
          if (attachment) {
            void clearAttachment("log");
            return;
          }
          void removeExistingPhoto();
        }}
        error={visibleErrors.photoIds}
        recognizeStatus={recognizeStatus}
        recognizeMessage={recognizeStatus ? DRINK_RECOGNIZE_BANNER[recognizeStatus] : undefined}
      />
      <PhotoViewer
        open={previewOpen && Boolean(attachment?.previewUrl || existingPhotoId)}
        src={attachment?.previewUrl ?? (existingPhotoId ? photoContentUrl(existingPhotoId) : "")}
        alt="記録写真"
        onClose={() => setPreviewOpen(false)}
      />
      <section className="log-form-section">
        <FieldLabel htmlFor="log-edit-drink-name" optional>
          {IDENTITY_FIELD_LABELS.drinkName}
        </FieldLabel>
        <FieldWithAiMark marked={aiMarks.has("drinkName")}>
          <Input
            id="log-edit-drink-name"
            value={state.drinkName}
            maxLength={DRINK_NAME_MAX_LENGTH}
            aria-invalid={visibleErrors.drinkName ? true : undefined}
            onChange={(event) => update({ drinkName: event.target.value }, "drinkName")}
          />
        </FieldWithAiMark>
        {visibleErrors.drinkName ? (
          <p className="field-error" role="alert">
            {visibleErrors.drinkName}
          </p>
        ) : null}
      </section>
      <DrinkTypeSelect
        value={state.drinkType}
        onChange={(drinkType) => {
          touchedRef.current.drinkType = true;
          update({ drinkType });
        }}
      />
      <BottlePickerRow
        placement="optional"
        bottleId={state.bottleId}
        bottleName={state.bottleName}
        error={visibleErrors.bottleId}
        onSelect={(bottle) => {
          setState((current) => {
            if (!bottle) {
              return clearSelectedBottle(current);
            }
            const next = applySelectedBottle(current, bottle, { preserveEdits: true });
            lockInheritedRecognizeFields(touchedRef.current, next, { lockDrinkType: true });
            return next;
          });
          setServerErrors({});
          setFormError(null);
        }}
      />
      <IdentityFields
        idPrefix="log-edit"
        values={{
          vintage: state.vintage,
          variety: state.variety,
          producer: state.producer,
          origin: state.origin,
        }}
        errors={{
          vintage: visibleErrors.vintage,
          variety: visibleErrors.variety,
          producer: visibleErrors.producer,
          origin: visibleErrors.origin,
        }}
        aiMarks={aiMarks}
        onChange={(field, value) => update({ [field]: value }, field)}
      />
      <VolumeField
        drinkType={state.drinkType}
        value={state.volumeMl}
        error={visibleErrors.volumeMl}
        onChange={(volumeMl) => update({ volumeMl }, "volumeMl")}
      />
      <AbvField
        value={state.abvPercent}
        volumeMl={state.volumeMl}
        error={visibleErrors.abvPercent}
        onChange={(abvPercent) => update({ abvPercent }, "abvPercent")}
      />
      <DrunkAtRow
        value={state.drunkAt}
        now={new Date()}
        error={visibleErrors.drunkAt}
        onChange={(drunkAt) => update({ drunkAt }, "drunkAt")}
      />
      <PlaceField
        placeName={state.placeName}
        placeLat={state.placeLat}
        placeLng={state.placeLng}
        error={visibleErrors.placeName}
        onChangeName={(placeName) => update({ placeName }, "placeName")}
      />
      <MemoField
        value={state.memo}
        error={visibleErrors.memo}
        onChange={(memo) => update({ memo }, "memo")}
      />
      <SaveBar
        label={saveButtonLabel(updateLog.isPending, photoStatus)}
        pending={updateLog.isPending}
        disabled={!canSubmit}
        hint={!canSubmit ? logSaveDisabledHint(state, errors, photoStatus) : null}
        state={updateLog.isPending ? "loading" : saveState}
        onSave={submit}
      />
      <button type="button" className="log-delete" onClick={() => setDeleteOpen(true)}>
        この記録を削除
      </button>
      <Dialog
        open={discardOpen}
        title="入力を破棄しますか"
        body={
          attachment
            ? "入力した内容は保存されず、写真も削除されます"
            : "入力した内容は保存されません"
        }
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
