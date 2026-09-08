import { Suspense } from "react";
import { Navigate, Outlet } from "react-router";
import { ToastProvider } from "@/client/components/feedback/ToastProvider.tsx";
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
  return (
    <ToastProvider>
      <Suspense fallback={<AuthBoot />}>
        <Outlet />
      </Suspense>
    </ToastProvider>
  );
}
