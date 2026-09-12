import { useCallback, useEffect, useRef, useState } from "react";
import { deletePhoto, uploadPhoto } from "@/client/hooks/use-photos.ts";
import {
  type BackPhotoState,
  backPhotoDraft,
  backPhotoFailed,
  backPhotoReady,
  releaseBackPhoto,
} from "@/client/lib/bottle-back-photo.ts";
import type { PhotoSaveStatus } from "@/client/lib/log-form.ts";
import { type ImagePickSource, pickImage } from "@/client/lib/photo/pick-image.ts";
import { processBackPhotoFile } from "@/client/lib/photo/process-file.ts";

/**
 * ボトル裏面 1 枚のローカル状態（04-cellar B1b）。
 * 撮影 / ライブラリ → 2:3 中央トリミング JPEG → 未紐付け `POST /api/photos`。photo-edit は開かない。
 * 保存済みの裏面（編集）は `existingPhotoId` で受け取り、「削除」で表面と同じく即 `DELETE`。
 */
export function useBackPhoto(existingPhotoId: string | null = null) {
  const [attachment, setAttachment] = useState<BackPhotoState | null>(null);
  const [keptPhotoId, setKeptPhotoId] = useState(existingPhotoId);
  const [processing, setProcessing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const attachmentRef = useRef<BackPhotoState | null>(null);
  attachmentRef.current = attachment;
  const generationRef = useRef(0);

  useEffect(
    () => () => {
      releaseBackPhoto(attachmentRef.current);
    },
    [],
  );

  const upload = useCallback(async (draft: BackPhotoState, generation: number) => {
    setAttachment(draft);
    try {
      const meta = await uploadPhoto(draft.blob);
      if (generationRef.current !== generation) {
        void deletePhoto(meta.id).catch(() => {});
        return;
      }
      setAttachment(backPhotoReady(draft, meta.id));
    } catch {
      if (generationRef.current === generation) {
        setAttachment(backPhotoFailed(draft));
      }
    }
  }, []);

  const pick = useCallback(
    async (source: ImagePickSource) => {
      const file = await pickImage(source);
      if (!file) {
        return;
      }
      setProcessing(true);
      const generation = generationRef.current + 1;
      generationRef.current = generation;
      try {
        const processed = await processBackPhotoFile(file);
        const previousId = releaseBackPhoto(attachmentRef.current);
        if (previousId) {
          void deletePhoto(previousId).catch(() => {});
        }
        if (keptPhotoId) {
          void deletePhoto(keptPhotoId).catch(() => {});
          setKeptPhotoId(null);
        }
        await upload(backPhotoDraft(processed), generation);
      } catch {
        // decode 失敗などは何も付けない（表面と同じく静かに戻す）
      } finally {
        if (generationRef.current === generation) {
          setProcessing(false);
        }
      }
    },
    [keptPhotoId, upload],
  );

  const retry = useCallback(async () => {
    const current = attachmentRef.current;
    if (current?.status !== "error") {
      return;
    }
    await upload({ ...current, status: "uploading" }, generationRef.current);
  }, [upload]);

  const clear = useCallback(async () => {
    generationRef.current += 1;
    const previousId = releaseBackPhoto(attachmentRef.current);
    setAttachment(null);
    setProcessing(false);
    if (previousId) {
      void deletePhoto(previousId).catch(() => {});
      return;
    }
    if (keptPhotoId) {
      setDeleting(true);
      try {
        await deletePhoto(keptPhotoId);
        setKeptPhotoId(null);
      } catch {
        // 失敗しても保存時の photoIds から外れるだけ。R2 は日次 GC に任せる
        setKeptPhotoId(null);
      } finally {
        setDeleting(false);
      }
    }
  }, [keptPhotoId]);

  /** 破棄（保存せず離脱）。未紐付けだけ消し、保存済みは触らない */
  const discard = useCallback(() => {
    generationRef.current += 1;
    const previousId = releaseBackPhoto(attachmentRef.current);
    setAttachment(null);
    if (previousId) {
      void deletePhoto(previousId).catch(() => {});
    }
  }, []);

  const photoId = attachment?.photoId ?? keptPhotoId;
  const status: PhotoSaveStatus = attachment
    ? attachment.status
    : processing
      ? "uploading"
      : keptPhotoId
        ? "ready"
        : "none";

  return {
    attachment,
    keptPhotoId,
    photoId,
    status,
    processing,
    deleting,
    changed: attachment !== null || keptPhotoId !== existingPhotoId,
    pick,
    retry,
    clear,
    discard,
  };
}
