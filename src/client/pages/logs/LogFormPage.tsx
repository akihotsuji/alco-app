import { useParams } from "react-router";
import { LogEditForm } from "@/client/components/logs/LogEditForm.tsx";
import { LogNewForm } from "@/client/components/logs/LogNewForm.tsx";

type LogFormPageProps = {
  mode: "new" | "edit";
};

export function LogFormPage({ mode }: LogFormPageProps) {
  const { logId } = useParams();
  if (mode === "new") {
    return <LogNewForm />;
  }
  return <LogEditForm logId={logId} />;
}
