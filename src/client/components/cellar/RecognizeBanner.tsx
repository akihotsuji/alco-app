import { Sparkles } from "lucide-react";
import { RECOGNIZE_BANNER, type RecognizeBannerStatus } from "@/client/lib/label-recognize.ts";

export function RecognizeBanner({
  status,
  messages = RECOGNIZE_BANNER,
}: {
  status: RecognizeBannerStatus;
  messages?: Record<RecognizeBannerStatus, string>;
}) {
  return (
    <div className="recognize-banner" role="status">
      {status === "loading" ? (
        <span className="recognize-spinner" aria-hidden />
      ) : (
        <Sparkles size={16} aria-hidden />
      )}
      <span>{messages[status]}</span>
    </div>
  );
}
