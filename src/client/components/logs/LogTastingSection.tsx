import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/client/components/feedback/Dialog.tsx";
import { NotePhotoStrip } from "@/client/components/notes/NotePhotoStrip.tsx";
import { NoteTextFields } from "@/client/components/notes/NoteTextFields.tsx";
import { RatingField } from "@/client/components/notes/RatingField.tsx";
import type { LogFormErrors } from "@/client/lib/log-form.ts";
import type { NotePhotoItem } from "@/client/lib/note-photos.ts";

type LogTastingSectionProps = {
  open: boolean;
  ratingX10: number | null;
  appearance: string;
  aroma: string;
  taste: string;
  finish: string;
  errors: Pick<LogFormErrors, "ratingX10" | "appearance" | "aroma" | "taste" | "finish">;
  photos: readonly NotePhotoItem[];
  canAddPhotos: boolean;
  canDelete?: boolean;
  onOpenChange: (open: boolean) => void;
  onRatingChange: (ratingX10: number | null) => void;
  onTextChange: (field: "appearance" | "aroma" | "taste" | "finish", value: string) => void;
  onAddPhoto: () => void;
  onLibraryPhoto: () => void;
  onEditPhoto: (key: string) => void;
  onRetryPhoto: (key: string) => void;
  onRemovePhoto: (key: string) => void;
  onMakeFirst: (key: string) => void;
  onDeleteNote?: () => void;
};

export function LogTastingSection({
  open,
  ratingX10,
  appearance,
  aroma,
  taste,
  finish,
  errors,
  photos,
  canAddPhotos,
  canDelete = false,
  onOpenChange,
  onRatingChange,
  onTextChange,
  onAddPhoto,
  onLibraryPhoto,
  onEditPhoto,
  onRetryPhoto,
  onRemovePhoto,
  onMakeFirst,
  onDeleteNote,
}: LogTastingSectionProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <section className="log-form-section log-tasting-section">
      <button
        type="button"
        className={open ? "form-row form-row-toggle is-open" : "form-row form-row-toggle"}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <span className="form-row-label">テイスティングを残す</span>
        <span className="form-row-value" />
        <ChevronDown size={20} className="form-row-chevron" aria-hidden />
      </button>
      {open ? (
        <div className="log-tasting-body">
          <RatingField value={ratingX10} error={errors.ratingX10} onChange={onRatingChange} />
          <NoteTextFields
            taste={taste}
            appearance={appearance}
            aroma={aroma}
            finish={finish}
            errors={{
              taste: errors.taste,
              appearance: errors.appearance,
              aroma: errors.aroma,
              finish: errors.finish,
            }}
            defaultOpen={Boolean(appearance || aroma || finish)}
            onChange={onTextChange}
          />
          <NotePhotoStrip
            items={photos}
            canAdd={canAddPhotos}
            onAdd={onAddPhoto}
            onLibrary={onLibraryPhoto}
            onEdit={onEditPhoto}
            onRetry={onRetryPhoto}
            onRemove={onRemovePhoto}
            onMakeFirst={onMakeFirst}
          />
          {canDelete && onDeleteNote ? (
            <button type="button" className="log-delete" onClick={() => setDeleteOpen(true)}>
              ノートを削除
            </button>
          ) : null}
        </div>
      ) : null}
      <Dialog
        open={deleteOpen}
        title="ノートを削除しますか"
        body="記録は残します。ノートとノートの写真だけ消えます"
        primaryLabel="削除する"
        destructive
        onPrimary={() => {
          setDeleteOpen(false);
          onDeleteNote?.();
        }}
        onClose={() => setDeleteOpen(false)}
      />
    </section>
  );
}
