import { useMutation } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";

export function photoContentUrl(id: string): string {
  return `/api/photos/${id}/content`;
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
    file: new File([file], file.type === "image/webp" ? "photo.webp" : "photo.jpg", {
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
