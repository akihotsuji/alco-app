import type { PhotoAttachment } from "@/client/components/layout/photo-edit-context.tsx";
import type { ProcessedPhoto } from "@/client/lib/photo/process.ts";

/**
 * ボトル裏面（cellar.md 3.3 B1b / 6 章）。表面と違い photo-edit を通さず、
 * フォーム内のローカル状態として 1 枚だけ持つ。`attachments` には書かない。
 */
export type BackPhotoState = PhotoAttachment;

export const BACK_PHOTO_LABELS = {
  heading: "裏面（任意）",
  capture: "裏面を撮る",
  library: "裏面を選ぶ",
  add: "+ 裏面",
  thumbAlt: "裏面の写真",
  remove: "削除",
  retry: "再試行",
  processing: "裏面を処理中…",
} as const;

export function backPhotoDraft(processed: ProcessedPhoto): BackPhotoState {
  return {
    previewUrl: processed.previewUrl,
    blob: processed.blob,
    photoId: null,
    status: "uploading",
    recognizeJpeg: processed.recognizeJpeg,
    capturedAt: processed.capturedAt,
  };
}

export function backPhotoReady(draft: BackPhotoState, photoId: string): BackPhotoState {
  return { ...draft, photoId, status: "ready" };
}

export function backPhotoFailed(draft: BackPhotoState): BackPhotoState {
  return { ...draft, status: "error" };
}

/** 差し替え・削除で不要になったローカルプレビューを解放し、未紐付けの id を返す（呼び出し側が DELETE する） */
export function releaseBackPhoto(state: BackPhotoState | null): string | null {
  if (!state) {
    return null;
  }
  if (state.previewUrl.startsWith("blob:")) {
    URL.revokeObjectURL(state.previewUrl);
  }
  return state.photoId;
}
