import { type RefObject, useRef, useState } from "react";
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

/** ボトル表裏のコンパクトな横並びサムネ。操作はパネルに集約する */
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
  const frontTrigger = useRef<HTMLButtonElement>(null);
  const backTrigger = useRef<HTMLButtonElement>(null);
  const frontUrl = frontAttachment?.previewUrl ?? frontPreviewUrl ?? null;
  const backUrl = backAttachment?.previewUrl ?? backPreviewUrl ?? null;
  const hasFront = frontStatus !== "none";

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
      <div className="bottle-photo-pair-grid">
        <PhotoSlot
          heading={BOTTLE_PHOTO_ACTION_LABELS.frontHeading}
          previewUrl={frontUrl}
          alt={BOTTLE_PHOTO_ACTION_LABELS.frontThumbAlt}
          status={frontStatus}
          actionLabel={frontUrl ? BOTTLE_PHOTO_ACTION_LABELS.editPhoto : undefined}
          emptyActions={
            frontUrl
              ? undefined
              : [
                  { label: BOTTLE_PHOTO_ACTION_LABELS.addFrontCapture, onSelect: onFrontCapture },
                  { label: BOTTLE_PHOTO_ACTION_LABELS.addFrontLibrary, onSelect: onFrontLibrary },
                ]
          }
          disabled={disabled}
          triggerRef={frontTrigger}
          onRetry={frontStatus === "error" ? onFrontRetry : undefined}
          onOpenPanel={frontUrl ? () => setPanel("front") : undefined}
        />
        <PhotoSlot
          heading={BOTTLE_PHOTO_ACTION_LABELS.backHeading}
          previewUrl={hasFront ? backUrl : null}
          alt={BOTTLE_PHOTO_ACTION_LABELS.backThumbAlt}
          status={hasFront ? backStatus : "none"}
          processing={backProcessing}
          actionLabel={
            !hasFront
              ? undefined
              : backUrl
                ? BOTTLE_PHOTO_ACTION_LABELS.editPhoto
                : BOTTLE_PHOTO_ACTION_LABELS.addBack
          }
          disabled={disabled || !hasFront}
          triggerRef={backTrigger}
          onRetry={hasFront && backStatus === "error" ? onBackRetry : undefined}
          onOpenPanel={hasFront ? () => setPanel("back") : undefined}
        />
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <PhotoActionPanel
        open={panel === "front"}
        title={BOTTLE_PHOTO_ACTION_LABELS.frontHeading}
        actions={frontActions}
        restoreFocus={frontTrigger}
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

function PhotoSlot({
  heading,
  previewUrl,
  alt,
  status,
  processing,
  actionLabel,
  emptyActions,
  disabled,
  triggerRef,
  onRetry,
  onOpenPanel,
}: {
  heading: string;
  previewUrl: string | null;
  alt: string;
  status: PhotoSaveStatus;
  processing?: boolean;
  actionLabel?: string;
  emptyActions?: readonly { label: string; onSelect: () => void }[];
  disabled?: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onRetry?: () => void;
  onOpenPanel?: () => void;
}) {
  return (
    <div className="bottle-photo-slot">
      <p className="field-label">{heading}</p>
      {previewUrl ? (
        <div className="photo-thumb photo-thumb-bottle bottle-photo-thumb">
          <ContentPhoto
            src={previewUrl}
            className="photo-thumb-img"
            size={PHOTO_DISPLAY_SIZE.bottleTile}
            loading="eager"
            alt={alt}
          />
          {status === "uploading" || processing ? (
            <span className="photo-tile-progress" role="status">
              アップロード中
            </span>
          ) : null}
          {status === "error" && onRetry ? (
            <button type="button" className="photo-tile-retry" onClick={onRetry}>
              <span aria-hidden>!</span>
              <span>再試行</span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="bottle-photo-empty" aria-hidden />
      )}
      {actionLabel && onOpenPanel ? (
        <button
          ref={triggerRef}
          type="button"
          className="bottle-photo-action"
          disabled={disabled}
          onClick={onOpenPanel}
        >
          {actionLabel}
        </button>
      ) : null}
      {emptyActions
        ? emptyActions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="bottle-photo-action"
              disabled={disabled}
              onClick={action.onSelect}
            >
              {action.label}
            </button>
          ))
        : null}
    </div>
  );
}
