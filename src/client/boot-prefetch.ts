/**
 * メイン JS の解析前に、開いたパスの画面 chunk と初回 GET を取りに行く。
 * 静的 import は置かない（Vite が共有 chunk を挟むと RTT が増える）。
 * 対応表は route-chunks.ts と一致させる（boot-prefetch.test.ts で検証）。
 */
const EARLY_FETCH_TIMEOUT_MS = 10_000;
const loaders = {
  shell: () => import("@/client/layout/AuthenticatedLayout.tsx"),
  home: () => import("@/client/pages/HomePage.tsx"),
  login: () => import("@/client/pages/LoginPage.tsx"),
  signup: () => import("@/client/pages/SignupPage.tsx"),
  age: () => import("@/client/pages/AgePage.tsx"),
  passwordReset: () => import("@/client/pages/PasswordResetPages.tsx"),
  legal: () => import("@/client/pages/LegalPage.tsx"),
  summary: () => import("@/client/pages/summary/SummaryPages.tsx"),
  logDay: () => import("@/client/pages/logs/LogDayPage.tsx"),
  logForm: () => import("@/client/pages/logs/LogFormPage.tsx"),
  myDrinks: () => import("@/client/pages/logs/MyDrinkPages.tsx"),
  cellar: () => import("@/client/pages/cellar/CellarPages.tsx"),
  notes: () => import("@/client/pages/notes/NotePages.tsx"),
  settings: () => import("@/client/pages/SettingsPage.tsx"),
} as const;

type BootChunkId = keyof typeof loaders;

export const SESSION_PATH = "/api/auth/get-session";

export function homeDataPaths(today: string): readonly string[] {
  return [
    `/api/drink-logs/summary?period=day&date=${today}`,
    `/api/drink-logs/summary?period=week&date=${today}`,
    "/api/my-drinks?limit=30",
  ];
}

export function initialRouteChunkIds(pathname: string): readonly BootChunkId[] {
  if (pathname === "/login") {
    return ["login"];
  }
  if (pathname === "/signup") {
    return ["signup"];
  }
  if (pathname === "/age") {
    return ["age"];
  }
  if (pathname === "/forgot-password" || pathname === "/reset-password") {
    return ["passwordReset"];
  }
  if (pathname === "/terms" || pathname === "/privacy") {
    return ["legal"];
  }
  if (pathname === "/") {
    return ["shell", "home"];
  }
  if (pathname.startsWith("/summary/")) {
    return ["shell", "summary"];
  }
  if (pathname.startsWith("/cellar")) {
    return ["shell", "cellar"];
  }
  if (pathname.startsWith("/notes")) {
    return ["shell", "notes"];
  }
  if (pathname.startsWith("/settings")) {
    return ["shell", "settings"];
  }
  if (pathname.startsWith("/logs/my-drinks")) {
    return ["shell", "myDrinks"];
  }
  if (pathname === "/logs/new" || pathname.startsWith("/logs/entries/")) {
    return ["shell", "logForm"];
  }
  if (pathname.startsWith("/logs")) {
    return ["shell", "logDay"];
  }
  return ["shell", "home"];
}

function tokyoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function installEarlyFetchStore(): void {
  const pending = new Map<string, Promise<Response>>();
  window.__alcoEarlyFetch = {
    put(key, value) {
      pending.set(key, value);
    },
    take(key) {
      const value = pending.get(key);
      if (value) {
        pending.delete(key);
      }
      return value;
    },
  };
}

function startEarlyFetch(path: string): void {
  window.__alcoEarlyFetch?.put(
    path,
    fetch(path, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(EARLY_FETCH_TIMEOUT_MS),
    }),
  );
}

export function prefetchInitialRoute(pathname = window.location.pathname): void {
  for (const id of initialRouteChunkIds(pathname)) {
    void loaders[id]().catch(() => undefined);
  }
}

export function prefetchEarlyGets(pathname = window.location.pathname): void {
  startEarlyFetch(SESSION_PATH);
  if (pathname === "/") {
    for (const path of homeDataPaths(tokyoToday())) {
      startEarlyFetch(path);
    }
  }
}

function boot(): void {
  if (typeof window === "undefined") {
    return;
  }
  installEarlyFetchStore();
  prefetchInitialRoute();
  prefetchEarlyGets();
}

if (import.meta.env.MODE !== "test") {
  boot();
}
