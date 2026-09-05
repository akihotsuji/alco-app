import { useNavigate } from "react-router";
import { EmptyState } from "@/client/components/feedback/EmptyState.tsx";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";

export function MyDrinkListPage() {
  return (
    <EmptyState
      pose="default"
      message="よく飲む一杯を登録すると 1 タップで記録できます"
      actionLabel="追加"
      actionTo="/logs/my-drinks/new"
    />
  );
}

export function MyDrinkFormPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div className="form-page">
      <p className="form-placeholder">入力項目は Phase 3 で実装します</p>
      <SaveBar
        onSave={() => {
          showToast({ message: TOAST_MESSAGES.saved });
          navigate("/logs/my-drinks");
        }}
      />
    </div>
  );
}
