import { useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AppHeader } from "@/client/components/layout/AppHeader.tsx";
import { BottomTabBar } from "@/client/components/layout/BottomTabBar.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { PhotoEditOverlay } from "@/client/components/photo/PhotoEditOverlay.tsx";
import { hidesTabBar, resolveAppRoute, type TabDef } from "@/client/lib/app-routes.ts";

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const photoEdit = usePhotoEdit();
  const contentRef = useRef<HTMLDivElement>(null);
  const route = resolveAppRoute(location.pathname);
  const hideTabs = hidesTabBar(location.pathname, photoEdit.open);

  function onSelectTab(tab: TabDef) {
    if (route.parentTab === tab.id) {
      if (location.pathname !== tab.root || location.search) {
        navigate(tab.root);
      }
      contentRef.current?.scrollTo({ top: 0 });
      window.scrollTo({ top: 0 });
      return;
    }
    navigate(tab.root);
  }

  return (
    <div className={hideTabs ? "app-shell app-shell-no-tabs" : "app-shell"}>
      <AppHeader header={route.header} />
      <div ref={contentRef} className="app-content">
        <Outlet />
      </div>
      {hideTabs ? null : <BottomTabBar activeTab={route.parentTab} onSelect={onSelectTab} />}
      <PhotoEditOverlay />
    </div>
  );
}
