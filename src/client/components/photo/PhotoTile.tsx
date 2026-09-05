import { Camera } from "lucide-react";
import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";

type PhotoTileProps = {
  onClick: () => void;
  showMascot?: boolean;
  attachment?: PhotoAttachment;
  onRetry?: () => void;
  onClear?: () => void;
};

export function PhotoTile({
  onClick,
  showMascot = true,
  attachment,
  onRetry,
  onClear,
}: PhotoTileProps) {
  if (attachment) {
    return (
      <div className="photo-tile photo-tile-filled">
        <img src={attachment.previewUrl} alt="" className="photo-tile-preview" />
        {attachment.status === "uploading" ? (
          <span className="photo-tile-progress" role="status">
            アップロード中
          </span>
        ) : null}
        {attachment.status === "error" ? (
          <button type="button" className="photo-tile-retry" onClick={onRetry}>
            !<span>再試行</span>
          </button>
        ) : null}
        <div className="photo-tile-actions">
          <button type="button" className="photo-tile-action" onClick={onClick}>
            編集
          </button>
          {onClear ? (
            <button type="button" className="photo-tile-action" onClick={onClear}>
              削除
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
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
  );
}
