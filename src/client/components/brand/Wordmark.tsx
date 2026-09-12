import wordmarkUrl from "@/client/assets/brand/wordmark.svg";
import {
  WORDMARK_VIEWBOX_HEIGHT,
  WORDMARK_VIEWBOX_WIDTH,
  WORDMARK_WIDTH_PX,
} from "@/client/components/brand/wordmark.ts";
import { PWA_NAME } from "@/shared/pwa.ts";

const wordmarkHeightPx = Math.round(
  (WORDMARK_WIDTH_PX * WORDMARK_VIEWBOX_HEIGHT) / WORDMARK_VIEWBOX_WIDTH,
);

export function Wordmark() {
  return (
    <img
      className="auth-wordmark"
      src={wordmarkUrl}
      alt={PWA_NAME}
      width={WORDMARK_WIDTH_PX}
      height={wordmarkHeightPx}
    />
  );
}
