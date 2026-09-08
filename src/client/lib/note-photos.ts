import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import type { PhotoMeta } from "@/shared/photos.ts";
import { TASTING_NOTE_PHOTO_MAX } from "@/shared/tasting-notes.ts";

export const NOTE_PHOTO_STRIP_MAX = TASTING_NOTE_PHOTO_MAX;
export const NOTE_PHOTO_LIMIT_MESSAGE = "写真は 6 枚までです";

export type NotePhotoItem = {
  key: string;
  photoId: string | null;
  previewUrl: string;
  blob: Blob | null;
  status: "uploading" | "ready" | "error";
  /** すでにこのノートへ紐付いている。未保存の新規は false */
  persisted: boolean;
  recognizeJpeg?: Blob;
};

export function itemsFromNotePhotos(photos: readonly PhotoMeta[]): NotePhotoItem[] {
  return photos.map((photo) => ({
    key: photo.id,
    photoId: photo.id,
    previewUrl: photoContentUrl(photo.id),
    blob: null,
    status: "ready" as const,
    persisted: true,
  }));
}

export function readyPhotoIds(items: readonly NotePhotoItem[]): string[] {
  return items
    .filter((item): item is NotePhotoItem & { photoId: string } =>
      Boolean(item.status === "ready" && item.photoId),
    )
    .map((item) => item.photoId);
}

export function photoListStatus(
  items: readonly NotePhotoItem[],
): "none" | "uploading" | "ready" | "error" {
  if (items.some((item) => item.status === "uploading")) {
    return "uploading";
  }
  if (items.some((item) => item.status === "error")) {
    return "error";
  }
  return items.length === 0 ? "none" : "ready";
}

export function canAddNotePhoto(items: readonly NotePhotoItem[]): boolean {
  return items.length < NOTE_PHOTO_STRIP_MAX;
}

export function samePhotoIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export function movePhotoFirst(items: readonly NotePhotoItem[], key: string): NotePhotoItem[] {
  const index = items.findIndex((item) => item.key === key);
  if (index <= 0) {
    return [...items];
  }
  const next = [...items];
  const [item] = next.splice(index, 1);
  if (!item) {
    return next;
  }
  return [item, ...next];
}

export function upsertNotePhoto(
  items: readonly NotePhotoItem[],
  key: string,
  next: NotePhotoItem,
): NotePhotoItem[] {
  const index = items.findIndex((item) => item.key === key);
  if (index < 0) {
    if (items.length >= NOTE_PHOTO_STRIP_MAX) {
      if (next.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(next.previewUrl);
      }
      return [...items];
    }
    return [...items, next];
  }
  const previous = items[index];
  if (
    previous &&
    previous.previewUrl !== next.previewUrl &&
    previous.previewUrl.startsWith("blob:")
  ) {
    URL.revokeObjectURL(previous.previewUrl);
  }
  return items.map((item, itemIndex) => (itemIndex === index ? next : item));
}

export function removeNotePhoto(items: readonly NotePhotoItem[], key: string): NotePhotoItem[] {
  const target = items.find((item) => item.key === key);
  if (target?.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(target.previewUrl);
  }
  return items.filter((item) => item.key !== key);
}

export function unpersistedPhotoIds(items: readonly NotePhotoItem[]): string[] {
  return items
    .filter((item) => !item.persisted && item.photoId)
    .map((item) => item.photoId as string);
}

export function revokeNotePhotoUrls(items: readonly NotePhotoItem[]): void {
  for (const item of items) {
    if (item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
}
