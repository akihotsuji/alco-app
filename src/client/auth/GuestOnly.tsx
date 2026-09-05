import { Navigate, Outlet } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";
import { resolveSafeRedirect } from "@/shared/auth.ts";

export function GuestOnly() {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return <div className="auth-boot" />;
  }
  if (data) {
    return <Navigate to={resolveSafeRedirect("/")} replace />;
  }
  return <Outlet />;
}
