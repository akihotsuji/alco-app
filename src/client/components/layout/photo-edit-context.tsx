import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { deletePhoto, uploadPhoto } from "@/client/hooks/use-photos.ts";
import { historyHasFlag, withHistoryFlag } from "@/client/lib/history-state.ts";
import { capturedAtFromFile } from "@/client/lib/photo/captured-at.ts";
import { decodeImage, PhotoDecodeError } from "@/client/lib/photo/decode-image.ts";
import { type ImagePickSource, pickImage } from "@/client/lib/photo/pick-image.ts";
import type { ProcessedPhoto } from "@/client/lib/photo/process.ts";

export type PhotoEditContextKind = "log" | "cellar" | "note";

export type PhotoAttachment = {
  previewUrl: string;
  blob: Blob;
  photoId: string | null;
  status: "uploading" | "ready" | "error";
  recognizeJpeg?: Blob;
  capturedAt?: string;
};

/**
 * 「撮ってから入力へ」の意図（ホーム H9「写真から記録」。中央タブは使わない）。
 * 「使う」で `onUse` が 1 回呼ばれる。× / 撮影・ライブラリのキャンセル / 戻るでは呼ばれず破棄される。
 * `replace` は photo-edit が積んだ history 1 段がまだ先頭にあるとき真（呼び出し側は `navigate(to, { replace })`）。
 */
export type CaptureIntent = {
  onUse: (options: { replace: boolean }) => void;
};

/** ノートの複数枚ストリップ用。`attachments[kind]` には書かず、呼び出し側の配列へ渡す */
export type PhotoCollectSession = {
  onUpdate: (attachment: PhotoAttachment) => void;
  /** 未紐付けの旧 id。再編集で置き換えるときだけ消し、既存の紐付きは送らない */
  previousPhotoId?: string | null;
  /** 再編集では処理済み JPEG から EXIF が消えるので、最初に取った撮影時刻を維持する */
  previousCapturedAt?: string;
};

/** セラーまとめて追加。使う直後に次の撮影を開き、処理は裏で進める */
export type PhotoBurstSession = {
  canCollectMore: () => boolean;
  nextCollect: () => PhotoCollectSession;
};

export type StartCaptureOptions = {
  intent?: CaptureIntent;
  collect?: PhotoCollectSession;
  /** 省略時は撮影。ライブラリ選択は `library` */
  source?: ImagePickSource;
  burst?: PhotoBurstSession;
};

type PhotoEditValue = {
  open: boolean;
  kind: PhotoEditContextKind;
  source: ImageBitmap | null;
  decodeError: string | null;
  attachments: Partial<Record<PhotoEditContextKind, PhotoAttachment>>;
  /**
   * セラーで「使う」直後、切り抜きを待たずに渡す読み取り用 JPEG。
   * 呼び出し側（`bottle-new` / `bottle-batch`）はこれでラベル読み取りを先に始め、
   * `attachments.cellar.recognizeJpeg` と同じ Blob なので結果は 1 リクエストにまとまる
   */
  pendingRecognizeJpeg: Blob | null;
  burstActive: boolean;
  collectedCount: number;
  canCollectMore: () => boolean;
  /** `photo-edit` が読み取り用 JPEG を作った時点で呼ぶ */
  offerRecognizeJpeg: (jpeg: Blob) => void;
  /** 撮影またはライブラリ選択を始める。OS 側をキャンセルすると何も起きない。`intent` を渡すと「使う」で続きの処理を行う */
  startCapture: (kind: PhotoEditContextKind, options?: StartCaptureOptions) => Promise<void>;
  retake: (source?: ImagePickSource) => Promise<void>;
  closePhotoEdit: () => void;
  applyProcessed: (processed: ProcessedPhoto, options?: { keepOpen?: boolean }) => void;
  /** 連続撮影の次のファイル。history は積まない */
  loadBurstFile: (file: File) => Promise<void>;
  /** ライブラリ複数選択など、photo-edit を挟まず行に積む */
  ingestCollected: (processed: ProcessedPhoto, collect: PhotoCollectSession) => Promise<void>;
  retryUpload: (kind: PhotoEditContextKind) => Promise<void>;
  /** 「削除」。未紐付けの `photoId` があれば `DELETE /api/photos/:id` してローカルも消す */
  clearAttachment: (kind: PhotoEditContextKind) => Promise<void>;
  /** 保存成功後。写真は記録に紐付いたので削除せず、フォーム側の保持だけ外す */
  releaseAttachment: (kind: PhotoEditContextKind) => void;
  /** 「編集」。元の画像がメモリに残っていれば再編集、無ければ撮り直し */
  editAttachment: (kind: PhotoEditContextKind) => Promise<void>;
  /** ノート用。保持している Blob から再編集し、結果を `collect` へ返す */
  editFromBlob: (
    kind: PhotoEditContextKind,
    blob: Blob,
    collect: PhotoCollectSession,
  ) => Promise<void>;
  /** ノート用。同じ Blob を未紐付けで再送する */
  retryCollectedUpload: (
    attachment: PhotoAttachment,
    collect: PhotoCollectSession,
  ) => Promise<void>;
};

const PhotoEditContext = createContext<PhotoEditValue>({
  open: false,
  kind: "log",
  source: null,
  decodeError: null,
  attachments: {},
  pendingRecognizeJpeg: null,
  burstActive: false,
  collectedCount: 0,
  canCollectMore: () => false,
  offerRecognizeJpeg: () => {},
  startCapture: async () => {},
  retake: async () => {},
  closePhotoEdit: () => {},
  applyProcessed: () => {},
  loadBurstFile: async () => {},
  ingestCollected: async () => {},
  retryUpload: async () => {},
  clearAttachment: async () => {},
  releaseAttachment: () => {},
  editAttachment: async () => {},
  editFromBlob: async () => {},
  retryCollectedUpload: async () => {},
});

const HISTORY_FLAG = "alcoPhotoEdit";
const DECODE_FALLBACK = "この写真を読み込めませんでした";

async function decodePickedFile(
  file: File,
): Promise<{ bitmap: ImageBitmap | null; error: string | null }> {
  try {
    return { bitmap: await decodeImage(file), error: null };
  } catch (error) {
    return {
      bitmap: null,
      error: error instanceof PhotoDecodeError ? error.message : DECODE_FALLBACK,
    };
  }
}

export function PhotoEditProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PhotoEditContextKind>("log");
  const [source, setSource] = useState<ImageBitmap | null>(null);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<
    Partial<Record<PhotoEditContextKind, PhotoAttachment>>
  >({});
  const [pendingRecognizeJpeg, setPendingRecognizeJpeg] = useState<Blob | null>(null);
  const [collectedCount, setCollectedCount] = useState(0);
  const [burstActive, setBurstActive] = useState(false);
  // 「使う」まで持ち越す意図。閉じる・戻る・キャンセルで必ず捨てる（空の入力画面を開かないため）
  const intentRef = useRef<CaptureIntent | null>(null);
  const collectRef = useRef<PhotoCollectSession | null>(null);
  const burstRef = useRef<PhotoBurstSession | null>(null);
  const capturedAtRef = useRef<string | undefined>(undefined);

  const canCollectMore = useCallback(() => burstRef.current?.canCollectMore() ?? false, []);

  useEffect(() => {
    const onPop = () => {
      intentRef.current = null;
      collectRef.current = null;
      burstRef.current = null;
      setPendingRecognizeJpeg(null);
      setCollectedCount(0);
      setBurstActive(false);
      setOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const closeOverlay = useCallback(() => {
    intentRef.current = null;
    collectRef.current = null;
    burstRef.current = null;
    setPendingRecognizeJpeg(null);
    setCollectedCount(0);
    setBurstActive(false);
    setOpen(false);
    setDecodeError(null);
  }, []);

  const offerRecognizeJpeg = useCallback((jpeg: Blob) => {
    setPendingRecognizeJpeg(jpeg);
  }, []);

  const closePhotoEdit = useCallback(() => {
    if (historyHasFlag(window.history.state, HISTORY_FLAG)) {
      window.history.back();
      return;
    }
    closeOverlay();
  }, [closeOverlay]);

  const openWithSource = useCallback(
    (nextKind: PhotoEditContextKind, bitmap: ImageBitmap | null, error: string | null) => {
      setKind(nextKind);
      setSource((prev) => {
        if (prev && prev !== bitmap) {
          prev.close();
        }
        return bitmap;
      });
      setDecodeError(error);
      setOpen(true);
      window.history.pushState(withHistoryFlag(window.history.state, HISTORY_FLAG), "");
    },
    [],
  );

  const loadFile = useCallback(
    async (nextKind: PhotoEditContextKind, file: File) => {
      capturedAtRef.current = (await capturedAtFromFile(file)) ?? undefined;
      const decoded = await decodePickedFile(file);
      openWithSource(nextKind, decoded.bitmap, decoded.error);
    },
    [openWithSource],
  );

  const startCapture = useCallback(
    async (nextKind: PhotoEditContextKind, options?: StartCaptureOptions) => {
      intentRef.current = null;
      collectRef.current = null;
      burstRef.current = null;
      setCollectedCount(0);
      setBurstActive(false);
      const file = await pickImage(options?.source ?? "camera");
      if (!file) {
        return;
      }
      intentRef.current = options?.intent ?? null;
      collectRef.current = options?.collect ?? null;
      burstRef.current = options?.burst ?? null;
      setBurstActive(options?.burst !== undefined);
      await loadFile(nextKind, file);
    },
    [loadFile],
  );

  const retake = useCallback(async (source: ImagePickSource = "camera") => {
    const file = await pickImage(source);
    if (!file) {
      return;
    }
    capturedAtRef.current = (await capturedAtFromFile(file)) ?? undefined;
    const decoded = await decodePickedFile(file);
    setSource((prev) => {
      prev?.close();
      return decoded.bitmap;
    });
    setDecodeError(decoded.error);
  }, []);

  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;

  const beginUpload = useCallback(
    async (targetKind: PhotoEditContextKind, processed: ProcessedPhoto) => {
      // 再編集で置き換わる旧写真は未紐付けのまま残るので先に消す（失敗しても 24h GC）
      const previous = attachmentsRef.current[targetKind];
      if (previous?.photoId && previous.previewUrl !== processed.previewUrl) {
        void deletePhoto(previous.photoId).catch(() => {});
      }
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
            capturedAt: processed.capturedAt ?? capturedAtRef.current,
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

  const beginCollectedUpload = useCallback(
    async (processed: ProcessedPhoto, collect: PhotoCollectSession) => {
      if (collect.previousPhotoId) {
        void deletePhoto(collect.previousPhotoId).catch(() => {});
      }
      const draft: PhotoAttachment = {
        previewUrl: processed.previewUrl,
        blob: processed.blob,
        photoId: null,
        status: "uploading",
        recognizeJpeg: processed.recognizeJpeg,
        capturedAt: processed.capturedAt ?? collect.previousCapturedAt ?? capturedAtRef.current,
      };
      collect.onUpdate(draft);
      try {
        const meta = await uploadPhoto(processed.blob);
        collect.onUpdate({ ...draft, photoId: meta.id, status: "ready" });
      } catch {
        collect.onUpdate({ ...draft, status: "error" });
      }
    },
    [],
  );

  const applyProcessed = useCallback(
    (processed: ProcessedPhoto, options?: { keepOpen?: boolean }) => {
      const intent = intentRef.current;
      const collect = collectRef.current;
      const burst = burstRef.current;
      const keepOpen = options?.keepOpen === true && burst !== null;
      collectRef.current = keepOpen && burst ? burst.nextCollect() : null;
      // 読み取り用 JPEG は attachment 側へ移る
      setPendingRecognizeJpeg(null);
      const withCapture: ProcessedPhoto = {
        ...processed,
        capturedAt: processed.capturedAt ?? capturedAtRef.current,
      };
      const commit = () => {
        if (collect) {
          void beginCollectedUpload(withCapture, collect);
          setCollectedCount((count) => count + 1);
          return;
        }
        void beginUpload(kind, withCapture);
      };
      if (keepOpen) {
        commit();
        return;
      }
      if (!intent) {
        closePhotoEdit();
        commit();
        return;
      }
      // 「撮ってから入力へ」: history.back() で閉じると直後の navigate と競合するので、
      // オーバーレイだけ閉じ、積んだ 1 段は呼び出し側の navigate(replace) に置き換えさせる
      const replace = historyHasFlag(window.history.state, HISTORY_FLAG);
      closeOverlay();
      commit();
      intent.onUse({ replace });
    },
    [beginCollectedUpload, beginUpload, closeOverlay, closePhotoEdit, kind],
  );

  const loadBurstFile = useCallback(async (file: File) => {
    capturedAtRef.current = (await capturedAtFromFile(file)) ?? undefined;
    const decoded = await decodePickedFile(file);
    setSource((prev) => {
      if (prev && prev !== decoded.bitmap) {
        prev.close();
      }
      return decoded.bitmap;
    });
    setDecodeError(decoded.error);
  }, []);

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
        capturedAt: current.capturedAt,
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

  const releaseAttachment = useCallback((targetKind: PhotoEditContextKind) => {
    setAttachments((value) => {
      const current = value[targetKind];
      if (!current) {
        return value;
      }
      URL.revokeObjectURL(current.previewUrl);
      const next = { ...value };
      delete next[targetKind];
      return next;
    });
  }, []);

  const editAttachment = useCallback(
    async (targetKind: PhotoEditContextKind) => {
      if (source && kind === targetKind) {
        openWithSource(targetKind, source, null);
        return;
      }
      await startCapture(targetKind);
    },
    [kind, openWithSource, source, startCapture],
  );

  const ingestCollected = useCallback(
    async (processed: ProcessedPhoto, collect: PhotoCollectSession) => {
      setCollectedCount((count) => count + 1);
      await beginCollectedUpload(processed, collect);
    },
    [beginCollectedUpload],
  );

  const editFromBlob = useCallback(
    async (nextKind: PhotoEditContextKind, blob: Blob, collect: PhotoCollectSession) => {
      intentRef.current = null;
      collectRef.current = collect;
      burstRef.current = null;
      setBurstActive(false);
      capturedAtRef.current = collect.previousCapturedAt;
      const file = new File([blob], blob.type === "image/webp" ? "photo.webp" : "photo.jpg", {
        type: blob.type || "image/jpeg",
      });
      const decoded = await decodePickedFile(file);
      openWithSource(nextKind, decoded.bitmap, decoded.error);
    },
    [openWithSource],
  );

  const retryCollectedUpload = useCallback(
    async (attachment: PhotoAttachment, collect: PhotoCollectSession) => {
      await beginCollectedUpload(
        {
          blob: attachment.blob,
          previewUrl: attachment.previewUrl,
          recognizeJpeg: attachment.recognizeJpeg,
          capturedAt: attachment.capturedAt,
        },
        collect,
      );
    },
    [beginCollectedUpload],
  );

  const value = useMemo<PhotoEditValue>(
    () => ({
      open,
      kind,
      source,
      decodeError,
      attachments,
      pendingRecognizeJpeg,
      burstActive,
      collectedCount,
      canCollectMore,
      offerRecognizeJpeg,
      startCapture,
      retake,
      closePhotoEdit,
      applyProcessed,
      loadBurstFile,
      ingestCollected,
      retryUpload,
      clearAttachment,
      releaseAttachment,
      editAttachment,
      editFromBlob,
      retryCollectedUpload,
    }),
    [
      open,
      kind,
      source,
      decodeError,
      attachments,
      pendingRecognizeJpeg,
      burstActive,
      collectedCount,
      canCollectMore,
      offerRecognizeJpeg,
      startCapture,
      retake,
      closePhotoEdit,
      applyProcessed,
      loadBurstFile,
      ingestCollected,
      retryUpload,
      clearAttachment,
      releaseAttachment,
      editAttachment,
      editFromBlob,
      retryCollectedUpload,
    ],
  );

  return <PhotoEditContext.Provider value={value}>{children}</PhotoEditContext.Provider>;
}

export function usePhotoEdit(): PhotoEditValue {
  return useContext(PhotoEditContext);
}
