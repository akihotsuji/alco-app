import { Navigate, Outlet, useLocation } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";
import { loginPathFor } from "@/client/lib/auth-redirect.ts";

export function RequireAuth() {
  const { data, isPending } = authClient.useSession();
  const location = useLocation();

  if (isPending) {
    return <div className="auth-boot" />;
  }
  if (!data) {
    return <Navigate to={loginPathFor(location)} replace />;
  }
  return <Outlet />;
}
