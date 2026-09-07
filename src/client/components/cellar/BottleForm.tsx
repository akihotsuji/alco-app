import { ChevronDown, Sparkles } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { RecognizeBanner } from "@/client/components/cellar/RecognizeBanner.tsx";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useCaptureOnCameraQuery } from "@/client/hooks/use-capture-on-camera-query.ts";
import { deletePhoto, photoContentUrl } from "@/client/hooks/use-photos.ts";
import {
  BOTTLE_SAVE_LABELS,
  type BottleFormErrors,
  type BottleFormState,
  canSubmitBottleForm,
  hasBottleDetails,
  INITIAL_BOTTLE_FORM,
  isBottleFormDirty,
  toCreateBottleBody,
  toUpdateBottleBody,
  validateBottleForm,
} from "@/client/lib/bottle-form.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { rememberShelfEvent } from "@/client/lib/history-state.ts";
import {
  applyRecognizeToForm,
  countRecognizeFields,
  type RecognizeBannerStatus,
  type RecognizeMarkField,
} from "@/client/lib/label-recognize.ts";
import type { PhotoSaveStatus } from "@/client/lib/log-form.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { IMAGE_PICK_LABELS } from "@/client/lib/photo/pick-image.ts";
import { getCellarRecognizePref } from "@/client/lib/preferences.ts";
import { startLabelRecognition } from "@/client/lib/recognize-session.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import {
  arrangedToastMessage,
  BOTTLE_MEMO_MAX_LENGTH,
  BOTTLE_NAME_MAX_LENGTH,
  BOTTLE_TEXT_MAX_LENGTH,
  type Bottle,
} from "@/shared/bottles.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { CountStepper } from "./CountStepper.tsx";

const DISCARD_TITLE = "入力を破棄しますか";
const DISCARD_BODY = "入力した内容は保存されません";
const DISCARD_BODY_WITH_PHOTO = "入力した内容は保存されず、写真も削除されます";
const DELETE_TITLE = "このボトルを削除しますか";
const DELETE_BODY = "ノートは残ります。記録のボトル名は残ります";

type BottleFormProps = {
  mode: "new" | "edit";
  initial?: BottleFormState;
  existingPhotoId?: string | null;
  onCreate?: (body: ReturnType<typeof toCreateBottleBody>) => void;
  onUpdate?: (body: ReturnType<typeof toUpdateBottleBody>) => void;
  onDelete?: () => void;
  pending: boolean;
  deleting?: boolean;
  saveState: MotionState;
  formError: string | null;
  serverErrors: BottleFormErrors;
  onClearServer: () => void;
};

export function BottleFormFields({
  mode,
  initial = INITIAL_BOTTLE_FORM,
  existingPhotoId = null,
  onCreate,
  onUpdate,
  onDelete,
  pending,
  deleting = false,
  saveState,
  formError,
  serverErrors,
  onClearServer,
}: BottleFormProps) {
  const { setGuard } = useLeaveGuard();
  const { editAttachment, pendingRecognizeJpeg } = usePhotoEdit();
  const { startCapture, attachments, retryUpload, clearAttachment } = useCaptureOnCameraQuery(
    "cellar",
    mode === "new",
  );
  const { showToast } = useToast();
  const [state, setState] = useState(initial);
  const [detailsOpen, setDetailsOpen] = useState(hasBottleDetails(initial));
  const [keptPhotoId, setKeptPhotoId] = useState(existingPhotoId);
  const [photoDeleting, setPhotoDeleting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recognizeStatus, setRecognizeStatus] = useState<RecognizeBannerStatus | null>(null);
  const [aiMarks, setAiMarks] = useState<Set<RecognizeMarkField>>(new Set());
  const [drinkTypeTouched, setDrinkTypeTouched] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const ignoreRecognizeRef = useRef(false);
  const recognizeJpegRef = useRef<Blob | null>(null);
  const recognizeRequestRef = useRef(0);
  const drinkTypeTouchedRef = useRef(false);
  const aiMarksRef = useRef(aiMarks);
  drinkTypeTouchedRef.current = drinkTypeTouched;
  aiMarksRef.current = aiMarks;
  const attachment = attachments.cellar;
  const photoStatus: PhotoSaveStatus = attachment
    ? attachment.status
    : keptPhotoId
      ? "ready"
      : "none";
  const errors: BottleFormErrors = { ...validateBottleForm(state), ...serverErrors };
  const dirty =
    isBottleFormDirty(state, initial, mode === "new") ||
    attachment !== undefined ||
    keptPhotoId !== existingPhotoId;
  const canSubmit =
    dirty && canSubmitBottleForm(state, errors, photoStatus) && !photoDeleting && !deleting;
  const detailsId = useId();

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

  function clearAiMark(field: RecognizeMarkField) {
    setAiMarks((current) => {
      if (!current.has(field)) {
        return current;
      }
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  }

  function update(patch: Partial<BottleFormState>) {
    if (patch.name !== undefined) {
      clearAiMark("name");
    }
    if (patch.producer !== undefined) {
      clearAiMark("producer");
    }
    if (patch.origin !== undefined) {
      clearAiMark("origin");
    }
    if (patch.vintage !== undefined) {
      clearAiMark("vintage");
    }
    setState((current) => ({ ...current, ...patch }));
    onClearServer();
  }

  // 「使う」直後、切り抜き・アップロードを待たずに読み取りを始める（Issue #48 D-1）。
  // 結果は attachment 側の effect が同じ Blob で受け取る（1 リクエストにまとまる）
  useEffect(() => {
    if (mode !== "new" || !getCellarRecognizePref() || !pendingRecognizeJpeg) {
      return;
    }
    startLabelRecognition(pendingRecognizeJpeg).catch(() => {});
  }, [mode, pendingRecognizeJpeg]);

  useEffect(() => {
    if (mode !== "new" || !getCellarRecognizePref()) {
      setRecognizeStatus(null);
      return;
    }
    const jpeg = attachment?.recognizeJpeg;
    if (!jpeg) {
      if (!attachment) {
        setRecognizeStatus(null);
        recognizeJpegRef.current = null;
      }
      return;
    }
    if (jpeg === recognizeJpegRef.current) {
      return;
    }
    recognizeJpegRef.current = jpeg;
    const requestId = recognizeRequestRef.current + 1;
    recognizeRequestRef.current = requestId;
    setRecognizeStatus("loading");
    void startLabelRecognition(jpeg)
      .then((result) => {
        if (ignoreRecognizeRef.current || requestId !== recognizeRequestRef.current) {
          return;
        }
        if (countRecognizeFields(result.fields) === 0) {
          setRecognizeStatus("failure");
          return;
        }
        let applied: ReturnType<typeof applyRecognizeToForm> | undefined;
        setState((current) => {
          applied = applyRecognizeToForm({
            state: current,
            fields: result.fields,
            drinkTypeTouched: drinkTypeTouchedRef.current,
            marks: aiMarksRef.current,
          });
          return applied.next;
        });
        if (applied) {
          setAiMarks(applied.marks);
          if (applied.openDetails) {
            setDetailsOpen(true);
          }
        }
        setRecognizeStatus("success");
      })
      .catch(() => {
        if (ignoreRecognizeRef.current || requestId !== recognizeRequestRef.current) {
          return;
        }
        setRecognizeStatus("failure");
      });
  }, [attachment, mode]);

  function submit() {
    if (!canSubmit || pending) {
      return;
    }
    ignoreRecognizeRef.current = true;
    if (mode === "new") {
      onCreate?.(toCreateBottleBody(state, attachment?.photoId ?? null));
      return;
    }
    onUpdate?.(
      toUpdateBottleBody(
        state,
        initial,
        attachment?.photoId ?? null,
        keptPhotoId === null && existingPhotoId !== null,
      ),
    );
  }

  async function removeExistingPhoto() {
    if (!keptPhotoId || photoDeleting) {
      return;
    }
    setPhotoDeleting(true);
    try {
      await deletePhoto(keptPhotoId);
      setKeptPhotoId(null);
    } catch {
      showToast({ message: TOAST_MESSAGES.saveFailed });
    } finally {
      setPhotoDeleting(false);
    }
  }

  async function discard() {
    await clearAttachment("cellar");
    savedRef.current = true;
    setGuard(null);
    setDiscardOpen(false);
    pendingLeave.current?.();
    pendingLeave.current = null;
  }

  return (
    <div className="form-page bottle-form">
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      {attachment ? (
        <PhotoTile
          onClick={() => void startCapture("cellar")}
          showMascot={false}
          ratio="bottle"
          attachment={attachment}
          onEdit={() => void editAttachment("cellar")}
          onRetry={() => void retryUpload("cellar")}
          onClear={() => void clearAttachment("cellar")}
          error={errors.photoIds}
        />
      ) : keptPhotoId ? (
        <div className="photo-thumb-row">
          <div className="photo-thumb photo-thumb-bottle">
            <img className="photo-thumb-img" src={photoContentUrl(keptPhotoId)} alt="" />
          </div>
          <div className="photo-thumb-actions">
            <button
              type="button"
              className="header-text-link"
              onClick={() => void startCapture("cellar")}
            >
              撮り直す
            </button>
            <button
              type="button"
              className="header-text-link"
              onClick={() => void startCapture("cellar", { source: "library" })}
            >
              {IMAGE_PICK_LABELS.library}
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
        <PhotoTile
          onClick={() => void startCapture("cellar")}
          onLibraryClick={() => void startCapture("cellar", { source: "library" })}
          showMascot={false}
          ratio="bottle"
          error={errors.photoIds}
        />
      )}
      {mode === "new" && recognizeStatus ? <RecognizeBanner status={recognizeStatus} /> : null}
      <div className="log-form-section">
        <label className="field-label" htmlFor="bottle-name">
          銘柄名
        </label>
        <FieldWithAiMark marked={aiMarks.has("name")}>
          <Input
            id="bottle-name"
            value={state.name}
            maxLength={BOTTLE_NAME_MAX_LENGTH}
            aria-invalid={errors.name ? true : undefined}
            onChange={(event) => update({ name: event.target.value })}
          />
        </FieldWithAiMark>
        {errors.name ? (
          <p className="field-error" role="alert">
            {errors.name}
          </p>
        ) : null}
      </div>
      <DrinkTypeChips
        value={state.drinkType}
        onChange={(drinkType) => {
          setDrinkTypeTouched(true);
          update({ drinkType });
        }}
      />
      {mode === "new" ? (
        <CountStepper value={state.count} onChange={(count) => update({ count })} />
      ) : null}
      <section className="log-form-section">
        <button
          type="button"
          className={detailsOpen ? "form-row form-row-toggle is-open" : "form-row form-row-toggle"}
          aria-expanded={detailsOpen}
          aria-controls={detailsId}
          onClick={() => setDetailsOpen((current) => !current)}
        >
          <span className="form-row-label">詳細</span>
          <span className="form-row-value" />
          <ChevronDown size={20} className="form-row-chevron" aria-hidden />
        </button>
        {detailsOpen ? (
          <div id={detailsId} className="bottle-details">
            <DetailField
              id="bottle-producer"
              label="生産者"
              value={state.producer}
              maxLength={BOTTLE_TEXT_MAX_LENGTH}
              error={errors.producer}
              aiMarked={aiMarks.has("producer")}
              onChange={(producer) => update({ producer })}
            />
            <DetailField
              id="bottle-origin"
              label="産地"
              value={state.origin}
              maxLength={BOTTLE_TEXT_MAX_LENGTH}
              error={errors.origin}
              aiMarked={aiMarks.has("origin")}
              onChange={(origin) => update({ origin })}
            />
            <DetailField
              id="bottle-vintage"
              label="年"
              value={state.vintage}
              inputMode="numeric"
              placeholder="NV"
              error={errors.vintage}
              aiMarked={aiMarks.has("vintage")}
              onChange={(vintage) => update({ vintage })}
            />
            <div className="log-form-section">
              <label className="field-label" htmlFor="bottle-purchased-on">
                購入日
              </label>
              <Input
                id="bottle-purchased-on"
                type="date"
                value={state.purchasedOn}
                max={tokyoToday()}
                aria-invalid={errors.purchasedOn ? true : undefined}
                onChange={(event) => update({ purchasedOn: event.target.value })}
              />
              {errors.purchasedOn ? (
                <p className="field-error" role="alert">
                  {errors.purchasedOn}
                </p>
              ) : null}
            </div>
            <DetailField
              id="bottle-price"
              label="価格"
              value={state.priceJpy}
              inputMode="numeric"
              error={errors.priceJpy}
              onChange={(priceJpy) => update({ priceJpy })}
            />
            <DetailField
              id="bottle-shop"
              label="購入場所"
              value={state.shop}
              maxLength={BOTTLE_TEXT_MAX_LENGTH}
              error={errors.shop}
              onChange={(shop) => update({ shop })}
            />
            <DetailField
              id="bottle-storage"
              label="保管場所"
              value={state.storage}
              maxLength={BOTTLE_TEXT_MAX_LENGTH}
              error={errors.storage}
              onChange={(storage) => update({ storage })}
            />
            <div className="log-form-section">
              <label className="field-label" htmlFor="bottle-memo">
                メモ
              </label>
              <textarea
                id="bottle-memo"
                className="memo-textarea"
                maxLength={BOTTLE_MEMO_MAX_LENGTH}
                rows={3}
                value={state.memo}
                aria-invalid={errors.memo ? true : undefined}
                onChange={(event) => update({ memo: event.target.value })}
              />
              <p className="memo-count">残り {BOTTLE_MEMO_MAX_LENGTH - state.memo.length} 文字</p>
              {errors.memo ? (
                <p className="field-error" role="alert">
                  {errors.memo}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
      <SaveBar
        label={mode === "new" ? BOTTLE_SAVE_LABELS.arrange(state.count) : BOTTLE_SAVE_LABELS.save}
        pending={pending}
        disabled={!canSubmit}
        state={pending ? "loading" : saveState}
        onSave={submit}
      />
      {mode === "edit" && onDelete ? (
        <button type="button" className="log-delete" onClick={() => setDeleteOpen(true)}>
          このボトルを削除
        </button>
      ) : null}
      <Dialog
        open={discardOpen}
        title={DISCARD_TITLE}
        body={attachment ? DISCARD_BODY_WITH_PHOTO : DISCARD_BODY}
        primaryLabel="破棄する"
        destructive
        onPrimary={() => void discard()}
        onClose={() => {
          setDiscardOpen(false);
          pendingLeave.current = null;
        }}
      />
      {onDelete ? (
        <Dialog
          open={deleteOpen}
          title={DELETE_TITLE}
          body={DELETE_BODY}
          primaryLabel="削除する"
          destructive
          pending={deleting}
          onPrimary={onDelete}
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </div>
  );
}

function FieldWithAiMark({ marked, children }: { marked: boolean; children: ReactNode }) {
  return (
    <div className={marked ? "field-with-ai is-ai" : "field-with-ai"}>
      {children}
      {marked ? (
        <span className="pill ai">
          <Sparkles size={11} aria-hidden />
          AI
        </span>
      ) : null}
    </div>
  );
}

function DetailField({
  id,
  label,
  value,
  onChange,
  error,
  maxLength,
  inputMode,
  placeholder,
  aiMarked = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength?: number;
  inputMode?: "numeric";
  placeholder?: string;
  aiMarked?: boolean;
}) {
  return (
    <div className="log-form-section">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <FieldWithAiMark marked={aiMarked}>
        <Input
          id={id}
          value={value}
          maxLength={maxLength}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldWithAiMark>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function useBottleFormSubmit() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { releaseAttachment } = usePhotoEdit();
  const { setGuard } = useLeaveGuard();

  function markSaved() {
    setGuard(null);
    releaseAttachment("cellar");
  }

  function afterCreate(items: Bottle[]) {
    const first = items[0];
    if (!first) {
      return;
    }
    markSaved();
    haptic("success");
    rememberShelfEvent({
      kind: "placed",
      bottleId: first.id,
      createdAt: first.createdAt,
      drinkType: first.drinkType,
    });
    showToast({ message: arrangedToastMessage(items.length), cheer: true });
    navigate(`/cellar/${first.id}`, { replace: true });
  }

  function afterUpdate(bottle: Bottle) {
    markSaved();
    haptic("success");
    showToast({ message: TOAST_MESSAGES.saved });
    navigate(`/cellar/${bottle.id}`, { replace: true });
  }

  function afterDelete() {
    markSaved();
    showToast({ message: TOAST_MESSAGES.deleted, cheer: false });
    navigate("/cellar", { replace: true });
  }

  return { afterCreate, afterUpdate, afterDelete };
}
