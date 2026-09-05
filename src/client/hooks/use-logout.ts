import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useNavigate } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";

/** ログアウト。共有端末に前のユーザーの応答を残さないよう、query キャッシュも捨てる。 */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(async () => {
    await authClient.signOut();
    queryClient.clear();
    navigate("/login", { replace: true });
  }, [queryClient, navigate]);
}
