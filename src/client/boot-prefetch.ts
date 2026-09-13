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
  feedback: () => import("@/client/pages/FeedbackPage.tsx"),
  accountDeletion: () => import("@/client/pages/AccountDeletionPages.tsx"),
  join: () => import("@/client/pages/JoinPage.tsx"),
} as const;

type BootChunkId = keyof typeof loaders;

export const SESSION_PATH = "/api/auth/get-session";
/** 年齢確認ゲート（RequireAgeVerified）が待つ。セッション GET と並べて飛ばし、直列の 1 往復を消す */
export const ME_PATH = "/api/me";

/** 認証後の画面だけ `/api/me` を先読みする（ゲスト画面では 401 を踏むだけ） */
export const GUEST_ONLY_PATHS: readonly string[] = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/terms",
  "/privacy",
  "/account-deleted",
  "/join",
];

/* 以下は src/shared/constants.ts・cellar-shelf.ts・各 hooks の値の写し。boot-prefetch.test.ts が一致を検証する */
const CELLAR_LIST_VIEW_PREF_KEY = "cellar.listView";
const CELLAR_SELECTED_ID_PREF_KEY = "cellar.selectedId";
const CELLARS_PATH = "/api/cellars";
const DEFAULT_CELLAR_LIST_VIEW = "one";
const SHELF_WIDE_MIN_PX = 480;
const SHELF_COLUMNS_NARROW = 3;
const SHELF_COLUMNS_WIDE = 4;
const SHELF_TYPE_PAGE_LIMIT = 12;
const CELLAR_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TASTING_NOTES_LIST_LIMIT = 50;

export function homeDataPaths(today: string): readonly string[] {
  return [
    `/api/drink-logs/summary?period=day&date=${today}`,
    `/api/drink-logs/summary?period=week&date=${today}`,
    "/api/my-drinks?limit=30",
  ];
}

export type CellarBootInput = {
  search: string;
  storedView: string | null;
  viewportWidth: number;
  storedCellarId?: string | null;
};

function bootCellarId(raw: string | null | undefined): string | undefined {
  if (raw && CELLAR_ID_RE.test(raw)) {
    return raw;
  }
  return undefined;
}

function cellarBottlesPath(view: "one" | "type", viewportWidth: number, cellarId?: string): string {
  const query = new URLSearchParams({ view: "cellar" });
  if (view === "type") {
    query.set("limit", String(SHELF_TYPE_PAGE_LIMIT));
    query.set("group", "type");
  } else {
    const columns = viewportWidth >= SHELF_WIDE_MIN_PX ? SHELF_COLUMNS_WIDE : SHELF_COLUMNS_NARROW;
    query.set("limit", String(columns * 2));
  }
  if (cellarId) {
    query.set("cellarId", cellarId);
  }
  return `/api/bottles?${query}`;
}

/** セラー一覧（`/cellar`）が最初に投げる GET。絞り込み中はボトルを先読みしない（hooks の debounce と食い違う） */
export function cellarDataPaths(input: CellarBootInput): readonly string[] {
  const cellarId = bootCellarId(input.storedCellarId);
  const params = new URLSearchParams(input.search);
  if (params.has("q") || params.has("drinkType")) {
    return [CELLARS_PATH];
  }
  const urlView = params.get("view");
  const view =
    urlView === "one" || urlView === "type"
      ? urlView
      : input.storedView === "one" || input.storedView === "type"
        ? input.storedView
        : DEFAULT_CELLAR_LIST_VIEW;
  return [CELLARS_PATH, cellarBottlesPath(view, input.viewportWidth, cellarId)];
}

/** ノート一覧（`/notes`）が最初に投げる GET。絞り込み・ボトル別は先読みしない */
export function notesDataPaths(search: string): readonly string[] {
  const params = new URLSearchParams(search);
  if (
    params.has("q") ||
    params.has("drinkType") ||
    params.has("ratingX10Min") ||
    params.has("bottleId")
  ) {
    return [];
  }
  return [`/api/tasting-notes?limit=${TASTING_NOTES_LIST_LIMIT}`];
}

function readStoredCellarView(): string | null {
  try {
    return localStorage.getItem(CELLAR_LIST_VIEW_PREF_KEY);
  } catch {
    return null;
  }
}

function readStoredCellarId(): string | null {
  try {
    return localStorage.getItem(CELLAR_SELECTED_ID_PREF_KEY);
  } catch {
    return null;
  }
}

export function initialDataPaths(
  pathname: string,
  search: string,
  today: string,
  cellar: Pick<CellarBootInput, "storedView" | "viewportWidth" | "storedCellarId">,
): readonly string[] {
  if (pathname === "/") {
    return homeDataPaths(today);
  }
  if (pathname === "/cellar") {
    return cellarDataPaths({ search, ...cellar });
  }
  if (pathname === "/notes") {
    return notesDataPaths(search);
  }
  return [];
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
  if (pathname === "/account-deleted") {
    return ["accountDeletion"];
  }
  if (pathname === "/join") {
    return ["join"];
  }
  if (pathname === "/settings/account/delete") {
    return ["shell", "accountDeletion"];
  }
  if (pathname === "/settings/feedback") {
    return ["shell", "feedback"];
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

export function prefetchEarlyGets(
  pathname = window.location.pathname,
  search = window.location.search,
): void {
  startEarlyFetch(SESSION_PATH);
  if (GUEST_ONLY_PATHS.includes(pathname)) {
    return;
  }
  startEarlyFetch(ME_PATH);
  const paths = initialDataPaths(pathname, search, tokyoToday(), {
    storedView: readStoredCellarView(),
    storedCellarId: readStoredCellarId(),
    viewportWidth: window.innerWidth,
  });
  for (const path of paths) {
    startEarlyFetch(path);
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
