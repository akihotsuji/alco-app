import { useMutation } from "@tanstack/react-query";
import { type ApiClient, api, unwrap } from "@/client/lib/api.ts";
import { photoFileName } from "@/client/lib/photo/photo-file.ts";
import type { FeedbackCategory } from "@/shared/feedback.ts";

export async function submitFeedback(
  input: {
    category: FeedbackCategory;
    body: string;
    photos: readonly Blob[];
  },
  client: ApiClient = api,
) {
  const form: {
    category: FeedbackCategory;
    body: string;
    photos?: File | File[];
  } = {
    category: input.category,
    body: input.body,
  };
  const files = input.photos.map(
    (blob, index) =>
      new File([blob], photoFileName(blob.type), {
        type: blob.type || "image/jpeg",
        lastModified: index,
      }),
  );
  if (files.length === 1 && files[0]) {
    form.photos = files[0];
  } else if (files.length > 1) {
    form.photos = files;
  }
  return unwrap(client.api.feedback.$post({ form }));
}

export function useSubmitFeedback() {
  return useMutation({
    mutationFn: (input: { category: FeedbackCategory; body: string; photos: readonly Blob[] }) =>
      submitFeedback(input),
  });
}
