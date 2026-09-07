import { useCallback } from "react";
import { useNavigate } from "react-router";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { photoHandoffState } from "@/client/lib/history-state.ts";

export const LOG_NEW_PATH = "/logs/new";

/**
 * 中央タブ「記録」とホームのカメラ円ボタンが共有する「撮ってから入力へ」（00-common 1.2 (c)、02-home H9）。
 * 記録用の `photo-edit` をその場で開き、「使う」で `/logs/new` を写真付きで開く。
 * × / 撮影・ライブラリのキャンセル / 戻るでは何もしない（タップ前の画面に留まり、空の `log-new` は開かない）。
 */
export function useCaptureLog(): () => void {
  const navigate = useNavigate();
  const { startCapture } = usePhotoEdit();

  return useCallback(() => {
    void startCapture("log", {
      intent: {
        onUse: ({ replace }) => {
          navigate(LOG_NEW_PATH, { replace, state: photoHandoffState() });
        },
      },
    });
  }, [navigate, startCapture]);
}
