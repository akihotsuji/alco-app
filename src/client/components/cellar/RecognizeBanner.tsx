import { Sparkles } from "lucide-react";
import { RECOGNIZE_BANNER, type RecognizeBannerStatus } from "@/client/lib/label-recognize.ts";

export function RecognizeBanner({ status }: { status: RecognizeBannerStatus }) {
  return (
    <div className="recognize-banner" role="status">
      {status === "loading" ? (
        <span className="recognize-spinner" aria-hidden />
      ) : (
        <Sparkles size={16} aria-hidden />
      )}
      <span>{RECOGNIZE_BANNER[status]}</span>
    </div>
  );
}
