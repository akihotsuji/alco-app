import { Camera, Images } from "lucide-react";
import { useState } from "react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import { Button } from "@/client/components/ui/button.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import {
  NOTE_PHOTO_LIMIT_MESSAGE,
  NOTE_PHOTO_STRIP_MAX,
  type NotePhotoItem,
} from "@/client/lib/note-photos.ts";
import { IMAGE_PICK_LABELS } from "@/client/lib/photo/pick-image.ts";

type NotePhotoStripProps = {
  items: readonly NotePhotoItem[];
  canAdd: boolean;
  error?: string;
  onAdd: () => void;
  onLibrary: () => void;
  onEdit: (key: string) => void;
  onRetry: (key: string) => void;
  onRemove: (key: string) => void;
  onMakeFirst: (key: string) => void;
};

export function NotePhotoStrip({
  items,
  canAdd,
  error,
  onAdd,
  onLibrary,
  onEdit,
  onRetry,
  onRemove,
  onMakeFirst,
}: NotePhotoStripProps) {
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const selected = items.find((item) => item.key === menuKey) ?? null;

  return (
    <section className="note-photo-strip log-form-section">
      <div className="note-photo-strip-header">
        <FieldLabel optional>写真</FieldLabel>
        <span className="note-photo-strip-count">
          {items.length} / {NOTE_PHOTO_STRIP_MAX}
        </span>
      </div>
      <div className="photo-action-row">
        <button type="button" className="photo-action" disabled={!canAdd} onClick={onAdd}>
          <Camera size={18} aria-hidden />
          {IMAGE_PICK_LABELS.capture}
        </button>
        <button type="button" className="photo-action" disabled={!canAdd} onClick={onLibrary}>
          <Images size={18} aria-hidden />
          {IMAGE_PICK_LABELS.captureLibrary}
        </button>
      </div>
      {items.length > 0 ? (
        <div className="note-photo-strip-scroller">
          {items.map((item, index) => (
            <NotePhotoThumb
              key={item.key}
              item={item}
              index={index}
              onOpen={() => setMenuKey(item.key)}
              onRetry={() => onRetry(item.key)}
            />
          ))}
        </div>
      ) : null}
      {!canAdd ? <p className="field-hint">{NOTE_PHOTO_LIMIT_MESSAGE}</p> : null}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <DialogRoot
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) {
            setMenuKey(null);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>写真</DialogTitle>
          <DialogDescription>編集・削除・先頭にする操作を選びます</DialogDescription>
          {selected && items.findIndex((item) => item.key === selected.key) > 0 ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                onMakeFirst(selected.key);
                setMenuKey(null);
              }}
            >
              先頭にする
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (selected) {
                onEdit(selected.key);
              }
              setMenuKey(null);
            }}
          >
            編集
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (selected) {
                onRemove(selected.key);
              }
              setMenuKey(null);
            }}
          >
            削除
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMenuKey(null)}>
            キャンセル
          </Button>
        </DialogContent>
      </DialogRoot>
    </section>
  );
}

function NotePhotoThumb({
  item,
  index,
  onOpen,
  onRetry,
}: {
  item: NotePhotoItem;
  index: number;
  onOpen: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="note-photo-thumb">
      <button type="button" className="note-photo-thumb-button" onClick={onOpen}>
        <ContentPhoto
          src={item.previewUrl}
          className="photo-thumb-img"
          size={PHOTO_DISPLAY_SIZE.logTile}
        />
        <span className="visually-hidden">写真 {index + 1}</span>
      </button>
      {item.status === "uploading" ? (
        <span className="photo-tile-progress" role="status">
          アップロード中
        </span>
      ) : null}
      {item.status === "error" ? (
        <button type="button" className="photo-tile-retry" onClick={onRetry}>
          <span aria-hidden>!</span>
          <span>再試行</span>
        </button>
      ) : null}
    </div>
  );
}
