import {
  MONTH_TO_WEEK_LABEL,
  monthSummaryTitle,
  WEEK_TO_MONTH_LABEL,
  weekSummaryTitle,
} from "@/shared/summary.ts";
import {
  addCalendarDays,
  formatMonthDay,
  isTokyoToday,
  parseCalendarDate,
  tokyoToday,
} from "@/shared/tokyo-date.ts";

export { isTokyoToday, tokyoToday };

export const TAB_IDS = ["home", "cellar", "log", "notes", "settings"] as const;
export type TabId = (typeof TAB_IDS)[number];

export type TabDef = {
  id: TabId;
  label: string;
  /** タブの根。中央タブ「記録」は着地画面を持たない動作（撮影開始）なので `null`（00-common 1.2 (c)） */
  root: string | null;
};

export const TABS: readonly TabDef[] = [
  { id: "home", label: "ホーム", root: "/" },
  { id: "cellar", label: "セラー", root: "/cellar" },
  { id: "log", label: "記録", root: null },
  { id: "notes", label: "ノート", root: "/notes" },
  { id: "settings", label: "設定", root: "/settings" },
];

export type HeaderLeft =
  | { kind: "spacer" }
  | { kind: "back"; fallback: string }
  | { kind: "archive" }
  | { kind: "day-prev"; date: string };

export type HeaderRight =
  | { kind: "spacer" }
  | { kind: "plus"; to: string }
  | { kind: "edit"; to: string }
  | { kind: "text"; to: string; label: string }
  | { kind: "day-next"; date: string; disabled: boolean };

export type ShellHeader = {
  title: string;
  titleMuted?: string;
  left: HeaderLeft;
  right: HeaderRight;
};

export type AppRoute = {
  screenId: string;
  parentTab: TabId | null;
  hideTabBar: boolean;
  header: ShellHeader;
  notFound: boolean;
};

const SPACER = { kind: "spacer" } as const;

export function splitPath(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function isValidLogDateParam(value: string): boolean {
  return parseCalendarDate(value) !== null;
}

function found(
  screenId: string,
  parentTab: TabId,
  header: ShellHeader,
  hideTabBar = false,
): AppRoute {
  return { screenId, parentTab, hideTabBar, header, notFound: false };
}

function backHeader(title: string, fallback: string, right: HeaderRight = SPACER): ShellHeader {
  return { title, left: { kind: "back", fallback }, right };
}

function formRoute(screenId: string, parentTab: TabId, title: string, fallback: string): AppRoute {
  return found(screenId, parentTab, backHeader(title, fallback), true);
}

function detailRoute(
  screenId: string,
  parentTab: TabId,
  title: string,
  fallback: string,
  editTo: string,
): AppRoute {
  return found(screenId, parentTab, backHeader(title, fallback, { kind: "edit", to: editTo }));
}

function notFoundRoute(): AppRoute {
  return {
    screenId: "not-found",
    parentTab: null,
    hideTabBar: false,
    header: {
      title: "見つかりません",
      left: SPACER,
      right: SPACER,
    },
    notFound: true,
  };
}

function logDayHeader(date: string, today: string): ShellHeader {
  const prev = addCalendarDays(date, -1);
  const next = addCalendarDays(date, 1);
  return {
    title: date === today ? "今日" : formatMonthDay(date),
    left: { kind: "day-prev", date: prev },
    right: { kind: "day-next", date: next, disabled: next > today },
  };
}

function logDayPath(date: string, today: string): string {
  return date === today ? "/logs" : `/logs/${date}`;
}

/** `log-new?date=` の戻り先。過去日なら その日の `log-day`、それ以外（今日・未来・不正）は今日 */
function logNewFallback(search: string, today: string): string {
  const date = new URLSearchParams(search).get("date");
  if (date && isValidLogDateParam(date) && date < today) {
    return logDayPath(date, today);
  }
  return "/logs";
}

export function resolveAppRoute(
  pathname: string,
  now: Date = new Date(),
  search: string = "",
): AppRoute {
  const segments = splitPath(pathname);
  const today = tokyoToday(now);

  if (segments.length === 0) {
    return found("home", "home", { title: "ホーム", left: SPACER, right: SPACER });
  }

  if (segments[0] === "summary" && segments.length === 2) {
    const dateParam = new URLSearchParams(search).get("date");
    if (dateParam !== null && !isValidLogDateParam(dateParam)) {
      return notFoundRoute();
    }
    const date = dateParam ?? today;
    if (segments[1] === "week") {
      return found(
        "summary-week",
        "home",
        backHeader(weekSummaryTitle(date, today), "/", {
          kind: "text",
          to: summaryMonthHref(date),
          label: WEEK_TO_MONTH_LABEL,
        }),
      );
    }
    if (segments[1] === "month") {
      return found(
        "summary-month",
        "home",
        backHeader(monthSummaryTitle(date, today), summaryWeekHref(date), {
          kind: "text",
          to: summaryWeekHref(today),
          label: MONTH_TO_WEEK_LABEL,
        }),
      );
    }
  }

  // `/logs` 配下の親タブはすべてホーム。中央タブは着地を持たない（screens.md「認証後 — 記録」）
  if (segments[0] === "logs") {
    if (segments.length === 1) {
      return found("log-day", "home", logDayHeader(today, today));
    }
    if (segments[1] === "new" && segments.length === 2) {
      return formRoute("log-new", "home", "記録する", logNewFallback(search, today));
    }
    if (segments[1] === "my-drinks") {
      if (segments.length === 2) {
        return found(
          "mydrink-list",
          "home",
          backHeader("マイドリンク", "/", { kind: "plus", to: "/logs/my-drinks/new" }),
        );
      }
      if (segments[2] === "new" && segments.length === 3) {
        return formRoute("mydrink-new", "home", "マイドリンクを追加", "/logs/my-drinks");
      }
      if (segments.length === 4 && segments[3] === "edit" && segments[2]) {
        return formRoute("mydrink-edit", "home", "マイドリンクを編集", "/logs/my-drinks");
      }
    }
    if (segments[1] === "entries" && segments.length === 4 && segments[3] === "edit") {
      return formRoute("log-edit", "home", "記録を編集", "/logs");
    }
    if (segments.length === 2 && segments[1] && isValidLogDateParam(segments[1])) {
      return found("log-day", "home", logDayHeader(segments[1], today));
    }
    return notFoundRoute();
  }

  if (segments[0] === "cellar") {
    if (segments.length === 1) {
      return found("bottle-list", "cellar", {
        title: "セラー",
        titleMuted: "0 本",
        left: { kind: "archive" },
        right: { kind: "plus", to: "/cellar/new?camera=1" },
      });
    }
    if (segments[1] === "archive" && segments.length === 2) {
      return found("bottle-archive", "cellar", {
        title: "貯蔵庫",
        titleMuted: "0 本",
        left: { kind: "back", fallback: "/cellar" },
        right: SPACER,
      });
    }
    if (segments[1] === "new" && segments.length === 2) {
      return formRoute("bottle-new", "cellar", "ボトルを追加", "/cellar");
    }
    if (segments.length === 3 && segments[2] === "edit" && segments[1]) {
      return formRoute("bottle-edit", "cellar", "ボトルを編集", `/cellar/${segments[1]}`);
    }
    if (segments.length === 2 && segments[1]) {
      return detailRoute(
        "bottle-detail",
        "cellar",
        "ボトル",
        "/cellar",
        `/cellar/${segments[1]}/edit`,
      );
    }
    return notFoundRoute();
  }

  if (segments[0] === "notes") {
    if (segments.length === 1) {
      return found("note-list", "notes", {
        title: "ノート",
        left: SPACER,
        right: { kind: "plus", to: "/notes/new?camera=1" },
      });
    }
    if (segments[1] === "new" && segments.length === 2) {
      return formRoute("note-new", "notes", "ノートを作成", "/notes");
    }
    if (segments.length === 3 && segments[2] === "edit" && segments[1]) {
      return formRoute("note-edit", "notes", "ノートを編集", `/notes/${segments[1]}`);
    }
    if (segments.length === 2 && segments[1]) {
      return detailRoute("note-detail", "notes", "ノート", "/notes", `/notes/${segments[1]}/edit`);
    }
    return notFoundRoute();
  }

  if (segments[0] === "settings" && segments.length === 1) {
    return found("settings", "settings", { title: "設定", left: SPACER, right: SPACER });
  }

  return notFoundRoute();
}

export function hidesTabBar(pathname: string, photoEditOpen = false): boolean {
  return photoEditOpen || resolveAppRoute(pathname).hideTabBar;
}

export function parentTabOf(pathname: string): TabId | null {
  return resolveAppRoute(pathname).parentTab;
}

export function logDayHref(date: string, now: Date = new Date()): string {
  return logDayPath(date, tokyoToday(now));
}

export function summaryWeekHref(date: string): string {
  return `/summary/week?date=${date}`;
}

export function summaryMonthHref(date: string): string {
  return `/summary/month?date=${date}`;
}

export function logFormHrefs(date?: string): { newHref: string; cameraHref: string } {
  if (!date) {
    return { newHref: "/logs/new", cameraHref: "/logs/new?camera=1" };
  }
  return {
    newHref: `/logs/new?date=${date}`,
    cameraHref: `/logs/new?date=${date}&camera=1`,
  };
}

export function isFutureTokyoDate(date: string, now: Date = new Date()): boolean {
  return isValidLogDateParam(date) && date > tokyoToday(now);
}
