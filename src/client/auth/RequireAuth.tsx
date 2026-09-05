import { Navigate, Outlet, useLocation } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";

export function RequireAuth() {
  const { data, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return <div className="auth-boot" />;
  }
  if (!data) {
    const redirect = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  return <Outlet />;
}
