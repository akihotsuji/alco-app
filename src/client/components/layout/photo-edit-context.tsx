import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { deletePhoto, uploadPhoto } from "@/client/hooks/use-photos.ts";
import { decodeImage, PhotoDecodeError } from "@/client/lib/photo/decode-image.ts";
import { pickImage } from "@/client/lib/photo/pick-image.ts";
import type { ProcessedPhoto } from "@/client/lib/photo/process.ts";

export type PhotoEditContextKind = "log" | "cellar" | "note";

export type PhotoAttachment = {
  previewUrl: string;
  blob: Blob;
  photoId: string | null;
  status: "uploading" | "ready" | "error";
  recognizeJpeg?: Blob;
};

type PhotoEditValue = {
  open: boolean;
  kind: PhotoEditContextKind;
  source: ImageBitmap | null;
  decodeError: string | null;
  attachments: Partial<Record<PhotoEditContextKind, PhotoAttachment>>;
  startCapture: (kind: PhotoEditContextKind) => Promise<void>;
  retake: () => Promise<void>;
  closePhotoEdit: () => void;
  applyProcessed: (processed: ProcessedPhoto) => void;
  retryUpload: (kind: PhotoEditContextKind) => Promise<void>;
  clearAttachment: (kind: PhotoEditContextKind) => Promise<void>;
};

const PhotoEditContext = createContext<PhotoEditValue>({
  open: false,
  kind: "log",
  source: null,
  decodeError: null,
  attachments: {},
  startCapture: async () => {},
  retake: async () => {},
  closePhotoEdit: () => {},
  applyProcessed: () => {},
  retryUpload: async () => {},
  clearAttachment: async () => {},
});

const HISTORY_FLAG = "alcoPhotoEdit";

export function PhotoEditProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PhotoEditContextKind>("log");
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    Partial<Record<PhotoEditContextKind, PhotoAttachment>>
  >({});

  useEffect(() => {
    const onPop = () => {
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const closeOverlay = useCallback(() => {
    setOpen(false);
    setDecodeError(null);
  }, []);

  const closePhotoEdit = useCallback(() => {
    const state = window.history.state as { [HISTORY_FLAG]?: boolean } | null;
    if (state?.[HISTORY_FLAG]) {
      window.history.back();
      return;
    }
    closeOverlay();
  }, [closeOverlay]);

  const openWithSource = useCallback(
    (nextKind: PhotoEditContextKind, bitmap: ImageBitmap | null, error: string | null) => {
      setKind(nextKind);
      setSource((prev) => {
        prev?.close();
        return bitmap;
      });
      setDecodeError(error);
      setOpen(true);
      window.history.pushState({ [HISTORY_FLAG]: true }, "");
    },
    [],
  );

  const loadFile = useCallback(
    async (nextKind: PhotoEditContextKind, file: File) => {
      try {
        const bitmap = await decodeImage(file);
        openWithSource(nextKind, bitmap, null);
      } catch (error) {
        openWithSource(
          nextKind,
          null,
          error instanceof PhotoDecodeError ? error.message : "この写真を読み込めませんでした",
        );
      }
    },
    [openWithSource],
  );

  const startCapture = useCallback(
    async (nextKind: PhotoEditContextKind) => {
      const file = await pickImage({ capture: true });
      if (!file) {
        return;
      }
      await loadFile(nextKind, file);
    },
    [loadFile],
  );

  const retake = useCallback(async () => {
    const file = await pickImage({ capture: true });
    if (!file) {
      return;
    }
    try {
      const bitmap = await decodeImage(file);
      setSource((prev) => {
        prev?.close();
        return bitmap;
      });
      setDecodeError(null);
    } catch (error) {
      setSource((prev) => {
        prev?.close();
        return null;
      });
      setDecodeError(
        error instanceof PhotoDecodeError ? error.message : "この写真を読み込めませんでした",
      );
    }
  }, []);

  const beginUpload = useCallback(
    async (targetKind: PhotoEditContextKind, processed: ProcessedPhoto) => {
      setAttachments((current) => {
        const previous = current[targetKind];
        if (previous && previous.previewUrl !== processed.previewUrl) {
          URL.revokeObjectURL(previous.previewUrl);
        }
        return {
          ...current,
          [targetKind]: {
            previewUrl: processed.previewUrl,
            blob: processed.blob,
            photoId: null,
            status: "uploading",
            recognizeJpeg: processed.recognizeJpeg,
          },
        };
      });
      try {
        const meta = await uploadPhoto(processed.blob);
        setAttachments((current) => {
          const existing = current[targetKind];
          if (!existing || existing.previewUrl !== processed.previewUrl) {
            return current;
          }
          return {
            ...current,
            [targetKind]: { ...existing, photoId: meta.id, status: "ready" },
          };
        });
      } catch {
        setAttachments((current) => {
          const existing = current[targetKind];
          if (!existing || existing.previewUrl !== processed.previewUrl) {
            return current;
          }
          return {
            ...current,
            [targetKind]: { ...existing, status: "error" },
          };
        });
      }
    },
    [],
  );

  const applyProcessed = useCallback(
    (processed: ProcessedPhoto) => {
      closePhotoEdit();
      void beginUpload(kind, processed);
    },
    [beginUpload, closePhotoEdit, kind],
  );

  const retryUpload = useCallback(
    async (targetKind: PhotoEditContextKind) => {
      const current = attachments[targetKind];
      if (!current) {
        return;
      }
      await beginUpload(targetKind, {
        blob: current.blob,
        previewUrl: current.previewUrl,
        recognizeJpeg: current.recognizeJpeg,
      });
    },
    [attachments, beginUpload],
  );

  const clearAttachment = useCallback(
    async (targetKind: PhotoEditContextKind) => {
      const current = attachments[targetKind];
      if (!current) {
        return;
      }
      if (current.photoId) {
        try {
          await deletePhoto(current.photoId);
        } catch {
          // 破棄に失敗してもローカルは消す。残党は 24h GC
        }
      }
      URL.revokeObjectURL(current.previewUrl);
      setAttachments((value) => {
        const next = { ...value };
        delete next[targetKind];
        return next;
      });
    },
    [attachments],
  );

  const value = useMemo<PhotoEditValue>(
    () => ({
      open,
      kind,
      source,
      decodeError,
      attachments,
      startCapture,
      retake,
      closePhotoEdit,
      applyProcessed,
      retryUpload,
      clearAttachment,
    }),
    [
      open,
      kind,
      source,
      decodeError,
      attachments,
      startCapture,
      retake,
      closePhotoEdit,
      applyProcessed,
      retryUpload,
      clearAttachment,
    ],
  );

  return <PhotoEditContext.Provider value={value}>{children}</PhotoEditContext.Provider>;
}

export function usePhotoEdit(): PhotoEditValue {
  return useContext(PhotoEditContext);
}
