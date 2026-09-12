import { photoContentUrl, uploadPhoto } from "@/client/hooks/use-photos.ts";
import type { PhotoMeta } from "@/shared/photos.ts";

export const PHOTO_COPY_FAILED = "photo_copy_failed";
export const PHOTO_COPY_FAILED_MESSAGE =
  "写真をコピーできませんでした。再試行するか、写真なしで続けられます";

export type CopiedOwnedPhoto = {
  meta: PhotoMeta;
  blob: Blob;
  previewUrl: string;
};

type CopyOwnedPhotoDeps = {
  fetchBlob: (photoId: string) => Promise<Blob>;
  upload: (blob: Blob) => Promise<PhotoMeta>;
  createPreview: (blob: Blob) => string;
};

export async function fetchOwnedPhotoBlob(photoId: string): Promise<Blob> {
  const response = await fetch(photoContentUrl(photoId), { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(PHOTO_COPY_FAILED);
  }
  return response.blob();
}

/** 自分の写真を未紐付けで複製する。所有排他を保つ（同じ id は付け替えない） */
export async function copyOwnedPhoto(
  photoId: string,
  deps: CopyOwnedPhotoDeps = {
    fetchBlob: fetchOwnedPhotoBlob,
    upload: uploadPhoto,
    createPreview: (blob) => URL.createObjectURL(blob),
  },
): Promise<CopiedOwnedPhoto> {
  const blob = await deps.fetchBlob(photoId);
  const meta = await deps.upload(blob);
  return {
    meta,
    blob,
    previewUrl: deps.createPreview(blob),
  };
}

export function firstPhotoId(photos: readonly { id: string }[] | undefined): string | null {
  return photos?.[0]?.id ?? null;
}
