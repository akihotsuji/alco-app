import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AppHeader } from "@/client/components/layout/AppHeader.tsx";
import { BottomTabBar } from "@/client/components/layout/BottomTabBar.tsx";
import { LeaveGuardProvider } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { PhotoEdit } from "@/client/components/photo/PhotoEdit.tsx";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import { hidesTabBar, resolveAppRoute, type TabDef } from "@/client/lib/app-routes.ts";

export const REDUCE_MOTION_ATTR = "data-reduce-motion";

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const photoEdit = usePhotoEdit();
  const reduceMotion = useReducedMotion();
  const contentRef = useRef<HTMLDivElement>(null);
  const route = resolveAppRoute(location.pathname);
  const hideTabs = hidesTabBar(location.pathname, photoEdit.open);

  // CSS 側の reduced motion はこの属性 1 つに集約する（motion-design 6.8）
  useEffect(() => {
    const html = document.documentElement;
    if (reduceMotion) {
      html.setAttribute(REDUCE_MOTION_ATTR, "1");
    } else {
      html.removeAttribute(REDUCE_MOTION_ATTR);
    }
    return () => {
      html.removeAttribute(REDUCE_MOTION_ATTR);
    };
  }, [reduceMotion]);

  function onSelectTab(tab: TabDef) {
    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";
    if (route.parentTab === tab.id) {
      if (location.pathname !== tab.root || location.search) {
        navigate(tab.root);
      }
      // M-22: 現在地タブの再タップは先頭へ
      contentRef.current?.scrollTo({ top: 0, behavior });
      window.scrollTo({ top: 0, behavior });
      return;
    }
    navigate(tab.root);
  }

  return (
    <LeaveGuardProvider>
      <div className={hideTabs ? "app-shell app-shell-no-tabs" : "app-shell"}>
        <AppHeader header={route.header} />
        <div ref={contentRef} className="app-content">
          <Outlet />
        </div>
        {hideTabs ? null : <BottomTabBar activeTab={route.parentTab} onSelect={onSelectTab} />}
        <PhotoEdit />
      </div>
    </LeaveGuardProvider>
  );
}
