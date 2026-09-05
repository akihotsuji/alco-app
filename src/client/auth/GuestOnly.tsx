import { Navigate, Outlet } from "react-router";
import { authClient } from "@/client/lib/auth-client.ts";
import { AuthBoot } from "./AuthBoot.tsx";

export function GuestOnly() {
  const { data, isPending } = authClient.useSession();

  if (isPending) {
    return <AuthBoot />;
  }
  if (data) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
