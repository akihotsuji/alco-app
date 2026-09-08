import { Camera, ChevronDown, Minus, Plus, Sparkles, X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { useSetHeaderOverride } from "@/client/components/layout/header-override-context.tsx";
import { useLeaveGuard } from "@/client/components/layout/leave-guard-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { DrinkTypeChips } from "@/client/components/logs/DrinkTypeChips.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useBottleBatch } from "@/client/hooks/use-bottle-batch.ts";
import {
  BOTTLE_BATCH_MESSAGES,
  type BottleBatchRow,
  batchRowErrors,
  batchTotalCount,
  canSubmitBatch,
  remainingBatchRows,
} from "@/client/lib/bottle-batch.ts";
import { BOTTLE_SAVE_LABELS, type BottleFormState } from "@/client/lib/bottle-form.ts";
import { haptic } from "@/client/lib/haptic.ts";
import { rememberShelfEvent } from "@/client/lib/history-state.ts";
import { RECOGNIZE_BANNER, type RecognizeMarkField } from "@/client/lib/label-recognize.ts";
import type { MotionState } from "@/client/lib/motion.ts";
import { IMAGE_PICK_LABELS } from "@/client/lib/photo/pick-image.ts";
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
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saveState, setSaveState] = useState<MotionState>("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const pendingLeave = useRef<(() => void) | null>(null);
  const savedRef = useRef(false);
  const total = batchTotalCount(batch.rows);
  const libraryBusy = batch.libraryProgress !== null;
  const formBusy = batch.submitting || libraryBusy;
  const canSubmit = canSubmitBatch(batch.rows) && !formBusy;

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
    const result = await batch.submit();
    if (result.failedCount > 0) {
      setSaveState("error");
      setFormError(BOTTLE_BATCH_MESSAGES.partialFailure(result.failedCount));
      if (result.created.length > 0) {
        showToast({ message: arrangedToastMessage(result.created.length), cheer: false });
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
            onRetryPhoto={() => void batch.retryPhoto(row.key)}
            onRemove={() => void batch.removeRow(row.key)}
          />
        ))}
      </ol>
      {batch.libraryProgress ? (
        <p className="bottle-batch-recognize" role="status">
          <Mascot pose="surprised" size={32} aria-hidden />
          {BOTTLE_BATCH_MESSAGES.libraryProgress(
            batch.libraryProgress.current,
            batch.libraryProgress.total,
          )}
        </p>
      ) : null}
      <div className="bottle-batch-add">
        <Button
          type="button"
          variant="secondary"
          className="bottle-batch-capture"
          disabled={!batch.canAdd || formBusy}
          onClick={() => void batch.addPhoto("camera")}
        >
          <Camera size={20} aria-hidden />
          {captureLabel}
        </Button>
        <button
          type="button"
          className="header-text-link bottle-batch-library"
          disabled={!batch.canAdd || formBusy}
          onClick={() => void batch.addLibraryPhotos()}
        >
          {IMAGE_PICK_LABELS.libraryMultiple}
        </button>
      </div>
      {!batch.canAdd ? <p className="field-hint">{BOTTLE_BATCH_MESSAGES.rowLimit}</p> : null}
      <SaveBar
        label={BOTTLE_SAVE_LABELS.arrange(total)}
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
  onRetryPhoto,
  onRemove,
}: {
  row: BottleBatchRow;
  index: number;
  disabled: boolean;
  onPatch: (patch: Partial<BottleFormState>) => void;
  onToggleDetails: () => void;
  onEditPhoto: () => void;
  onRetryPhoto: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  const errors = batchRowErrors(row);
  const marks = new Set<RecognizeMarkField>(row.aiMarks);
  const nameId = `${id}-name`;
  const detailsId = `${id}-details`;
  const cutout = row.photo.blob.type === "image/webp";

  return (
    <li className="bottle-batch-row" aria-label={`${index + 1} 本目`}>
      <div className="bottle-batch-row-main">
        <div
          className={
            cutout ? "photo-thumb bottle-batch-thumb is-cutout" : "photo-thumb bottle-batch-thumb"
          }
        >
          <button
            type="button"
            className="bottle-batch-thumb-button"
            aria-label="写真を編集"
            disabled={disabled}
            onClick={onEditPhoto}
          >
            <img src={row.photo.previewUrl} alt="" className="photo-thumb-img" />
          </button>
          {row.photo.status === "uploading" ? (
            <span className="photo-tile-progress" role="status">
              アップロード中
            </span>
          ) : null}
          {row.photo.status === "error" ? (
            <button type="button" className="photo-tile-retry" onClick={onRetryPhoto}>
              <span aria-hidden>!</span>
              <span>再試行</span>
            </button>
          ) : null}
        </div>
        <div className="bottle-batch-fields">
          <div className="bottle-batch-name-row">
            <label className="field-label" htmlFor={nameId}>
              銘柄名
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
          <DetailField
            id={`${id}-origin`}
            label="産地"
            value={row.form.origin}
            maxLength={BOTTLE_TEXT_MAX_LENGTH}
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
            placeholder="NV"
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
      {row.recognize === "loading" || row.recognize === "failure" ? (
        <p className="bottle-batch-recognize" role="status">
          {row.recognize === "loading" ? (
            <span className="recognize-spinner" aria-hidden />
          ) : (
            <Sparkles size={14} aria-hidden />
          )}
          {RECOGNIZE_BANNER[row.recognize]}
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
