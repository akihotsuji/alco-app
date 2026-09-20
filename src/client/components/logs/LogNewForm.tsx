import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { DrinkSearchLink } from "@/client/components/form/DrinkSearchLink.tsx";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { FieldWithAiMark } from "@/client/components/form/FieldWithAiMark.tsx";
import { IdentityFields } from "@/client/components/form/IdentityFields.tsx";
import { ShareField, shareSaveLabel } from "@/client/components/friends/ShareField.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import {
  usePhotoEdit,
  usePhotoFormSession,
} from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { AbvField } from "@/client/components/logs/AbvField.tsx";
import {
  BottlePickerRow,
  TargetBottleChip,
  usePrefillBottle,
} from "@/client/components/logs/BottlePickerRow.tsx";
import { DrinkTypeSelect } from "@/client/components/logs/DrinkTypeSelect.tsx";
import { DrunkAtRow } from "@/client/components/logs/DrunkAtRow.tsx";
import { LogTastingSection } from "@/client/components/logs/LogTastingSection.tsx";
import { MemoField } from "@/client/components/logs/MemoField.tsx";
import { PlaceField } from "@/client/components/logs/PlaceField.tsx";
import { VolumeField } from "@/client/components/logs/VolumeField.tsx";
import { CompactPhotoField } from "@/client/components/photo/CompactPhotoField.tsx";
import { PhotoViewer } from "@/client/components/photo/PhotoViewer.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useBottle } from "@/client/hooks/use-bottles.ts";
import { useCreateDrinkLog } from "@/client/hooks/use-drink-logs.ts";
import { useDrinkPhotoRecognition } from "@/client/hooks/use-drink-recognition.ts";
import { useNotePhotos } from "@/client/hooks/use-note-photos.ts";
import { useShareIntent } from "@/client/hooks/use-share-intent.ts";
import { logDayHref } from "@/client/lib/app-routes.ts";
import {
  drinkLogSavePhotoId,
  firstPhotoId,
  PHOTO_COPY_FAILED_MESSAGE,
} from "@/client/lib/copy-owned-photo.ts";
import {
  type DrinkRecognizeTouched,
  drinkRecognizeBannerMessage,
  lockInheritedRecognizeFields,
} from "@/client/lib/drink-recognize.ts";
import { requestCurrentPosition } from "@/client/lib/geolocation.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { drinkLogUndoState, isPhotoHandoff } from "@/client/lib/history-state.ts";
import {
  applyDrinkType,
  applySelectedBottle,
  canSubmitLogForm,
  clearSelectedBottle,
  describeSaveFailure,
  initialLogFormState,
  isLogFormDirty,
  type LogFormErrors,
  type LogFormField,
  logSaveDisabledHint,
  type PhotoSaveStatus,
  saveButtonLabel,
  shouldPreserveBottlePrefill,
  toCreateDrinkLogBody,
  validateLogForm,
  visibleLogFormErrors,
} from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { parseFormOrigin } from "@/client/lib/opened-followup.ts";
import { capturedAtToDrunkAt, shouldKeepQueryDrunkAt } from "@/client/lib/photo/captured-at.ts";
import { recognizeJpegForForm } from "@/client/lib/photo-recognize-offer.ts";
import { getRecordLocationPref } from "@/client/lib/preferences.ts";
import { DRINK_LOG_MESSAGES, DRINK_NAME_MAX_LENGTH } from "@/shared/drink-logs.ts";
import { IDENTITY_FIELD_LABELS } from "@/shared/identity.ts";
import { SOCIAL_COPY } from "@/shared/social.ts";

const DISCARD_TITLE = "入力を破棄しますか";
const DISCARD_BODY = "入力した内容は保存されません";
const DISCARD_BODY_WITH_PHOTO = "入力した内容は保存されず、写真も削除されます";

/**
 * `log-new`（spec/screen-designs/03-log.md）。種類 → 保存の 2 タップを守り、写真・メモは任意の上乗せ。
 * 撮影は「写真を撮る」「写真を選ぶ」の明示タップだけ。`?camera=1` では起動しない。
 */
export function LogNewForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setGuard } = useLeaveGuard();
  const session = usePhotoFormSession("log", null);
  const {
    releaseAttachment,
    pendingRecognize,
    startCapture,
    attachments,
    retryUpload,
    clearAttachment,
    inheritOwnedPhoto,
  } = usePhotoEdit();
  const create = useCreateDrinkLog();
  const share = useShareIntent();
  const { showToast } = useToast();
  const openingEventId = searchParams.get("openingEventId");

  // 「いま」は開いた時点で固定する（N7 の既定値。ユーザーが変えられる）
  const [now] = useState(() => new Date());
  const dateParam = searchParams.get("date");
  const [initial] = useState(() => initialLogFormState(dateParam, now));
  const [state, setState] = useState(initial);
  const queryBottleId = searchParams.get("bottleId");
  const formOrigin = parseFormOrigin(searchParams.get("from"));
  const fromBottle = Boolean(formOrigin && queryBottleId);
  const [formError, setFormError] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<LogFormErrors>({});
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<LogFormField, boolean>>>({});
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const notePhotos = useNotePhotos();
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [aiMarks, setAiMarks] = useState<Set<string>>(new Set());
  const touchedRef = useRef<DrinkRecognizeTouched>({
    drinkName: false,
    drinkType: false,
    volumeMl: false,
    abvPercent: false,
    producer: false,
    origin: false,
    variety: false,
    vintage: false,
  });
  const appliedCapturedAtRef = useRef<string | null>(null);
  const geoRequested = useRef(false);

  const attachment = attachments.log?.sessionId === session.sessionId ? attachments.log : undefined;
  const recognition = useDrinkPhotoRecognition({
    jpeg: recognizeJpegForForm(attachment, pendingRecognize, session),
    state,
    setState,
    touchedRef,
    aiMarks,
    setAiMarks,
    savedRef,
  });
  const photoStatus: PhotoSaveStatus = attachment ? attachment.status : "none";
  const errors: LogFormErrors = {
    ...validateLogForm(state, new Date(), { existingOrigin: initial.origin }),
    ...serverErrors,
  };
  const visibleErrors = visibleLogFormErrors(errors, { submitted, touched });
  const tastingPhotoStatus = state.tastingOpen ? notePhotos.photoStatus : "none";
  const canSubmit =
    canSubmitLogForm(state, errors, photoStatus) &&
    (tastingPhotoStatus === "none" || tastingPhotoStatus === "ready");
  const dirty =
    isLogFormDirty(state, initial) || attachment !== undefined || notePhotos.photosDirty;

  const clearRef = useRef(clearAttachment);
  clearRef.current = clearAttachment;
  const hadStaleAttachment = useRef(attachment !== undefined && !isPhotoHandoff(location.state));
  const [staleCleared, setStaleCleared] = useState(!hadStaleAttachment.current);
  useEffect(() => {
    if (hadStaleAttachment.current) {
      hadStaleAttachment.current = false;
      void clearRef.current("log").finally(() => setStaleCleared(true));
      return;
    }
    setStaleCleared(true);
  }, []);

  const bottleQuery = useBottle(queryBottleId ?? undefined);
  const inheritedPhoto = useRef(false);
  const inheritSourceRef = useRef<string | null>(null);
  const [inheritError, setInheritError] = useState<string | null>(null);

  const inheritBottlePhoto = useCallback(
    (sourceId: string) => {
      inheritSourceRef.current = sourceId;
      inheritedPhoto.current = true;
      setInheritError(null);
      void inheritOwnedPhoto("log", sourceId).catch(() => {
        setInheritError(PHOTO_COPY_FAILED_MESSAGE);
      });
    },
    [inheritOwnedPhoto],
  );
  useEffect(() => {
    if (!staleCleared || inheritedPhoto.current || isPhotoHandoff(location.state)) {
      return;
    }
    if (attachments.log) {
      return;
    }
    const sourceId = firstPhotoId(bottleQuery.data?.photos);
    if (!queryBottleId || !sourceId) {
      return;
    }
    inheritBottlePhoto(sourceId);
  }, [
    attachments.log,
    bottleQuery.data?.photos,
    inheritBottlePhoto,
    location.state,
    queryBottleId,
    staleCleared,
  ]);

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
    if (geoRequested.current) {
      return;
    }
    geoRequested.current = true;
    if (!getRecordLocationPref()) {
      return;
    }
    void requestCurrentPosition().then((position) => {
      if (!position) {
        return;
      }
      setState((current) =>
        current.placeLat === null && current.placeLng === null
          ? { ...current, placeLat: position.lat, placeLng: position.lng }
          : current,
      );
    });
  }, []);

  useEffect(() => {
    const capturedAt = attachment?.capturedAt;
    if (!capturedAt || appliedCapturedAtRef.current === capturedAt) {
      return;
    }
    if (touched.drunkAt || shouldKeepQueryDrunkAt(dateParam, now)) {
      appliedCapturedAtRef.current = capturedAt;
      return;
    }
    appliedCapturedAtRef.current = capturedAt;
    setState((current) => ({ ...current, drunkAt: capturedAtToDrunkAt(capturedAt, now) }));
  }, [attachment?.capturedAt, dateParam, now, touched.drunkAt]);

  usePrefillBottle(
    queryBottleId,
    (bottle) => {
      if (!bottle) {
        return;
      }
      setState((current) => {
        const preserveEdits = !fromBottle || shouldPreserveBottlePrefill(current, initial);
        const next = applySelectedBottle(current, bottle, { preserveEdits });
        lockInheritedRecognizeFields(touchedRef.current, next, {
          lockDrinkType: true,
          lockVolume: !preserveEdits,
        });
        return next;
      });
    },
    () => setServerErrors({ bottleId: DRINK_LOG_MESSAGES.bottleNotFound }),
  );

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

  function goToDay(log: { id: string; drunkOn: string }) {
    navigate(`${logDayHref(log.drunkOn)}?highlight=${log.id}`, {
      replace: true,
      state: drinkLogUndoState(log.id),
    });
  }

  function submit() {
    setSubmitted(true);
    const body = toCreateDrinkLogBody(state, drinkLogSavePhotoId(attachment), notePhotos.photoIds);
    if (!body || !canSubmit || create.isPending) {
      return;
    }
    setFormError(null);
    setServerErrors({});
    setSaveState("loading");
    create.mutate(body, {
      onSuccess: (log) => {
        savedRef.current = true;
        setGuard(null);
        haptic("success");
        releaseAttachment("log");
        notePhotos.releaseLocal();
        const source =
          openingEventId && queryBottleId
            ? {
                kind: "opening_with_log" as const,
                openingEventId,
                drinkLogId: log.id,
              }
            : { kind: "drink_log" as const, drinkLogId: log.id };
        void share.shareIfNeeded(source).then((status) => {
          if (status === "failed") {
            showToast({ message: SOCIAL_COPY.shareFailedAfterSave });
          }
          goToDay(log);
        });
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
    });
  }

  async function discard() {
    setDiscarding(true);
    try {
      await clearAttachment("log");
    } finally {
      setDiscarding(false);
      setDiscardOpen(false);
      setGuard(null);
      savedRef.current = true;
      pendingLeave.current?.();
      pendingLeave.current = null;
    }
  }

  return (
    <div className="form-page log-form">
      <p className="form-lead">飲んだ量を残す</p>
      {fromBottle && state.bottleName ? <TargetBottleChip name={state.bottleName} /> : null}
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
        onPreview={() => setPreviewOpen(true)}
        onRetry={() => {
          if (inheritError && inheritSourceRef.current) {
            inheritBottlePhoto(inheritSourceRef.current);
            return;
          }
          void retryUpload("log");
        }}
        onClear={() => {
          recognition.reset();
          setPreviewOpen(false);
          void clearAttachment("log");
        }}
        error={visibleErrors.photoIds ?? inheritError}
        recognizeStatus={recognition.status}
        recognizeMessage={
          recognition.status
            ? drinkRecognizeBannerMessage(recognition.status, recognition.appliedCount)
            : undefined
        }
      />
      <PhotoViewer
        open={previewOpen && Boolean(attachment?.previewUrl)}
        src={attachment?.previewUrl ?? ""}
        alt="記録写真"
        onClose={() => setPreviewOpen(false)}
      />
      <section className="log-form-section">
        <FieldLabel htmlFor="log-drink-name" optional>
          {IDENTITY_FIELD_LABELS.drinkName}
        </FieldLabel>
        <FieldWithAiMark
          marked={aiMarks.has("drinkName")}
          pending={recognition.aiPending.has("drinkName")}
        >
          <Input
            id="log-drink-name"
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
        <DrinkSearchLink
          name={state.drinkName}
          producer={state.producer}
          vintage={state.vintage}
          drinkType={state.drinkType}
        />
      </section>
      <DrinkTypeSelect
        value={state.drinkType}
        aiMarked={aiMarks.has("drinkType")}
        aiPending={recognition.typeAiPending}
        onChange={(drinkType) => {
          touchedRef.current.drinkType = true;
          touchedRef.current.volumeMl = true;
          touchedRef.current.abvPercent = true;
          setAiMarks((current) => {
            const next = new Set(current);
            next.delete("drinkType");
            return next;
          });
          setState((current) => applyDrinkType(current, drinkType));
          setServerErrors({});
          setFormError(null);
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
          if (bottle?.thumbPhotoId && !attachment?.recognizeJpeg) {
            inheritBottlePhoto(bottle.thumbPhotoId);
          } else if (!bottle?.thumbPhotoId && attachment && !attachment.recognizeJpeg) {
            void clearAttachment("log");
          }
          setServerErrors({});
          setFormError(null);
        }}
      />
      <IdentityFields
        idPrefix="log"
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
        aiPending={recognition.aiPending}
        originCandidate={recognition.originCandidate}
        onChange={(field, value) => update({ [field]: value }, field)}
      />
      <VolumeField
        key={`volume-${state.drinkType}`}
        drinkType={state.drinkType}
        value={state.volumeMl}
        error={visibleErrors.volumeMl}
        onChange={(volumeMl) => {
          touchedRef.current.volumeMl = true;
          update({ volumeMl }, "volumeMl");
        }}
      />
      <AbvField
        key={`abv-${state.drinkType}`}
        value={state.abvPercent}
        volumeMl={state.volumeMl}
        error={visibleErrors.abvPercent}
        onChange={(abvPercent) => {
          touchedRef.current.abvPercent = true;
          update({ abvPercent }, "abvPercent");
        }}
      />
      <DrunkAtRow
        value={state.drunkAt}
        now={now}
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
      <LogTastingSection
        open={state.tastingOpen}
        ratingX10={state.tastingRatingX10}
        appearance={state.tastingAppearance}
        aroma={state.tastingAroma}
        taste={state.tastingTaste}
        finish={state.tastingFinish}
        errors={{
          ratingX10: visibleErrors.ratingX10,
          appearance: visibleErrors.appearance,
          aroma: visibleErrors.aroma,
          taste: visibleErrors.taste,
          finish: visibleErrors.finish,
        }}
        photos={notePhotos.items}
        canAddPhotos={notePhotos.canAdd}
        onOpenChange={(tastingOpen) => update({ tastingOpen })}
        onRatingChange={(tastingRatingX10) => update({ tastingRatingX10 }, "ratingX10")}
        onTextChange={(field, value) => {
          const key =
            field === "appearance"
              ? "tastingAppearance"
              : field === "aroma"
                ? "tastingAroma"
                : field === "taste"
                  ? "tastingTaste"
                  : "tastingFinish";
          update({ [key]: value }, field);
        }}
        onAddPhoto={() => void notePhotos.addPhoto("camera")}
        onLibraryPhoto={() => void notePhotos.addPhoto("library")}
        onEditPhoto={(key) => void notePhotos.editPhoto(key)}
        onRetryPhoto={(key) => void notePhotos.retryPhoto(key)}
        onRemovePhoto={(key) => void notePhotos.removePhoto(key)}
        onMakeFirst={notePhotos.makeFirst}
      />
      <ShareField
        shareOn={share.shareOn}
        onShareOnChange={share.setShareOn}
        canShare={share.canShare}
        reason={share.reason}
        preview={state.drinkName || state.tastingTaste || "お酒"}
      />
      <SaveBar
        label={shareSaveLabel(share.shareOn, share.canShare, saveButtonLabel(false, photoStatus))}
        pending={create.isPending}
        disabled={!canSubmit}
        hint={
          !canSubmit
            ? tastingPhotoStatus === "uploading" || tastingPhotoStatus === "error"
              ? logSaveDisabledHint(state, errors, tastingPhotoStatus)
              : logSaveDisabledHint(state, errors, photoStatus)
            : null
        }
        state={create.isPending ? "loading" : saveState}
        onSave={submit}
      />
      <Dialog
        open={discardOpen}
        title={DISCARD_TITLE}
        body={attachment ? DISCARD_BODY_WITH_PHOTO : DISCARD_BODY}
        primaryLabel="破棄する"
        destructive
        pending={discarding}
        onPrimary={() => void discard()}
        onClose={() => {
          setDiscardOpen(false);
          pendingLeave.current = null;
        }}
      />
    </div>
  );
}
