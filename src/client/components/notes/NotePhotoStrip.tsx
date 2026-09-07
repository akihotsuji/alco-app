import { Camera } from "lucide-react";
import { useState } from "react";
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

type NotePhotoStripProps = {
  items: readonly NotePhotoItem[];
  canAdd: boolean;
  error?: string;
  onAdd: () => void;
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
  onEdit,
  onRetry,
  onRemove,
  onMakeFirst,
}: NotePhotoStripProps) {
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const selected = items.find((item) => item.key === menuKey) ?? null;

  return (
    <section className="note-photo-strip">
      <div className="note-photo-strip-header">
        <span className="field-label">写真</span>
        <span className="note-photo-strip-count">
          {items.length} / {NOTE_PHOTO_STRIP_MAX}
        </span>
      </div>
      <div className="note-photo-strip-scroller">
        <button
          type="button"
          className="note-photo-capture"
          disabled={!canAdd}
          onClick={onAdd}
        >
          <Camera size={22} aria-hidden />
          撮る
        </button>
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
        <img src={item.previewUrl} alt="" className="photo-thumb-img" loading="lazy" />
        <span className="sr-only">写真 {index + 1}</span>
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
