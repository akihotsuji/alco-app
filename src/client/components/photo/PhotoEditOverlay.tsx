import { X } from "lucide-react";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { IconButton } from "@/client/components/ui/IconButton.tsx";

export function PhotoEditOverlay() {
  const { open, kind, closePhotoEdit } = usePhotoEdit();
  if (!open) {
    return null;
  }

  const ratioClass = kind === "cellar" ? "photo-edit-frame-bottle" : "photo-edit-frame-log";

  return (
    <div className="photo-edit" role="dialog" aria-modal="true" aria-label="写真を編集">
      <header className="photo-edit-bar">
        <IconButton label="閉じる" onClick={closePhotoEdit}>
          <X size={20} />
        </IconButton>
        <span className="photo-edit-spacer" />
        <span className="header-text-link photo-edit-disabled">撮り直す</span>
      </header>
      <div className="photo-edit-body">
        <div className={`photo-edit-frame ${ratioClass}`}>
          <p className="photo-edit-placeholder">撮影と加工は 2-08 で実装します</p>
          {kind !== "cellar" ? (
            <span className="photo-edit-mascot">
              <Mascot pose="surprised" size={64} aria-hidden />
            </span>
          ) : null}
        </div>
      </div>
      <div className="save-bar">
        <button type="button" className="btn-primary" onClick={closePhotoEdit}>
          使う
        </button>
      </div>
    </div>
  );
}
