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
  root: string;
};

export const TABS: readonly TabDef[] = [
  { id: "home", label: "ホーム", root: "/" },
  { id: "cellar", label: "セラー", root: "/cellar" },
  { id: "log", label: "記録", root: "/logs" },
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

export function splitPath(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

export function isValidLogDateParam(value: string): boolean {
  return parseCalendarDate(value) !== null;
}

function notFoundRoute(): AppRoute {
  return {
    screenId: "not-found",
    parentTab: null,
    hideTabBar: false,
    header: {
      title: "見つかりません",
      left: { kind: "spacer" },
      right: { kind: "spacer" },
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

export function resolveAppRoute(pathname: string, now: Date = new Date()): AppRoute {
  const segments = splitPath(pathname);
  const today = tokyoToday(now);

  if (segments.length === 0) {
    return {
      screenId: "home",
      parentTab: "home",
      hideTabBar: false,
      header: { title: "ホーム", left: { kind: "spacer" }, right: { kind: "spacer" } },
      notFound: false,
    };
  }

  if (segments[0] === "summary" && segments.length === 2) {
    if (segments[1] === "week") {
      return {
        screenId: "summary-week",
        parentTab: "home",
        hideTabBar: false,
        header: {
          title: "今週",
          left: { kind: "back", fallback: "/" },
          right: { kind: "text", to: "/summary/month", label: "今月" },
        },
        notFound: false,
      };
    }
    if (segments[1] === "month") {
      return {
        screenId: "summary-month",
        parentTab: "home",
        hideTabBar: false,
        header: {
          title: "今月",
          left: { kind: "back", fallback: "/" },
          right: { kind: "text", to: "/summary/week", label: "今週" },
        },
        notFound: false,
      };
    }
  }

  if (segments[0] === "logs") {
    if (segments.length === 1) {
      return {
        screenId: "log-day",
        parentTab: "log",
        hideTabBar: false,
        header: logDayHeader(today, today),
        notFound: false,
      };
    }
    if (segments[1] === "new" && segments.length === 2) {
      return {
        screenId: "log-new",
        parentTab: "log",
        hideTabBar: true,
        header: {
          title: "記録する",
          left: { kind: "back", fallback: "/logs" },
          right: { kind: "spacer" },
        },
        notFound: false,
      };
    }
    if (segments[1] === "my-drinks") {
      if (segments.length === 2) {
        return {
          screenId: "mydrink-list",
          parentTab: "log",
          hideTabBar: false,
          header: {
            title: "マイドリンク",
            left: { kind: "back", fallback: "/logs" },
            right: { kind: "plus", to: "/logs/my-drinks/new" },
          },
          notFound: false,
        };
      }
      if (segments[2] === "new" && segments.length === 3) {
        return {
          screenId: "mydrink-new",
          parentTab: "log",
          hideTabBar: true,
          header: {
            title: "マイドリンクを追加",
            left: { kind: "back", fallback: "/logs/my-drinks" },
            right: { kind: "spacer" },
          },
          notFound: false,
        };
      }
      if (segments.length === 4 && segments[3] === "edit" && segments[2]) {
        return {
          screenId: "mydrink-edit",
          parentTab: "log",
          hideTabBar: true,
          header: {
            title: "マイドリンクを編集",
            left: { kind: "back", fallback: "/logs/my-drinks" },
            right: { kind: "spacer" },
          },
          notFound: false,
        };
      }
    }
    if (segments[1] === "entries" && segments.length === 4 && segments[3] === "edit") {
      return {
        screenId: "log-edit",
        parentTab: "log",
        hideTabBar: true,
        header: {
          title: "記録を編集",
          left: { kind: "back", fallback: "/logs" },
          right: { kind: "spacer" },
        },
        notFound: false,
      };
    }
    if (segments.length === 2 && segments[1] && isValidLogDateParam(segments[1])) {
      return {
        screenId: "log-day",
        parentTab: "log",
        hideTabBar: false,
        header: logDayHeader(segments[1], today),
        notFound: false,
      };
    }
    return notFoundRoute();
  }

  if (segments[0] === "cellar") {
    if (segments.length === 1) {
      return {
        screenId: "bottle-list",
        parentTab: "cellar",
        hideTabBar: false,
        header: {
          title: "セラー",
          titleMuted: "0 本",
          left: { kind: "archive" },
          right: { kind: "plus", to: "/cellar/new?camera=1" },
        },
        notFound: false,
      };
    }
    if (segments[1] === "archive" && segments.length === 2) {
      return {
        screenId: "bottle-archive",
        parentTab: "cellar",
        hideTabBar: false,
        header: {
          title: "貯蔵庫",
          titleMuted: "0 本",
          left: { kind: "back", fallback: "/cellar" },
          right: { kind: "spacer" },
        },
        notFound: false,
      };
    }
    if (segments[1] === "new" && segments.length === 2) {
      return {
        screenId: "bottle-new",
        parentTab: "cellar",
        hideTabBar: true,
        header: {
          title: "ボトルを追加",
          left: { kind: "back", fallback: "/cellar" },
          right: { kind: "spacer" },
        },
        notFound: false,
      };
    }
    if (segments.length === 3 && segments[2] === "edit" && segments[1]) {
      return {
        screenId: "bottle-edit",
        parentTab: "cellar",
        hideTabBar: true,
        header: {
          title: "ボトルを編集",
          left: { kind: "back", fallback: `/cellar/${segments[1]}` },
          right: { kind: "spacer" },
        },
        notFound: false,
      };
    }
    if (segments.length === 2 && segments[1]) {
      return {
        screenId: "bottle-detail",
        parentTab: "cellar",
        hideTabBar: false,
        header: {
          title: "ボトル",
          left: { kind: "back", fallback: "/cellar" },
          right: { kind: "edit", to: `/cellar/${segments[1]}/edit` },
        },
        notFound: false,
      };
    }
    return notFoundRoute();
  }

  if (segments[0] === "notes") {
    if (segments.length === 1) {
      return {
        screenId: "note-list",
        parentTab: "notes",
        hideTabBar: false,
        header: {
          title: "ノート",
          left: { kind: "spacer" },
          right: { kind: "plus", to: "/notes/new?camera=1" },
        },
        notFound: false,
      };
    }
    if (segments[1] === "new" && segments.length === 2) {
      return {
        screenId: "note-new",
        parentTab: "notes",
        hideTabBar: true,
        header: {
          title: "ノートを作成",
          left: { kind: "back", fallback: "/notes" },
          right: { kind: "spacer" },
        },
        notFound: false,
      };
    }
    if (segments.length === 3 && segments[2] === "edit" && segments[1]) {
      return {
        screenId: "note-edit",
        parentTab: "notes",
        hideTabBar: true,
        header: {
          title: "ノートを編集",
          left: { kind: "back", fallback: `/notes/${segments[1]}` },
          right: { kind: "spacer" },
        },
        notFound: false,
      };
    }
    if (segments.length === 2 && segments[1]) {
      return {
        screenId: "note-detail",
        parentTab: "notes",
        hideTabBar: false,
        header: {
          title: "ノート",
          left: { kind: "back", fallback: "/notes" },
          right: { kind: "edit", to: `/notes/${segments[1]}/edit` },
        },
        notFound: false,
      };
    }
    return notFoundRoute();
  }

  if (segments[0] === "settings" && segments.length === 1) {
    return {
      screenId: "settings",
      parentTab: "settings",
      hideTabBar: false,
      header: { title: "設定", left: { kind: "spacer" }, right: { kind: "spacer" } },
      notFound: false,
    };
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

export function isFutureTokyoDate(date: string, now: Date = new Date()): boolean {
  return isValidLogDateParam(date) && date > tokyoToday(now);
}
