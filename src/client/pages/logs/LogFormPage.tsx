import { useNavigate } from "react-router";
import { useToast } from "@/client/components/feedback/ToastProvider.tsx";
import { SaveBar } from "@/client/components/layout/SaveBar.tsx";
import { LogNewForm } from "@/client/components/logs/LogNewForm.tsx";
import { TOAST_MESSAGES } from "@/client/lib/toast.ts";

type LogFormPageProps = {
  mode: "new" | "edit";
};

export function LogFormPage({ mode }: LogFormPageProps) {
  if (mode === "new") {
    return <LogNewForm />;
  }
  return <LogEditPlaceholder />;
}

/** `log-edit` は 3-05 で実装する。ここでは骨格だけ残す */
function LogEditPlaceholder() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div className="form-page">
      <p className="form-placeholder">記録の編集は Phase 3-05 で実装します</p>
      <SaveBar
        onSave={() => {
          showToast({ message: TOAST_MESSAGES.saved });
          navigate("/logs");
        }}
      />
    </div>
  );
}
