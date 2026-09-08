import { useCallback, useEffect, useRef, useState } from "react";
import {
  type PhotoAttachment,
  type PhotoCollectSession,
  usePhotoEdit,
} from "@/client/components/layout/photo-edit-context.tsx";
import { deletePhoto } from "@/client/hooks/use-photos.ts";
import {
  canAddNotePhoto,
  itemsFromNotePhotos,
  movePhotoFirst,
  type NotePhotoItem,
  photoListStatus,
  readyPhotoIds,
  removeNotePhoto,
  revokeNotePhotoUrls,
  samePhotoIds,
  unpersistedPhotoIds,
  upsertNotePhoto,
} from "@/client/lib/note-photos.ts";
import type { ImagePickSource } from "@/client/lib/photo/pick-image.ts";
import type { PhotoMeta } from "@/shared/photos.ts";

function toItem(key: string, attachment: PhotoAttachment, persisted: boolean): NotePhotoItem {
  return {
    key,
    photoId: attachment.photoId,
    previewUrl: attachment.previewUrl,
    blob: attachment.blob,
    status: attachment.status,
    persisted,
    recognizeJpeg: attachment.recognizeJpeg,
    capturedAt: attachment.capturedAt,
  };
}

export function useNotePhotos(initialPhotos: readonly PhotoMeta[] = []) {
  const { startCapture, editFromBlob, retryCollectedUpload, clearAttachment, attachments } =
    usePhotoEdit();
  const [items, setItems] = useState(() => itemsFromNotePhotos(initialPhotos));
  const [initialIds] = useState(() => initialPhotos.map((photo) => photo.id));
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const bindKey = useCallback(
    (
      key: string,
      persisted: boolean,
      previousPhotoId?: string | null,
      previousCapturedAt?: string,
    ) => {
      const session: PhotoCollectSession = {
        previousPhotoId,
        previousCapturedAt,
        onUpdate: (attachment) => {
          setItems((current) => upsertNotePhoto(current, key, toItem(key, attachment, persisted)));
        },
      };
      return session;
    },
    [],
  );

  const addPhoto = useCallback(
    async (source: ImagePickSource = "camera") => {
      if (!canAddNotePhoto(itemsRef.current)) {
        return;
      }
      const key = crypto.randomUUID();
      await startCapture("note", { collect: bindKey(key, false), source });
    },
    [bindKey, startCapture],
  );

  useEffect(() => {
    if (attachments.note) {
      void clearAttachment("note");
    }
  }, [attachments.note, clearAttachment]);

  useEffect(() => {
    return () => {
      revokeNotePhotoUrls(itemsRef.current);
    };
  }, []);

  const editPhoto = useCallback(
    async (key: string) => {
      const current = itemsRef.current.find((item) => item.key === key);
      if (!current) {
        return;
      }
      if (current.blob) {
        await editFromBlob(
          "note",
          current.blob,
          bindKey(key, false, current.persisted ? null : current.photoId, current.capturedAt),
        );
        return;
      }
      await startCapture("note", { collect: bindKey(key, false) });
    },
    [bindKey, editFromBlob, startCapture],
  );

  const retryPhoto = useCallback(
    async (key: string) => {
      const current = itemsRef.current.find((item) => item.key === key);
      if (!current?.blob) {
        return;
      }
      await retryCollectedUpload(
        {
          previewUrl: current.previewUrl,
          blob: current.blob,
          photoId: current.photoId,
          status: current.status,
        },
        bindKey(key, false, undefined, current.capturedAt),
      );
    },
    [bindKey, retryCollectedUpload],
  );

  const removePhoto = useCallback(async (key: string) => {
    const current = itemsRef.current.find((item) => item.key === key);
    if (!current) {
      return;
    }
    if (!current.persisted && current.photoId) {
      try {
        await deletePhoto(current.photoId);
      } catch {
        // 破棄に失敗してもローカルは消す。残党は 24h GC
      }
    }
    setItems((items) => removeNotePhoto(items, key));
  }, []);

  const makeFirst = useCallback((key: string) => {
    setItems((current) => movePhotoFirst(current, key));
  }, []);

  const discardUnpersisted = useCallback(async () => {
    const ids = unpersistedPhotoIds(itemsRef.current);
    await Promise.all(ids.map((id) => deletePhoto(id).catch(() => {})));
  }, []);

  const releaseLocal = useCallback(() => {
    revokeNotePhotoUrls(itemsRef.current);
  }, []);

  const photoIds = readyPhotoIds(items);
  const photosDirty = !samePhotoIds(photoIds, initialIds);

  return {
    items,
    photoIds,
    photosDirty,
    hasUnpersisted: items.some((item) => !item.persisted),
    photoStatus: photoListStatus(items),
    canAdd: canAddNotePhoto(items),
    addPhoto,
    editPhoto,
    retryPhoto,
    removePhoto,
    makeFirst,
    discardUnpersisted,
    releaseLocal,
  };
}
