import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";
import { loginPathFor } from "./login-path.ts";

export function RequireAuth() {
  const { data, isPending } = authClient.useSession();
  const location = useLocation();
  const queryClient = useQueryClient();
  const signedOut = !isPending && !data;

  // ログアウト・期限切れ・API の 401 はすべてここに集まる。前のユーザーの応答を残さない
  useEffect(() => {
    if (signedOut) {
      queryClient.clear();
    }
  }, [signedOut, queryClient]);

  if (isPending) {
    return <div className="auth-boot" />;
  }
  if (!data) {
    return <Navigate to={loginPathFor(location.pathname, location.search)} replace />;
  }
  return <Outlet />;
}
