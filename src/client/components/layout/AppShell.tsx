import { useEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AddFab } from "@/client/components/layout/AddFab.tsx";
import { AppHeader } from "@/client/components/layout/AppHeader.tsx";
import { BottomTabBar } from "@/client/components/layout/BottomTabBar.tsx";
import {
  HeaderOverrideProvider,
  useHeaderOverride,
} from "@/client/components/layout/header-override-context.tsx";
import { LeaveGuardProvider } from "@/client/components/layout/leave-guard-context.tsx";
import { usePhotoEdit } from "@/client/components/layout/photo-edit-context.tsx";
import { PhotoEdit } from "@/client/components/photo/PhotoEdit.tsx";
import { useReducedMotion } from "@/client/hooks/use-reduced-motion.ts";
import {
  addFabForRoute,
  hidesTabBar,
  resolveAppRoute,
  type TabDef,
} from "@/client/lib/app-routes.ts";

export const REDUCE_MOTION_ATTR = "data-reduce-motion";

export function AppShell() {
  return (
    <LeaveGuardProvider>
      <HeaderOverrideProvider>
        <AppShellFrame />
      </HeaderOverrideProvider>
    </LeaveGuardProvider>
  );
}

function AppShellFrame() {
  const location = useLocation();
  const navigate = useNavigate();
  const photoEdit = usePhotoEdit();
  const reduceMotion = useReducedMotion();
  const { override } = useHeaderOverride();
  const contentRef = useRef<HTMLDivElement>(null);
  const route = resolveAppRoute(location.pathname, new Date(), location.search);
  const hideTabs = hidesTabBar(location.pathname, photoEdit.open);
  const addFab = hideTabs ? null : addFabForRoute(location.pathname, location.search);
  const header = {
    ...route.header,
    title: override.title ?? route.header.title,
    titleMuted: override.titleMuted ?? route.header.titleMuted,
  };

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
    if (tab.root === null) {
      // 中央タブ「記録」は着地せず記録フォームを開く。撮影は開始しない
      navigate("/logs/new");
      return;
    }
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
    <div className={hideTabs ? "app-shell app-shell-no-tabs" : "app-shell"}>
      {route.hideHeader ? null : <AppHeader header={header} />}
      <div ref={contentRef} className={addFab ? "app-content has-add-fab" : "app-content"}>
        <Outlet />
      </div>
      {hideTabs ? null : <BottomTabBar activeTab={route.parentTab} onSelect={onSelectTab} />}
      {addFab ? <AddFab fab={addFab} /> : null}
      <PhotoEdit />
    </div>
  );
}
