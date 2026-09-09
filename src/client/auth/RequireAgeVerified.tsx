import { Navigate, Outlet, useLocation } from "react-router";
import { useMe } from "@/client/hooks/use-me.ts";
import { AuthBoot } from "./AuthBoot.tsx";
import { agePathFor } from "./age-path.ts";

/** タブ配下。未確認なら `/age`。確認の正は `GET /api/me`。 */
export function RequireAgeVerified() {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return <AuthBoot />;
  }
  if (me.isError || !me.data) {
    return <AuthBoot />;
  }
  if (!me.data.ageVerified) {
    return <Navigate to={agePathFor(location.pathname, location.search)} replace />;
  }
  return <Outlet />;
}
