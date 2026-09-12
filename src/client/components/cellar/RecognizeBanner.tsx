import { Sparkles } from "lucide-react";
import {
  RECOGNIZE_BANNER,
  RECOGNIZE_RETRY_LABEL,
  RECOGNIZE_WITH_BACK_LABEL,
  type RecognizeBannerStatus,
} from "@/client/lib/label-recognize.ts";

export function RecognizeBanner({
  status,
  messages = RECOGNIZE_BANNER,
  onRetry,
  onRecognizeWithBack,
}: {
  status: RecognizeBannerStatus;
  messages?: Record<RecognizeBannerStatus, string>;
  /** 失敗帯だけに「再読み取り」を出す。読み取り中は出さない */
  onRetry?: () => void;
  /** 成功帯かつ裏面があるとき。「裏面も含めて読み取る」 */
  onRecognizeWithBack?: () => void;
}) {
  return (
    <div className="recognize-banner" role="status">
      {status === "loading" ? (
        <span className="recognize-spinner" aria-hidden />
      ) : (
        <Sparkles size={16} aria-hidden />
      )}
      <span className="recognize-banner-text">{messages[status]}</span>
      {status === "failure" && onRetry ? (
        <button type="button" className="header-text-link recognize-retry" onClick={onRetry}>
          {RECOGNIZE_RETRY_LABEL}
        </button>
      ) : null}
      {status === "success" && onRecognizeWithBack ? (
        <button
          type="button"
          className="header-text-link recognize-retry"
          onClick={onRecognizeWithBack}
        >
          {RECOGNIZE_WITH_BACK_LABEL}
        </button>
      ) : null}
    </div>
  );
}
