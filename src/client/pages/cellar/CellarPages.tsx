import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { Mascot } from "@/client/components/mascot/Mascot.tsx";
import { PhotoTile } from "@/client/components/photo/PhotoTile.tsx";
import { buttonVariants } from "@/client/components/ui/button.tsx";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";
import { cn } from "@/client/lib/utils.ts";

export function CellarPage() {
  return (
    <div className="cellar-empty">
      <div className="shelf-stage">
        <Mascot pose="surprised" size={96} aria-hidden />
        <div className="shelf-board" />
      </div>
      <p className="empty-state-message">ボトルはまだありません。撮って 1 本目を並べましょう</p>
      <Link className={cn(buttonVariants(), "empty-action")} to="/cellar/new?camera=1">
        ボトルを追加
      </Link>
    </div>
  );
}

export function ArchivePage() {
  return <EmptyState pose="default" message="飲み終えたボトルはここに並びます" />;
}

export function BottleDetailPage() {
  return <p className="form-placeholder">ボトル詳細は Phase 4 で実装します</p>;
}

export function BottleFormPage({ mode }: { mode: "new" | "edit" }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { openPhotoEdit } = usePhotoEdit();
  const camera = searchParams.get("camera") === "1";

  useEffect(() => {
    if (mode === "new" && camera) {
      openPhotoEdit("cellar");
    }
  }, [camera, mode, openPhotoEdit]);

  return (
    <div className="form-page">
      <PhotoTile onClick={() => openPhotoEdit("cellar")} showMascot={false} />
      <p className="form-placeholder">入力項目は Phase 4 で実装します</p>
      <SaveBar
        label={mode === "new" ? "棚に並べる" : "保存する"}
        onSave={() => {
          showToast({ message: TOAST_MESSAGES.saved });
          navigate("/cellar");
        }}
      />
    </div>
  );
}
