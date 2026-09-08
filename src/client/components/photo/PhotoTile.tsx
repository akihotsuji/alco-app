import { Camera } from "lucide-react";
import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { IMAGE_PICK_LABELS } from "@/client/lib/photo/pick-image.ts";

type PhotoTileProps = {
  onClick: () => void;
  /** 空タイルの「ライブラリから」。撮影（onClick）と両立する副導線 */
  onLibraryClick?: () => void;
  showMascot?: boolean;
  attachment?: PhotoAttachment;
  /** 撮影後サムネの比率。記録・ノート 96×120（4:5）、セラー 100×150（2:3） */
  ratio?: "log" | "bottle";
  onEdit?: () => void;
  onRetry?: () => void;
  onClear?: () => void;
  /** 保存失敗（404）などでサムネ下に出す文言 */
  error?: string | null;
};

/**
 * 写真タイル（00-common 2.7 / 2.8）。撮影前は 120px の inset 枠 + `surprised` 48px、
 * 撮影後は 96×120 のサムネと「編集」「削除」。アップロード中は進捗、失敗は「!」+「再試行」。
 */
export function PhotoTile({
  onClick,
  onLibraryClick,
  showMascot = true,
  attachment,
  ratio = "log",
  onEdit,
  onRetry,
  onClear,
  error,
}: PhotoTileProps) {
  if (attachment) {
    return (
      <div className="photo-thumb-row">
        <div className={`photo-thumb photo-thumb-${ratio}`}>
          <ContentPhoto
            src={attachment.previewUrl}
            className="photo-thumb-img"
            size={ratio === "bottle" ? PHOTO_DISPLAY_SIZE.bottleTile : PHOTO_DISPLAY_SIZE.logTile}
            loading="eager"
          />
          {attachment.status === "uploading" ? (
            <span className="photo-tile-progress" role="status">
              アップロード中
            </span>
          ) : null}
          {attachment.status === "error" ? (
            <button type="button" className="photo-tile-retry" onClick={onRetry}>
              <span aria-hidden>!</span>
              <span>再試行</span>
            </button>
          ) : null}
        </div>
        <div className="photo-thumb-actions">
          <button type="button" className="header-text-link" onClick={onEdit ?? onClick}>
            編集
          </button>
          {onClear ? (
            <button type="button" className="header-text-link" onClick={onClear}>
              削除
            </button>
          ) : null}
          {error ? <p className="field-error">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="photo-tile-block">
      <button type="button" className="photo-tile" onClick={onClick}>
        <span className="photo-tile-center">
          <Camera size={28} aria-hidden />
          <span>写真を撮る</span>
        </span>
        {showMascot ? (
          <span className="photo-tile-mascot">
            <Mascot pose="surprised" size={48} aria-hidden />
          </span>
        ) : null}
      </button>
      {onLibraryClick ? (
        <button
          type="button"
          className="header-text-link photo-tile-library"
          onClick={onLibraryClick}
        >
          {IMAGE_PICK_LABELS.library}
        </button>
      ) : null}
    </div>
  );
}
