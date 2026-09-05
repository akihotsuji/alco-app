import { useNavigate } from "react-router";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import { useCaptureOnCameraQuery } from "@/client/hooks/use-capture-on-camera-query.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";

type LogFormPageProps = {
  mode: "new" | "edit";
};

export function LogFormPage({ mode }: LogFormPageProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { startCapture, attachments, retryUpload, clearAttachment } = useCaptureOnCameraQuery(
    "log",
    mode === "new",
  );

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
