import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function FieldWithAiMark({ marked, children }: { marked: boolean; children: ReactNode }) {
  return (
    <div className={marked ? "field-with-ai is-ai" : "field-with-ai"}>
      {children}
      {marked ? (
        <span className="pill ai">
          <Sparkles size={11} aria-hidden />
          AI
        </span>
      ) : null}
    </div>
  );
}
