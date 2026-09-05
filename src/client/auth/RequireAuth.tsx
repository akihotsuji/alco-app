import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";

export function RequireAuth() {
  const { data, isPending } = authClient.useSession();
  const location = useLocation();
  const queryClient = useQueryClient();
  const signedOut = !isPending && !data;

  // セッションが無くなった時点（期限切れ・API の 401 後）で、前のユーザーの応答を残さない
  useEffect(() => {
    if (signedOut) {
      queryClient.clear();
    }
  }, [signedOut, queryClient]);

  if (isPending) {
    return <div className="auth-boot" />;
  }
  if (!data) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return <Outlet />;
}
