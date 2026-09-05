import { useNavigate } from "react-router";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import { useCaptureOnCameraQuery } from "@/client/hooks/use-capture-on-camera-query.ts";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";

export function NotesPage() {
  return (
    <EmptyState
      pose="default"
      message="テイスティングノートはまだありません。撮って一言から"
      actionLabel="作成"
      actionTo="/notes/new?camera=1"
    />
  );
}

export function NoteDetailPage() {
  return <p className="form-placeholder">ノート詳細は Phase 5 で実装します</p>;
}

export function NoteFormPage({ mode }: { mode: "new" | "edit" }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { startCapture, attachments, retryUpload, clearAttachment } = useCaptureOnCameraQuery(
    "note",
    mode === "new",
  );

  return (
    <div className="form-page">
      <PhotoTile
        onClick={() => void startCapture("note")}
        attachment={attachments.note}
        onRetry={() => void retryUpload("note")}
        onClear={() => void clearAttachment("note")}
      />
      <p className="form-placeholder">入力項目は Phase 5 で実装します</p>
      <SaveBar
        onSave={() => {
          showToast({ message: TOAST_MESSAGES.saved });
          navigate("/notes");
        }}
      />
    </div>
  );
}
