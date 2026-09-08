import type { TabId } from "@/client/lib/app-routes.ts";
import { hasSessionCookie } from "@/client/lib/session-cookie.ts";

export const routeChunks = {
  shell: () => import("@/client/layout/AuthenticatedLayout.tsx"),
  home: () => import("@/client/pages/HomePage.tsx"),
  login: () => import("@/client/pages/LoginPage.tsx"),
  signup: () => import("@/client/pages/SignupPage.tsx"),
  summary: () => import("@/client/pages/summary/SummaryPages.tsx"),
  logDay: () => import("@/client/pages/logs/LogDayPage.tsx"),
  logForm: () => import("@/client/pages/logs/LogFormPage.tsx"),
  myDrinks: () => import("@/client/pages/logs/MyDrinkPages.tsx"),
  cellar: () => import("@/client/pages/cellar/CellarPages.tsx"),
  notes: () => import("@/client/pages/notes/NotePages.tsx"),
  settings: () => import("@/client/pages/SettingsPage.tsx"),
  notFound: () => import("@/client/pages/NotFoundPage.tsx"),
  photoEdit: () => import("@/client/components/photo/PhotoEdit.tsx"),
} as const;

export type RouteChunkId = keyof typeof routeChunks;

export function initialRouteChunkIds(cookie: string): readonly RouteChunkId[] {
  if (hasSessionCookie(cookie)) {
    return ["shell", "home"];
  }
  return ["login"];
}

export function tabChunkIds(tabId: TabId): readonly RouteChunkId[] {
  if (tabId === "home") {
    return ["home"];
  }
  if (tabId === "cellar") {
    return ["cellar", "photoEdit"];
  }
  if (tabId === "notes") {
    return ["notes", "photoEdit"];
  }
  if (tabId === "settings") {
    return ["settings"];
  }
  return ["logForm", "photoEdit"];
}

export function prefetchRouteChunk(id: RouteChunkId): void {
  void routeChunks[id]();
}

export function chunkIdForPath(pathname: string): RouteChunkId | null {
  if (pathname === "/") {
    return "home";
  }
  if (pathname === "/login") {
    return "login";
  }
  if (pathname === "/signup") {
    return "signup";
  }
  if (pathname.startsWith("/summary/")) {
    return "summary";
  }
  if (pathname.startsWith("/cellar")) {
    return "cellar";
  }
  if (pathname.startsWith("/notes")) {
    return "notes";
  }
  if (pathname.startsWith("/settings")) {
    return "settings";
  }
  if (pathname.startsWith("/logs/my-drinks")) {
    return "myDrinks";
  }
  if (pathname === "/logs/new" || pathname.startsWith("/logs/entries/")) {
    return "logForm";
  }
  if (pathname.startsWith("/logs")) {
    return "logDay";
  }
  return null;
}

export function prefetchPath(pathname: string): void {
  const id = chunkIdForPath(pathname);
  if (id) {
    prefetchRouteChunk(id);
  }
}

export function prefetchTabChunk(tabId: TabId): void {
  for (const id of tabChunkIds(tabId)) {
    prefetchRouteChunk(id);
  }
}

/** セッション Cookie の有無だけで、最初に出す画面の chunk を先読みする */
export function prefetchInitialRoute(cookie = document.cookie): void {
  for (const id of initialRouteChunkIds(cookie)) {
    prefetchRouteChunk(id);
  }
}

export function prefetchPointerProps(pathname: string): {
  onPointerEnter: () => void;
  onFocus: () => void;
} {
  return {
    onPointerEnter: () => prefetchPath(pathname),
    onFocus: () => prefetchPath(pathname),
  };
}

export function prefetchTabPointerProps(tabId: TabId): {
  onPointerEnter: () => void;
  onFocus: () => void;
} {
  return {
    onPointerEnter: () => prefetchTabChunk(tabId),
    onFocus: () => prefetchTabChunk(tabId),
  };
}
