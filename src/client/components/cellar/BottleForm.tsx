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
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import {
  BOTTLE_DETAILS_ERROR_FIELDS,
  BOTTLE_SAVE_LABELS,
  type BottleFormErrors,
  type BottleFormField,
  type BottleFormState,
  canSubmitBottleForm,
  createEmptyBottleForm,
  firstBottleDetailsErrorField,
  hasBottleDetails,
  isBottleFormDirty,
  resolveCreateStoredOn,
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
  BOTTLE_FIELD_LABELS,
  BOTTLE_MEMO_MAX_LENGTH,
  BOTTLE_NAME_MAX_LENGTH,
  BOTTLE_TEXT_MAX_LENGTH,
  type Bottle,
} from "@/shared/bottles.ts";
import { tokyoToday } from "@/shared/tokyo-date.ts";
import { CountStepper } from "./CountStepper.tsx";

const DETAIL_FIELD_IDS: Record<(typeof BOTTLE_DETAILS_ERROR_FIELDS)[number], string> = {
  storedOn: "bottle-stored-on",
  storage: "bottle-storage",
  purchasedOn: "bottle-purchased-on",
  priceJpy: "bottle-price",
  shop: "bottle-shop",
  memo: "bottle-memo",
};

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
  initial,
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
  const reduceMotion = useReducedMotion();
  const [baseline] = useState(() => initial ?? createEmptyBottleForm());
  const [state, setState] = useState(baseline);
  const [detailsOpen, setDetailsOpen] = useState(() => hasBottleDetails(baseline));
  const [keptPhotoId, setKeptPhotoId] = useState(existingPhotoId);
  const [photoDeleting, setPhotoDeleting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [recognizeStatus, setRecognizeStatus] = useState<RecognizeBannerStatus | null>(null);
  const [aiMarks, setAiMarks] = useState<Set<RecognizeMarkField>>(new Set());
  const [drinkTypeTouched, setDrinkTypeTouched] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<BottleFormField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [storedOnTouched, setStoredOnTouched] = useState(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const ignoreRecognizeRef = useRef(false);
  const recognizeJpegRef = useRef<Blob | null>(null);
  const recognizeRequestRef = useRef(0);
  const drinkTypeTouchedRef = useRef(false);
  const aiMarksRef = useRef(aiMarks);
  const storedOnTouchedRef = useRef(false);
  drinkTypeTouchedRef.current = drinkTypeTouched;
  aiMarksRef.current = aiMarks;
  storedOnTouchedRef.current = storedOnTouched;
  const attachment = attachments.cellar;
  const photoStatus: PhotoSaveStatus = attachment
    ? attachment.status
    : keptPhotoId
      ? "ready"
      : "none";
  const clientErrors = validateBottleForm(state);
  const errors: BottleFormErrors = visibleFieldErrors(clientErrors, serverErrors, {
    touched,
    submitAttempted,
  });
  const dirty =
    isBottleFormDirty(state, baseline, mode === "new") ||
    attachment !== undefined ||
    keptPhotoId !== existingPhotoId;
  const blockingErrors: BottleFormErrors = { ...clientErrors, ...serverErrors };
  if (!detailsOpen && firstBottleDetailsErrorField(blockingErrors)) {
    for (const field of BOTTLE_DETAILS_ERROR_FIELDS) {
      delete blockingErrors[field];
    }
  }
  const canSubmit =
    dirty && canSubmitBottleForm(state, blockingErrors, photoStatus) && !photoDeleting && !deleting;
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
    if (patch.variety !== undefined) {
      clearAiMark("variety");
    }
    if (patch.vintage !== undefined) {
      clearAiMark("vintage");
    }
    if (patch.storedOn !== undefined) {
      storedOnTouchedRef.current = true;
      setStoredOnTouched(true);
    }
    setTouched((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof BottleFormState)[]) {
        next[key] = true;
      }
      return next;
    });
    setState((current) => ({ ...current, ...patch }));
    onClearServer();
  }

  function scrollToDetailsField(field: (typeof BOTTLE_DETAILS_ERROR_FIELDS)[number]) {
    const node = document.getElementById(DETAIL_FIELD_IDS[field]);
    node?.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    if (node instanceof HTMLElement) {
      node.focus({ preventScroll: true });
    }
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

  useEffect(() => {
    const field = firstBottleDetailsErrorField(serverErrors);
    if (!field) {
      return;
    }
    setDetailsOpen(true);
    setSubmitAttempted(true);
    const frame = requestAnimationFrame(() => {
      const node = document.getElementById(DETAIL_FIELD_IDS[field]);
      node?.scrollIntoView({ block: "center", behavior: "auto" });
      if (node instanceof HTMLElement) {
        node.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [serverErrors]);

  function submit() {
    if (pending || photoDeleting || deleting) {
      return;
    }
    setSubmitAttempted(true);
    const now = new Date();
    const resolvedState: BottleFormState =
      mode === "new"
        ? {
            ...state,
            storedOn: resolveCreateStoredOn(state, storedOnTouchedRef.current, now) ?? "",
          }
        : state;
    if (mode === "new" && resolvedState.storedOn !== state.storedOn) {
      setState(resolvedState);
    }
    const nextErrors = { ...validateBottleForm(resolvedState, now), ...serverErrors };
    const detailsField = firstBottleDetailsErrorField(nextErrors);
    if (detailsField) {
      setDetailsOpen(true);
      requestAnimationFrame(() => scrollToDetailsField(detailsField));
    }
    if (!dirty || !canSubmitBottleForm(resolvedState, nextErrors, photoStatus) || pending) {
      return;
    }
    ignoreRecognizeRef.current = true;
    if (mode === "new") {
      onCreate?.(
        toCreateBottleBody(resolvedState, attachment?.photoId ?? null, {
          now,
          storedOnTouched: storedOnTouchedRef.current,
        }),
      );
      return;
    }
    onUpdate?.(
      toUpdateBottleBody(
        resolvedState,
        baseline,
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
      <div className="bottle-details-pair">
        <DetailField
          id="bottle-vintage"
          label={BOTTLE_FIELD_LABELS.vintage}
          value={state.vintage}
          inputMode="numeric"
          placeholder="NV"
          error={errors.vintage}
          aiMarked={aiMarks.has("vintage")}
          onChange={(vintage) => update({ vintage })}
        />
        <DetailField
          id="bottle-variety"
          label={BOTTLE_FIELD_LABELS.variety}
          value={state.variety}
          maxLength={BOTTLE_TEXT_MAX_LENGTH}
          placeholder="例：カベルネ"
          error={errors.variety}
          aiMarked={aiMarks.has("variety")}
          onChange={(variety) => update({ variety })}
        />
      </div>
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
        placeholder="例：シチリア"
        error={errors.origin}
        aiMarked={aiMarks.has("origin")}
        onChange={(origin) => update({ origin })}
      />
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
            <DetailsSection title="保管情報">
              <DetailField
                id="bottle-stored-on"
                label={BOTTLE_FIELD_LABELS.storedOn}
                value={state.storedOn}
                type="date"
                max={tokyoToday()}
                hint={mode === "new" ? "初期値は登録日です。変更できます。" : undefined}
                error={errors.storedOn}
                onChange={(storedOn) => update({ storedOn })}
              />
              <DetailField
                id="bottle-storage"
                label={BOTTLE_FIELD_LABELS.storage}
                value={state.storage}
                maxLength={BOTTLE_TEXT_MAX_LENGTH}
                error={errors.storage}
                onChange={(storage) => update({ storage })}
              />
            </DetailsSection>
            <DetailsSection title="購入情報" optional>
              <div className="bottle-details-pair">
                <DetailField
                  id="bottle-purchased-on"
                  label={BOTTLE_FIELD_LABELS.purchasedOn}
                  value={state.purchasedOn}
                  type="date"
                  max={tokyoToday()}
                  placeholder="日付を選択"
                  error={errors.purchasedOn}
                  onChange={(purchasedOn) => update({ purchasedOn })}
                />
                <DetailField
                  id="bottle-price"
                  label={BOTTLE_FIELD_LABELS.priceJpy}
                  value={state.priceJpy}
                  inputMode="numeric"
                  placeholder="¥ 未入力"
                  error={errors.priceJpy}
                  onChange={(priceJpy) => update({ priceJpy })}
                />
              </div>
              <DetailField
                id="bottle-shop"
                label="購入場所"
                value={state.shop}
                maxLength={BOTTLE_TEXT_MAX_LENGTH}
                placeholder="店舗名・オンラインショップなど"
                error={errors.shop}
                onChange={(shop) => update({ shop })}
              />
            </DetailsSection>
            <DetailsSection title="メモ" optional>
              <div className="bottle-details-field">
                <label className="field-label" htmlFor="bottle-memo">
                  メモ
                </label>
                <textarea
                  id="bottle-memo"
                  className="memo-textarea bottle-details-memo"
                  maxLength={BOTTLE_MEMO_MAX_LENGTH}
                  rows={3}
                  placeholder="保管やボトルについてのメモ"
                  value={state.memo}
                  aria-invalid={errors.memo ? true : undefined}
                  onChange={(event) => update({ memo: event.target.value })}
                />
                <p className="memo-count">
                  {state.memo.length} / {BOTTLE_MEMO_MAX_LENGTH}
                </p>
                {errors.memo ? (
                  <p className="field-error" role="alert">
                    {errors.memo}
                  </p>
                ) : null}
              </div>
            </DetailsSection>
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

function DetailsSection({
  title,
  optional = false,
  children,
}: {
  title: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="bottle-details-section">
      <header className="bottle-details-heading">
        <h3 className="bottle-details-title">{title}</h3>
        {optional ? <span className="bottle-details-optional">任意</span> : null}
      </header>
      {children}
    </section>
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
  type,
  max,
  hint,
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
  type?: "date";
  max?: string;
  hint?: string;
  aiMarked?: boolean;
}) {
  return (
    <div className="bottle-details-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <FieldWithAiMark marked={aiMarked}>
        <Input
          id={id}
          type={type}
          value={value}
          max={max}
          maxLength={maxLength}
          inputMode={inputMode}
          placeholder={placeholder}
          className={type === "date" ? "field-date" : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      </FieldWithAiMark>
      {hint ? <p className="field-hint">{hint}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function visibleFieldErrors(
  clientErrors: BottleFormErrors,
  serverErrors: BottleFormErrors,
  options: {
    touched: Partial<Record<BottleFormField, boolean>>;
    submitAttempted: boolean;
  },
): BottleFormErrors {
  const visible: BottleFormErrors = { ...serverErrors };
  for (const [key, message] of Object.entries(clientErrors) as [BottleFormField, string][]) {
    if (options.submitAttempted || options.touched[key]) {
      visible[key] = serverErrors[key] ?? message;
    }
  }
  return visible;
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
