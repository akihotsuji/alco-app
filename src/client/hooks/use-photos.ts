import { useMutation } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { photoFileName } from "@/client/lib/photo/photo-file.ts";
import type { PhotoContentVariant } from "@/shared/photos.ts";

export function photoContentUrl(id: string, variant?: PhotoContentVariant): string {
  const path = `/api/photos/${id}/content`;
  return variant ? `${path}?variant=${variant}` : path;
}

export async function uploadPhoto(
  file: Blob,
  extras: {
    bottleId?: string;
    tastingNoteId?: string;
    drinkLogId?: string;
    sortOrder?: number;
  } = {},
  client: ApiClient = api,
) {
  const form: {
    file: File;
    bottleId?: string;
    tastingNoteId?: string;
    drinkLogId?: string;
    sortOrder?: string;
  } = {
    file: new File([file], photoFileName(file.type), {
      type: file.type || "image/jpeg",
    }),
  };
  if (extras.bottleId) {
    form.bottleId = extras.bottleId;
  }
  if (extras.tastingNoteId) {
    form.tastingNoteId = extras.tastingNoteId;
  }
  if (extras.drinkLogId) {
    form.drinkLogId = extras.drinkLogId;
  }
  if (extras.sortOrder !== undefined) {
    form.sortOrder = String(extras.sortOrder);
  }
  return unwrap(client.api.photos.$post({ form }));
}

export async function deletePhoto(id: string, client: ApiClient = api) {
  return unwrap(client.api.photos[":id"].$delete({ param: { id } }));
}

export function useUploadPhoto() {
  return useMutation({
    mutationFn: (input: { file: Blob }) => uploadPhoto(input.file),
  });
}
