import { Camera, ChevronDown, Images, Minus, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { CellarDestinationField } from "@/client/components/cellar/CellarDestinationField.tsx";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { FieldWithAiMark } from "@/client/components/form/FieldWithAiMark.tsx";
import { OriginCountryField } from "@/client/components/form/OriginCountryField.tsx";
import { ShareField, shareSaveLabel } from "@/client/components/friends/ShareField.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useBottleBatch } from "@/client/hooks/use-bottle-batch.ts";
import { useCellarSelection } from "@/client/hooks/use-cellar-selection.ts";
import { useShareIntent } from "@/client/hooks/use-share-intent.ts";
import { BACK_PHOTO_LABELS } from "@/client/lib/bottle-back-photo.ts";
import {
  BOTTLE_BATCH_MESSAGES,
  type BottleBatchRow,
  batchIngestProgress,
  batchRowErrors,
  batchRowStageLabel,
  batchSubmitCount,
  batchTotalCount,
  canSubmitBatch,
  remainingBatchRows,
} from "@/client/lib/bottle-batch.ts";
import { BOTTLE_SAVE_LABELS, type BottleFormState } from "@/client/lib/bottle-form.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { rememberShelfEvent } from "@/client/lib/history-state.ts";
import {
  RECOGNIZE_BANNER,
  RECOGNIZE_RETRY_LABEL,
  RECOGNIZE_WITH_BACK_LABEL,
  type RecognizeMarkField,
} from "@/client/lib/label-recognize.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { isCutoutBlobType } from "@/client/lib/photo/photo-file.ts";
import { IMAGE_PICK_LABELS, type ImagePickSource } from "@/client/lib/photo/pick-image.ts";
import {
  arrangedToastMessage,
  BOTTLE_COUNT_MAX,
  BOTTLE_COUNT_MIN,
  BOTTLE_FIELD_LABELS,
  BOTTLE_NAME_MAX_LENGTH,
  BOTTLE_TEXT_MAX_LENGTH,
  formatBottleCount,
} from "@/shared/bottles.ts";

const DISCARD_TITLE = "入力を破棄しますか";

/** `bottle-batch` まとめて追加（04-cellar）。1 枚の写真 = 1 行、最後に 1 回で棚に並べる */
export function BottleBatchForm() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { setGuard } = useLeaveGuard();
  const batch = useBottleBatch(true);
  const share = useShareIntent();
  const { items, selected } = useCellarSelection();
  const [destinationId, setDestinationId] = useState<string | undefined>(undefined);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const total = batchTotalCount(batch.rows);
  const savableCount = batchSubmitCount(batch.rows);
  const progress = batchIngestProgress(batch.rows);
  const formBusy = batch.submitting;
  const canSubmit = canSubmitBatch(batch.rows) && !formBusy;
  useEffect(() => {
    if (!destinationId && selected?.id) {
      setDestinationId(selected.id);
    }
  }, [destinationId, selected?.id]);
  const destination = items.find((item) => item.id === destinationId) ?? selected;

  useSetHeaderOverride({
    titleMuted: batch.rows.length > 0 ? formatBottleCount(total) : undefined,
  });

  useEffect(() => {
    if (batch.rows.length === 0 || savedRef.current) {
      setGuard(null);
      return;
    }
    setGuard((proceed) => {
      pendingLeave.current = proceed;
      setDiscardOpen(true);
    });
    return () => setGuard(null);
  }, [batch.rows.length, setGuard]);

  async function discard() {
    await batch.discardAll();
    savedRef.current = true;
    setGuard(null);
    setDiscardOpen(false);
    pendingLeave.current?.();
    pendingLeave.current = null;
  }

  async function submit() {
    if (!canSubmit) {
      return;
    }
    setFormError(null);
    setSaveState("loading");
    if (!destination) {
      setFormError("保存先のセラーを確認してください");
      setSaveState("error");
      return;
    }
    const result = await batch.submit(destination.id);
    if (result.registrationBatchId && result.created.length > 0) {
      const status = await share.shareIfNeeded({
        kind: "cellar_batch",
        registrationBatchId: result.registrationBatchId,
      });
      if (status === "failed") {
        showToast({ message: "記録は保存しました。友達への共有に失敗しました" });
      }
    }
    if (result.failedCount > 0 || result.leftoverCount > 0) {
      setSaveState(result.failedCount > 0 ? "error" : "idle");
      setFormError(
        result.failedCount > 0
          ? BOTTLE_BATCH_MESSAGES.partialFailure(result.failedCount)
          : result.leftoverMessage,
      );
      if (result.created.length > 0) {
        showToast({
          message: arrangedToastMessage(result.created.length),
          cheer: result.failedCount === 0,
        });
      }
      return;
    }
    const first = result.created[0];
    savedRef.current = true;
    setGuard(null);
    haptic("success");
    if (first) {
      rememberShelfEvent({
        kind: "placed",
        bottleId: first.id,
        createdAt: first.createdAt,
        drinkType: first.drinkType,
      });
    }
    showToast({ message: arrangedToastMessage(result.created.length), cheer: true });
    navigate("/cellar", { replace: true });
  }

  const captureLabel =
    batch.rows.length === 0
      ? BOTTLE_BATCH_MESSAGES.captureFirst
      : BOTTLE_BATCH_MESSAGES.captureNext(remainingBatchRows(batch.rows));

  return (
    <div className="form-page bottle-form bottle-batch">
      <CellarDestinationField
        items={items}
        valueId={destination?.id}
        disabled={formBusy}
        onChange={(cellar) => setDestinationId(cellar.id)}
      />
      {formError ? (
        <p className="form-error" role="alert">
          {formError}
        </p>
      ) : null}
      {batch.rows.length === 0 ? (
        <p className="bottle-batch-empty">{BOTTLE_BATCH_MESSAGES.empty}</p>
      ) : null}
      <ol className="bottle-batch-rows">
        {batch.rows.map((row, index) => (
          <BatchRowCard
            key={row.key}
            row={row}
            index={index}
            disabled={formBusy}
            onPatch={(patch) => batch.patchRow(row.key, patch)}
            onToggleDetails={() => batch.toggleDetails(row.key)}
            onEditPhoto={() => void batch.editPhoto(row.key)}
            onRetryRow={() => void batch.retryRow(row.key)}
            onReplacePhoto={() => void batch.replacePhoto(row.key)}
            onRemove={() => void batch.removeRow(row.key)}
            onRecognizeRetry={() => batch.recognizeRow(row.key)}
            onAddBackPhoto={(source) => void batch.addBackPhoto(row.key, source)}
            onRetryBackPhoto={() => void batch.retryBackPhoto(row.key)}
            onRemoveBackPhoto={() => batch.removeBackPhoto(row.key)}
          />
        ))}
      </ol>
      {progress.total > 0 ? (
        <p className="bottle-batch-progress" role="status">
          {BOTTLE_BATCH_MESSAGES.progress(progress)}
        </p>
      ) : null}
      {batch.notice ? (
        <p className="field-hint" role="status">
          {batch.notice}
        </p>
      ) : null}
      <div className="photo-action-row bottle-batch-add">
        <button
          type="button"
          className="photo-action"
          disabled={!batch.canAdd || formBusy}
          onClick={() => void batch.addPhoto("camera")}
        >
          <Camera size={18} aria-hidden />
          {captureLabel}
        </button>
        <button
          type="button"
          className="photo-action"
          disabled={!batch.canAdd || formBusy}
          onClick={() => void batch.addLibraryPhotos()}
        >
          <Images size={18} aria-hidden />
          {IMAGE_PICK_LABELS.libraryMultiple}
        </button>
      </div>
      {!batch.canAdd ? <p className="field-hint">{BOTTLE_BATCH_MESSAGES.rowLimit}</p> : null}
      <ShareField
        shareOn={share.shareOn}
        onShareOnChange={share.setShareOn}
        canShare={share.canShare}
        reason={share.reason}
      />
      <SaveBar
        label={shareSaveLabel(
          share.shareOn,
          share.canShare,
          BOTTLE_SAVE_LABELS.arrange(savableCount),
        )}
        pending={batch.submitting}
        disabled={!canSubmit}
        state={batch.submitting ? "loading" : saveState}
        onSave={() => void submit()}
      />
      <Dialog
        open={discardOpen}
        title={DISCARD_TITLE}
        body={BOTTLE_BATCH_MESSAGES.discardBody}
        primaryLabel="破棄する"
        destructive
        onPrimary={() => void discard()}
        onClose={() => {
          setDiscardOpen(false);
          pendingLeave.current = null;
        }}
      />
    </div>
  );
}

function BatchRowCard({
  row,
  index,
  disabled,
  onPatch,
  onToggleDetails,
  onEditPhoto,
  onRetryRow,
  onReplacePhoto,
  onRemove,
  onRecognizeRetry,
  onAddBackPhoto,
  onRetryBackPhoto,
  onRemoveBackPhoto,
}: {
  row: BottleBatchRow;
  index: number;
  disabled: boolean;
  onPatch: (patch: Partial<BottleFormState>) => void;
  onToggleDetails: () => void;
  onEditPhoto: () => void;
  onRetryRow: () => void;
  onReplacePhoto: () => void;
  onRemove: () => void;
  onRecognizeRetry: () => void;
  onAddBackPhoto: (source: ImagePickSource) => void;
  onRetryBackPhoto: () => void;
  onRemoveBackPhoto: () => void;
}) {
  const id = useId();
  const errors = batchRowErrors(row);
  const marks = new Set<RecognizeMarkField>(row.aiMarks);
  const nameId = `${id}-name`;
  const detailsId = `${id}-details`;
  const cutout = row.photo ? isCutoutBlobType(row.photo.blob.type) : false;
  const stageLabel = batchRowStageLabel(row);
  const hasPreview = Boolean(row.photo?.previewUrl);
  const processing =
    row.phase === "queued" || row.phase === "converting" || row.phase === "uploading";
  const failed = row.phase === "error";

  return (
    <li
      className={failed ? "bottle-batch-row is-error" : "bottle-batch-row"}
      aria-label={`${index + 1} 本目`}
    >
      <div className="bottle-batch-row-main">
        <div className="bottle-batch-photos">
          <div
            className={
              cutout ? "photo-thumb bottle-batch-thumb is-cutout" : "photo-thumb bottle-batch-thumb"
            }
          >
            {hasPreview ? (
              <button
                type="button"
                className="bottle-batch-thumb-button"
                aria-label="写真を編集"
                disabled={disabled || !row.photo?.blob.size}
                onClick={onEditPhoto}
              >
                <ContentPhoto
                  src={row.photo?.previewUrl ?? ""}
                  className="photo-thumb-img"
                  size={PHOTO_DISPLAY_SIZE.bottleTile}
                  loading="eager"
                />
              </button>
            ) : (
              <span className="bottle-batch-thumb-placeholder" aria-hidden>
                {processing ? <span className="recognize-spinner" /> : null}
              </span>
            )}
            {processing ? (
              <span className="photo-tile-progress" role="status">
                {stageLabel ?? BOTTLE_BATCH_MESSAGES.stageUploading}
              </span>
            ) : null}
            {failed ? (
              <button type="button" className="photo-tile-retry" onClick={onRetryRow}>
                <span aria-hidden>!</span>
                <span>再試行</span>
              </button>
            ) : null}
          </div>
          <BatchBackPhoto
            row={row}
            disabled={disabled}
            onAdd={onAddBackPhoto}
            onRetry={onRetryBackPhoto}
            onRemove={onRemoveBackPhoto}
          />
        </div>
        <div className="bottle-batch-fields">
          <div className="bottle-batch-name-row">
            <label className="field-label" htmlFor={nameId}>
              {BOTTLE_FIELD_LABELS.name}
            </label>
            <IconButton
              label="この行を外す"
              className="bottle-batch-remove"
              disabled={disabled}
              onClick={onRemove}
            >
              <X size={18} />
            </IconButton>
          </div>
          <FieldWithAiMark marked={marks.has("name")}>
            <Input
              id={nameId}
              value={row.form.name}
              maxLength={BOTTLE_NAME_MAX_LENGTH}
              disabled={disabled}
              aria-invalid={errors.name ? true : undefined}
              onChange={(event) => onPatch({ name: event.target.value })}
            />
          </FieldWithAiMark>
          {errors.name && row.form.name.length > 0 ? (
            <p className="field-error" role="alert">
              {errors.name}
            </p>
          ) : null}
        </div>
      </div>
      <DrinkTypeChips
        value={row.form.drinkType}
        onChange={(drinkType) => {
          if (!disabled) {
            onPatch({ drinkType });
          }
        }}
      />
      <div className="bottle-batch-count-row">
        <span className="field-label">本数</span>
        <span className="bottle-batch-count-value">
          {row.form.count}
          <span className="score-unit">本</span>
        </span>
        <div className="stepper bottle-batch-stepper">
          <IconButton
            label="本数を減らす"
            disabled={disabled || row.form.count <= BOTTLE_COUNT_MIN}
            onClick={() => onPatch({ count: Math.max(BOTTLE_COUNT_MIN, row.form.count - 1) })}
          >
            <Minus size={18} />
          </IconButton>
          <IconButton
            label="本数を増やす"
            disabled={disabled || row.form.count >= BOTTLE_COUNT_MAX}
            onClick={() => onPatch({ count: Math.min(BOTTLE_COUNT_MAX, row.form.count + 1) })}
          >
            <Plus size={18} />
          </IconButton>
        </div>
        <button
          type="button"
          className={
            row.detailsOpen ? "bottle-batch-details-toggle is-open" : "bottle-batch-details-toggle"
          }
          aria-expanded={row.detailsOpen}
          aria-controls={detailsId}
          onClick={onToggleDetails}
        >
          詳細
          <ChevronDown size={18} className="form-row-chevron" aria-hidden />
        </button>
      </div>
      {row.detailsOpen ? (
        <div id={detailsId} className="bottle-batch-details">
          <DetailField
            id={`${id}-producer`}
            label="生産者"
            value={row.form.producer}
            maxLength={BOTTLE_TEXT_MAX_LENGTH}
            disabled={disabled}
            error={errors.producer}
            aiMarked={marks.has("producer")}
            onChange={(producer) => onPatch({ producer })}
          />
          <OriginCountryField
            id={`${id}-origin`}
            value={row.form.origin}
            disabled={disabled}
            error={errors.origin}
            aiMarked={marks.has("origin")}
            onChange={(origin) => onPatch({ origin })}
          />
          <DetailField
            id={`${id}-vintage`}
            label={BOTTLE_FIELD_LABELS.vintage}
            value={row.form.vintage}
            inputMode="numeric"
            placeholder="未登録"
            layout="inline"
            disabled={disabled}
            error={errors.vintage}
            aiMarked={marks.has("vintage")}
            onChange={(vintage) => onPatch({ vintage })}
          />
          <DetailField
            id={`${id}-variety`}
            label={BOTTLE_FIELD_LABELS.variety}
            value={row.form.variety}
            maxLength={BOTTLE_TEXT_MAX_LENGTH}
            disabled={disabled}
            error={errors.variety}
            aiMarked={marks.has("variety")}
            onChange={(variety) => onPatch({ variety })}
          />
        </div>
      ) : null}
      {stageLabel && (failed || row.cutoutFallback) ? (
        <p
          className={failed ? "field-error bottle-batch-phase is-error" : "bottle-batch-phase"}
          role={failed ? "alert" : "status"}
        >
          {stageLabel}
        </p>
      ) : null}
      {failed ? (
        <div className="bottle-batch-row-actions">
          <button
            type="button"
            className="header-text-link"
            disabled={disabled}
            onClick={onRetryRow}
          >
            再試行
          </button>
          <button
            type="button"
            className="header-text-link"
            disabled={disabled}
            onClick={onReplacePhoto}
          >
            {BOTTLE_BATCH_MESSAGES.pickAgain}
          </button>
        </div>
      ) : null}
      {row.recognize === "loading" || row.recognize === "failure" ? (
        <p className="bottle-batch-recognize" role="status">
          {row.recognize === "loading" ? (
            <span className="recognize-spinner" aria-hidden />
          ) : (
            <Sparkles size={14} aria-hidden />
          )}
          <span className="recognize-banner-text">{RECOGNIZE_BANNER[row.recognize]}</span>
          {row.recognize === "failure" ? (
            <button
              type="button"
              className="header-text-link recognize-retry"
              disabled={disabled}
              onClick={onRecognizeRetry}
            >
              {RECOGNIZE_RETRY_LABEL}
            </button>
          ) : null}
        </p>
      ) : row.recognize === "success" && row.backPhoto?.recognizeJpeg ? (
        <p className="bottle-batch-recognize" role="status">
          <Sparkles size={14} aria-hidden />
          <button
            type="button"
            className="header-text-link recognize-retry"
            disabled={disabled}
            onClick={onRecognizeRetry}
          >
            {RECOGNIZE_WITH_BACK_LABEL}
          </button>
        </p>
      ) : null}
      {row.error ? (
        <p className="field-error" role="alert">
          {row.error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * 行の裏面（04-cellar G2b）。「+ 裏面」を押すと撮る／選ぶの丸ボタンが下へ出る（M-38）。
 * 付けたら 40×60 サムネ + ×
 */
function BatchBackPhoto({
  row,
  disabled,
  onAdd,
  onRetry,
  onRemove,
}: {
  row: BottleBatchRow;
  disabled: boolean;
  onAdd: (source: ImagePickSource) => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sourcesId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (row.backProcessing) {
    return (
      <span className="bottle-batch-back-processing" role="status">
        <span className="recognize-spinner" aria-hidden />
      </span>
    );
  }
  if (!row.backPhoto) {
    const pick = (source: ImagePickSource) => {
      setOpen(false);
      onAdd(source);
    };
    return (
      <div ref={rootRef} className="bottle-batch-back-picker">
        <button
          type="button"
          className="header-text-link bottle-batch-back-add"
          aria-expanded={open}
          aria-controls={sourcesId}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
        >
          {BACK_PHOTO_LABELS.add}
        </button>
        {open ? (
          // biome-ignore lint/a11y/useSemanticElements: 丸ボタン 2 つの縦並び。fieldset だと余白と枠が崩れる
          <div
            id={sourcesId}
            className="bottle-batch-back-sources"
            role="group"
            aria-label={BACK_PHOTO_LABELS.heading}
          >
            <IconButton
              label={BACK_PHOTO_LABELS.capture}
              className="bottle-batch-back-source"
              disabled={disabled}
              onClick={() => pick("camera")}
            >
              <Camera size={18} />
            </IconButton>
            <IconButton
              label={BACK_PHOTO_LABELS.library}
              className="bottle-batch-back-source"
              disabled={disabled}
              onClick={() => pick("library")}
            >
              <Images size={18} />
            </IconButton>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="bottle-batch-back">
      <div className="photo-thumb bottle-batch-back-thumb">
        <ContentPhoto
          src={row.backPhoto.previewUrl}
          className="photo-thumb-img"
          size={PHOTO_DISPLAY_SIZE.bottleTile}
          loading="eager"
          alt={BACK_PHOTO_LABELS.thumbAlt}
        />
        {row.backPhoto.status === "uploading" ? (
          <span className="photo-tile-progress" role="status">
            アップロード中
          </span>
        ) : null}
        {row.backPhoto.status === "error" ? (
          <button type="button" className="photo-tile-retry" onClick={onRetry}>
            <span aria-hidden>!</span>
            <span>{BACK_PHOTO_LABELS.retry}</span>
          </button>
        ) : null}
      </div>
      <IconButton
        label="裏面を外す"
        className="bottle-batch-back-remove"
        disabled={disabled}
        onClick={onRemove}
      >
        <X size={14} />
      </IconButton>
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
  disabled,
  layout = "stack",
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
  disabled: boolean;
  layout?: "stack" | "inline";
  aiMarked?: boolean;
}) {
  return (
    <div className={layout === "inline" ? "field-inline" : "log-form-section"}>
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
          disabled={disabled}
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
