import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";

type LogFormPageProps = {
  mode: "new" | "edit";
};

export function LogFormPage({ mode }: LogFormPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { startCapture, attachments, retryUpload, clearAttachment } = usePhotoEdit();
  const camera = searchParams.get("camera") === "1";

  useEffect(() => {
    if (mode === "new" && camera) {
      void startCapture("log");
    }
  }, [camera, mode, startCapture]);

  return (
    <div className="form-page">
      <PhotoTile
        onClick={() => void startCapture("log")}
        attachment={attachments.log}
        onRetry={() => void retryUpload("log")}
        onClear={() => void clearAttachment("log")}
      />
      <p className="form-placeholder">入力項目は Phase 3 で実装します</p>
      <SaveBar
        onSave={() => {
          showToast({ message: TOAST_MESSAGES.saved });
          navigate("/logs");
        }}
      />
    </div>
  );
}
