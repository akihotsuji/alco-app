import { Camera, Images } from "lucide-react";
import { useRef, useState } from "react";
import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import {
  type PhotoActionItem,
  PhotoActionPanel,
} from "@/client/components/photo/PhotoActionPanel.tsx";
import type { BackPhotoState } from "@/client/lib/bottle-back-photo.ts";
import { BOTTLE_PHOTO_ACTION_LABELS } from "@/client/lib/bottle-photo-actions.ts";
import type { PhotoSaveStatus } from "@/client/lib/log-form.ts";

type BottlePhotoPairProps = {
  frontAttachment?: PhotoAttachment;
  frontPreviewUrl?: string | null;
  frontStatus: PhotoSaveStatus;
  backAttachment?: BackPhotoState | null;
  backPreviewUrl?: string | null;
  backStatus: PhotoSaveStatus;
  backProcessing?: boolean;
  disabled?: boolean;
  error?: string;
  onFrontCapture: () => void;
  onFrontLibrary: () => void;
  onFrontEdit: () => void;
  onFrontRetry: () => void;
  onFrontClear: () => void;
  onBackCapture: () => void;
  onBackLibrary: () => void;
  onBackRetry: () => void;
  onBackClear: () => void;
};

type PanelSide = "front" | "back" | null;

/** ボトル写真。空は主写真 1 枠。裏ラベルは表面があるときの補助操作 */
export function BottlePhotoPair({
  frontAttachment,
  frontPreviewUrl,
  frontStatus,
  backAttachment,
  backPreviewUrl,
  backStatus,
  backProcessing = false,
  disabled = false,
  error,
  onFrontCapture,
  onFrontLibrary,
  onFrontEdit,
  onFrontRetry,
  onFrontClear,
  onBackCapture,
  onBackLibrary,
  onBackRetry,
  onBackClear,
}: BottlePhotoPairProps) {
  const [panel, setPanel] = useState<PanelSide>(null);
  const dropTrigger = useRef<HTMLButtonElement>(null);
  const frontTrigger = useRef<HTMLButtonElement>(null);
  const backTrigger = useRef<HTMLButtonElement>(null);
  const frontUrl = frontAttachment?.previewUrl ?? frontPreviewUrl ?? null;
  const backUrl = backAttachment?.previewUrl ?? backPreviewUrl ?? null;
  const hasFront = frontStatus !== "none";
  const hasBack = hasFront && backStatus !== "none";

  const frontActions: PhotoActionItem[] = frontUrl
    ? [
        { id: "crop", label: BOTTLE_PHOTO_ACTION_LABELS.adjustCrop, onSelect: onFrontEdit },
        { id: "recapture", label: BOTTLE_PHOTO_ACTION_LABELS.recapture, onSelect: onFrontCapture },
        { id: "reselect", label: BOTTLE_PHOTO_ACTION_LABELS.reselect, onSelect: onFrontLibrary },
        {
          id: "delete",
          label: BOTTLE_PHOTO_ACTION_LABELS.deletePhoto,
          danger: true,
          onSelect: onFrontClear,
        },
      ]
    : [
        {
          id: "capture",
          label: BOTTLE_PHOTO_ACTION_LABELS.addFrontCapture,
          onSelect: onFrontCapture,
        },
        {
          id: "library",
          label: BOTTLE_PHOTO_ACTION_LABELS.addFrontLibrary,
          onSelect: onFrontLibrary,
        },
      ];

  const backActions: PhotoActionItem[] = backUrl
    ? [
        { id: "recapture", label: BOTTLE_PHOTO_ACTION_LABELS.recapture, onSelect: onBackCapture },
        { id: "reselect", label: BOTTLE_PHOTO_ACTION_LABELS.reselect, onSelect: onBackLibrary },
        {
          id: "delete",
          label: BOTTLE_PHOTO_ACTION_LABELS.deletePhoto,
          danger: true,
          onSelect: onBackClear,
        },
      ]
    : [
        { id: "capture", label: BOTTLE_PHOTO_ACTION_LABELS.captureBack, onSelect: onBackCapture },
        { id: "library", label: BOTTLE_PHOTO_ACTION_LABELS.selectBack, onSelect: onBackLibrary },
      ];

  return (
    <section className="log-form-section bottle-photo-pair">
      {hasFront ? (
        <>
          <div className={hasBack ? "bottle-photo-filled has-back" : "bottle-photo-filled"}>
            <FrontHero
              previewUrl={frontUrl}
              alt={BOTTLE_PHOTO_ACTION_LABELS.frontThumbAlt}
              status={frontStatus}
              disabled={disabled}
              onRetry={frontStatus === "error" ? onFrontRetry : undefined}
              onOpenPanel={() => setPanel("front")}
            />
            {hasBack ? (
              <BackThumb
                previewUrl={backUrl}
                alt={BOTTLE_PHOTO_ACTION_LABELS.backThumbAlt}
                status={backStatus}
                processing={backProcessing}
                disabled={disabled}
                onRetry={backStatus === "error" ? onBackRetry : undefined}
                onOpenPanel={() => setPanel("back")}
              />
            ) : null}
          </div>
          {frontStatus === "uploading" ? (
            <p className="field-hint" role="status">
              {BOTTLE_PHOTO_ACTION_LABELS.frontProcessing}
            </p>
          ) : null}
          {hasBack && (backStatus === "uploading" || backProcessing) ? (
            <p className="field-hint" role="status">
              {BOTTLE_PHOTO_ACTION_LABELS.backProcessing}
            </p>
          ) : null}
          <div className="bottle-photo-actions">
            <button
              ref={frontTrigger}
              type="button"
              className="bottle-photo-action"
              disabled={disabled}
              onClick={() => setPanel("front")}
            >
              {BOTTLE_PHOTO_ACTION_LABELS.editFrontPhoto}
            </button>
            <button
              ref={backTrigger}
              type="button"
              className={hasBack ? "bottle-photo-action" : "bottle-photo-add-back"}
              disabled={disabled}
              onClick={() => setPanel("back")}
            >
              {hasBack
                ? BOTTLE_PHOTO_ACTION_LABELS.editBackPhoto
                : BOTTLE_PHOTO_ACTION_LABELS.addBack}
            </button>
          </div>
        </>
      ) : (
        <>
          <button
            ref={dropTrigger}
            type="button"
            className="bottle-photo-drop"
            disabled={disabled}
            onClick={() => setPanel("front")}
          >
            <Camera size={28} aria-hidden />
            {BOTTLE_PHOTO_ACTION_LABELS.addFrontPrompt}
          </button>
          <div className="photo-action-row">
            <button
              type="button"
              className="photo-action"
              disabled={disabled}
              onClick={onFrontCapture}
            >
              <Camera size={18} aria-hidden />
              {BOTTLE_PHOTO_ACTION_LABELS.captureShort}
            </button>
            <button
              type="button"
              className="photo-action"
              disabled={disabled}
              onClick={onFrontLibrary}
            >
              <Images size={18} aria-hidden />
              {BOTTLE_PHOTO_ACTION_LABELS.libraryShort}
            </button>
          </div>
        </>
      )}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <PhotoActionPanel
        open={panel === "front"}
        title={BOTTLE_PHOTO_ACTION_LABELS.frontHeading}
        actions={frontActions}
        restoreFocus={hasFront ? frontTrigger : dropTrigger}
        onClose={() => setPanel(null)}
      />
      <PhotoActionPanel
        open={panel === "back"}
        title={BOTTLE_PHOTO_ACTION_LABELS.backHeading}
        actions={backActions}
        restoreFocus={backTrigger}
        onClose={() => setPanel(null)}
      />
    </section>
  );
}

/** 表面。ボトル詳細 T1 と同じ中央 contain（高さ 240px） */
function FrontHero({
  previewUrl,
  alt,
  status,
  disabled,
  onRetry,
  onOpenPanel,
}: {
  previewUrl: string | null;
  alt: string;
  status: PhotoSaveStatus;
  disabled?: boolean;
  onRetry?: () => void;
  onOpenPanel: () => void;
}) {
  return (
    <div className="bottle-photo-hero">
      <button
        type="button"
        className="bottle-hero"
        aria-label={alt}
        disabled={disabled}
        onClick={onOpenPanel}
      >
        <span className="bottle-photo-hero-frame">
          {previewUrl ? (
            <ContentPhoto
              src={previewUrl}
              className="bottle-hero-img is-photo"
              size={PHOTO_DISPLAY_SIZE.bottleHero}
              loading="eager"
              alt={alt}
            />
          ) : (
            <span className="bottle-photo-preview-placeholder" />
          )}
          {status === "uploading" ? <span className="photo-tile-progress" aria-hidden /> : null}
        </span>
      </button>
      {onRetry ? <RetryOverlay onRetry={onRetry} /> : null}
    </div>
  );
}

/** 裏ラベル。ボトル詳細 T1b と同じ脇の 64×96 サムネ + 「裏ラベル」 */
function BackThumb({
  previewUrl,
  alt,
  status,
  processing,
  disabled,
  onRetry,
  onOpenPanel,
}: {
  previewUrl: string | null;
  alt: string;
  status: PhotoSaveStatus;
  processing?: boolean;
  disabled?: boolean;
  onRetry?: () => void;
  onOpenPanel: () => void;
}) {
  const busy = status === "uploading" || processing;
  return (
    <div className="bottle-photo-back">
      <button
        type="button"
        className="bottle-back-thumb"
        aria-label={alt}
        disabled={disabled}
        onClick={onOpenPanel}
      >
        <span className="photo-thumb bottle-back-thumb-frame">
          {previewUrl ? (
            <ContentPhoto
              src={previewUrl}
              className="photo-thumb-img"
              size={PHOTO_DISPLAY_SIZE.bottleTile}
              loading="eager"
              alt={alt}
            />
          ) : null}
          {busy ? <span className="photo-tile-progress" aria-hidden /> : null}
        </span>
        <span className="bottle-back-thumb-label">{BOTTLE_PHOTO_ACTION_LABELS.backHeading}</span>
      </button>
      {onRetry ? <RetryOverlay onRetry={onRetry} /> : null}
    </div>
  );
}

function RetryOverlay({ onRetry }: { onRetry: () => void }) {
  return (
    <button type="button" className="photo-tile-retry" onClick={onRetry}>
      <span aria-hidden>!</span>
      <span>再試行</span>
    </button>
  );
}
