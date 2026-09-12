import { Camera, Images } from "lucide-react";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { BACK_PHOTO_LABELS, type BackPhotoState } from "@/client/lib/bottle-back-photo.ts";

type BackPhotoFieldProps = {
  attachment: BackPhotoState | null;
  existingPreviewUrl?: string | null;
  processing?: boolean;
  disabled?: boolean;
  onCapture: () => void;
  onLibrary: () => void;
  onRetry: () => void;
  onClear: () => void;
};

/**
 * ボトル裏面（04-cellar B1b）。表面があるときだけ出す。
 * photo-edit は開かず、撮る / 選ぶで即アップロード。サムネ 64×96 + 削除。
 */
export function BackPhotoField({
  attachment,
  existingPreviewUrl,
  processing = false,
  disabled = false,
  onCapture,
  onLibrary,
  onRetry,
  onClear,
}: BackPhotoFieldProps) {
  const previewUrl = attachment?.previewUrl ?? existingPreviewUrl ?? null;

  return (
    <section className="log-form-section compact-photo back-photo">
      <div className="compact-photo-header">
        <span className="field-label">{BACK_PHOTO_LABELS.heading}</span>
      </div>
      {previewUrl ? (
        <div className="photo-thumb-row back-photo-row">
          <div className="photo-thumb back-photo-thumb">
            <ContentPhoto
              src={previewUrl}
              className="photo-thumb-img"
              size={PHOTO_DISPLAY_SIZE.bottleTile}
              loading="eager"
              alt={BACK_PHOTO_LABELS.thumbAlt}
            />
            {attachment?.status === "uploading" ? (
              <span className="photo-tile-progress" role="status">
                アップロード中
              </span>
            ) : null}
            {attachment?.status === "error" ? (
              <button type="button" className="photo-tile-retry" onClick={onRetry}>
                <span aria-hidden>!</span>
                <span>{BACK_PHOTO_LABELS.retry}</span>
              </button>
            ) : null}
          </div>
          <div className="photo-thumb-actions back-photo-actions">
            <button
              type="button"
              className="header-text-link"
              onClick={onCapture}
              disabled={disabled}
            >
              {BACK_PHOTO_LABELS.capture}
            </button>
            <button
              type="button"
              className="header-text-link"
              onClick={onLibrary}
              disabled={disabled}
            >
              {BACK_PHOTO_LABELS.library}
            </button>
            <button
              type="button"
              className="header-text-link"
              onClick={onClear}
              disabled={disabled}
            >
              {BACK_PHOTO_LABELS.remove}
            </button>
          </div>
        </div>
      ) : processing ? (
        <p className="bottle-batch-recognize" role="status">
          <span className="recognize-spinner" aria-hidden />
          {BACK_PHOTO_LABELS.processing}
        </p>
      ) : (
        <div className="photo-action-row">
          <button type="button" className="photo-action" onClick={onCapture} disabled={disabled}>
            <Camera size={18} aria-hidden />
            {BACK_PHOTO_LABELS.capture}
          </button>
          <button type="button" className="photo-action" onClick={onLibrary} disabled={disabled}>
            <Images size={18} aria-hidden />
            {BACK_PHOTO_LABELS.library}
          </button>
        </div>
      )}
    </section>
  );
}
