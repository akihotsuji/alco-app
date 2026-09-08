import { Camera, Images } from "lucide-react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { IMAGE_PICK_LABELS } from "@/client/lib/photo/pick-image.ts";

type CompactPhotoFieldProps = {
  optional?: boolean;
  countLabel?: string;
  onCapture: () => void;
  onLibrary: () => void;
  attachment?: PhotoAttachment;
  existingPreviewUrl?: string | null;
  onEdit?: () => void;
  onRetry?: () => void;
  onClear?: () => void;
  error?: string | null;
  recognizeStatus?: "loading" | "success" | null;
  recognizeMessage?: string;
  /** 撮影後サムネの比率。記録・ノート 96×120、セラー 100×150 */
  ratio?: "log" | "bottle";
};

/**
 * 記録フォームのコンパクトな写真欄。明示タップ以外では撮影しない。
 */
export function CompactPhotoField({
  optional = true,
  countLabel,
  onCapture,
  onLibrary,
  attachment,
  existingPreviewUrl,
  onEdit,
  onRetry,
  onClear,
  error,
  recognizeStatus,
  recognizeMessage,
  ratio = "log",
}: CompactPhotoFieldProps) {
  const previewUrl = attachment?.previewUrl ?? existingPreviewUrl ?? null;

  return (
    <section className="log-form-section compact-photo">
      <div className="compact-photo-header">
        <FieldLabel optional={optional}>写真</FieldLabel>
        {countLabel ? <span className="note-photo-strip-count">{countLabel}</span> : null}
      </div>
      {previewUrl ? (
        <div className="photo-thumb-row">
          <div className={`photo-thumb photo-thumb-${ratio}`}>
            <ContentPhoto
              src={previewUrl}
              className="photo-thumb-img"
              size={ratio === "bottle" ? PHOTO_DISPLAY_SIZE.bottleTile : PHOTO_DISPLAY_SIZE.logTile}
              loading="eager"
            />
            {attachment?.status === "uploading" ? (
              <span className="photo-tile-progress" role="status">
                アップロード中
              </span>
            ) : null}
            {attachment?.status === "error" ? (
              <button type="button" className="photo-tile-retry" onClick={onRetry}>
                <span aria-hidden>!</span>
                <span>再試行</span>
              </button>
            ) : null}
          </div>
          <div className="photo-thumb-actions">
            <button type="button" className="header-text-link" onClick={onEdit ?? onCapture}>
              編集
            </button>
            {onClear ? (
              <button type="button" className="header-text-link" onClick={onClear}>
                削除
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="photo-action-row">
          <button type="button" className="photo-action" onClick={onCapture}>
            <Camera size={18} aria-hidden />
            写真を撮る
          </button>
          <button type="button" className="photo-action" onClick={onLibrary}>
            <Images size={18} aria-hidden />
            {IMAGE_PICK_LABELS.captureLibrary}
          </button>
        </div>
      )}
      {recognizeStatus && recognizeMessage ? (
        <p className="bottle-batch-recognize" role="status">
          {recognizeStatus === "loading" ? (
            <span className="recognize-spinner" aria-hidden />
          ) : null}
          {recognizeMessage}
        </p>
      ) : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
