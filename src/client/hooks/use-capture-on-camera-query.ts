import { useEffect } from "react";
import { useSearchParams } from "react-router";
import {
  type PhotoEditContextKind,
  usePhotoEdit,
} from "@/client/components/layout/photo-edit-context.tsx";

/** `?camera=1` の新規作成画面で撮影を開始する。記録・ノート・セラーのフォームが共有する。 */
export function useCaptureOnCameraQuery(kind: PhotoEditContextKind, enabled: boolean) {
  const [searchParams] = useSearchParams();
  const { startCapture, attachments, retryUpload, clearAttachment } = usePhotoEdit();
  const camera = searchParams.get("camera") === "1";

  useEffect(() => {
    if (enabled && camera) {
      void startCapture(kind);
    }
  }, [camera, enabled, kind, startCapture]);

  return { startCapture, attachments, retryUpload, clearAttachment };
}
