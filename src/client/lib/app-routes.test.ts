import { describe, expect, it } from "vitest";
import {
  addFabForRoute,
  hidesTabBar,
  isValidLogDateParam,
  logCreateHref,
  logFormHrefs,
  noteCreateHref,
  noteFromLogHref,
  notesListHref,
  parentTabOf,
  resolveAppRoute,
  summaryMonthHref,
  summaryWeekHref,
  TABS,
} from "./app-routes.ts";

const NOW = new Date("2026-09-04T15:00:00.000Z");

describe("isValidLogDateParam", () => {
  it("暦日の YYYY-MM-DD だけ日別とみなす", () => {
    expect(isValidLogDateParam("2026-09-05")).toBe(true);
    expect(isValidLogDateParam("new")).toBe(false);
    expect(isValidLogDateParam("2026-09-31")).toBe(false);
  });
});

describe("TABS", () => {
  it("中央タブ「記録」だけ根を持たない（作成ボタン。00-common 1.2）", () => {
    expect(TABS.map((tab) => tab.id)).toEqual(["home", "cellar", "log", "notes", "settings"]);
    expect(TABS.find((tab) => tab.id === "log")?.root).toBeNull();
    for (const tab of TABS.filter((tab) => tab.id !== "log")) {
      expect(tab.root).toMatch(/^\//);
    }
  });
});

describe("resolveAppRoute", () => {
  it("タブの根と親タブを対応させる", () => {
    expect(resolveAppRoute("/", NOW).parentTab).toBe("home");
    expect(resolveAppRoute("/summary/week", NOW).parentTab).toBe("home");
    expect(resolveAppRoute("/cellar/archive", NOW).parentTab).toBe("cellar");
    expect(resolveAppRoute("/notes/abc/edit", NOW).parentTab).toBe("notes");
    expect(resolveAppRoute("/settings", NOW).parentTab).toBe("settings");
  });

  it("週/月サマリーの見出しと相互リンクは date クエリに従う", () => {
    const thisWeek = resolveAppRoute("/summary/week", NOW, "?date=2026-09-05");
    expect(thisWeek.header.title).toBe("今週");
    expect(thisWeek.header.right).toEqual({
      kind: "text",
      to: "/summary/month?date=2026-09-05",
      label: "今月 ›",
    });
    expect(thisWeek.header.left).toEqual({ kind: "back", fallback: "/" });

    const pastWeek = resolveAppRoute("/summary/week", NOW, "?date=2026-08-10");
    expect(pastWeek.header.title).toBe("8月10日〜8月16日");
    expect(pastWeek.header.right).toEqual({
      kind: "text",
      to: "/summary/month?date=2026-09-05",
      label: "今月 ›",
    });

    const thisMonth = resolveAppRoute("/summary/month", NOW);
    expect(thisMonth.header.title).toBe("今月");
    expect(thisMonth.header.left).toEqual({
      kind: "back",
      fallback: "/summary/week?date=2026-09-05",
    });
    expect(thisMonth.header.right).toEqual({
      kind: "text",
      to: "/summary/week?date=2026-09-05",
      label: "今週",
    });

    const pastMonth = resolveAppRoute("/summary/month", NOW, "?date=2026-08-01");
    expect(pastMonth.header.title).toBe("2026年8月");
    expect(pastMonth.header.left).toEqual({
      kind: "back",
      fallback: "/summary/week?date=2026-08-01",
    });
  });

  it("サマリーの date が不正なら not-found", () => {
    expect(resolveAppRoute("/summary/week", NOW, "?date=2026-02-30").notFound).toBe(true);
    expect(resolveAppRoute("/summary/month", NOW, "?date=abc").notFound).toBe(true);
  });

  it("/logs 配下の親タブはすべてホーム（中央タブは現在地を持たない）", () => {
    for (const path of [
      "/logs",
      "/logs/2026-09-04",
      "/logs/new",
      "/logs/entries/x/edit",
      "/logs/my-drinks",
      "/logs/my-drinks/new",
      "/logs/my-drinks/m1/edit",
    ]) {
      expect(resolveAppRoute(path, NOW).parentTab, path).toBe("home");
    }
    expect(resolveAppRoute("/logs/my-drinks", NOW).header.left).toEqual({
      kind: "back",
      fallback: "/",
    });
  });

  it("作成・編集ではタブバーを隠す", () => {
    expect(resolveAppRoute("/logs/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/logs/entries/x/edit", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/logs/my-drinks/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/cellar/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/cellar/b1/edit", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/notes/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/notes/n1/edit", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/settings/account/delete", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/logs", NOW).hideTabBar).toBe(false);
    expect(resolveAppRoute("/cellar/b1", NOW).hideTabBar).toBe(false);
  });

  it("photo-edit 中は経路に関わらずタブを隠す", () => {
    expect(hidesTabBar("/logs", true)).toBe(true);
    expect(hidesTabBar("/", false)).toBe(false);
  });

  it("日別の見出しは今日なら「今日」、過去日は月日", () => {
    expect(resolveAppRoute("/logs", NOW).header.title).toBe("今日");
    expect(resolveAppRoute("/logs/2026-09-04", NOW).header.title).toBe("9月4日");
    expect(resolveAppRoute("/logs/2026-09-05", NOW).header.right).toEqual({
      kind: "day-next",
      date: "2026-09-06",
      disabled: true,
    });
  });

  it("ホームだけ共通ヘッダーを隠し、他画面は従来どおり出す", () => {
    expect(resolveAppRoute("/", NOW).hideHeader).toBe(true);
    expect(resolveAppRoute("/settings", NOW).hideHeader).toBe(false);
    expect(resolveAppRoute("/cellar", NOW).hideHeader).toBe(false);
    expect(resolveAppRoute("/logs", NOW).hideHeader).toBe(false);
    expect(resolveAppRoute("/summary/week", NOW).hideHeader).toBe(false);
  });

  it("予約セグメントを :date / :id より先に解決する", () => {
    expect(resolveAppRoute("/cellar/archive", NOW).screenId).toBe("bottle-archive");
    expect(resolveAppRoute("/logs/new", NOW).screenId).toBe("log-new");
    expect(resolveAppRoute("/logs/my-drinks", NOW).screenId).toBe("mydrink-list");
    expect(resolveAppRoute("/logs/not-a-date", NOW).notFound).toBe(true);
    expect(resolveAppRoute("/settings/account/delete", NOW).screenId).toBe(
      "settings-account-delete",
    );
    expect(resolveAppRoute("/unknown", NOW).screenId).toBe("not-found");
  });

  it("セラー一覧は左が貯蔵庫・右がまとめて追加。追加は右下 FAB（04-cellar C3b / C3）", () => {
    const header = resolveAppRoute("/cellar", NOW).header;
    expect(header.left).toEqual({ kind: "archive" });
    expect(header.right).toEqual({
      kind: "batch",
      to: "/cellar/batch",
    });
    expect(header.titleMuted).toBe("0 本");
    expect(addFabForRoute("/cellar")).toEqual({ to: "/cellar/new", label: "追加" });
  });

  it("まとめて追加は予約セグメントで、戻る＋タブ隠しのフォーム画面", () => {
    const route = resolveAppRoute("/cellar/batch", NOW, "?camera=1");
    expect(route.screenId).toBe("bottle-batch");
    expect(route.parentTab).toBe("cellar");
    expect(route.hideTabBar).toBe(true);
    expect(route.header).toEqual({
      title: "まとめて追加",
      left: { kind: "back", fallback: "/cellar" },
      right: { kind: "spacer" },
    });
  });

  it("作成は戻る＋タブ隠し、詳細は編集リンク", () => {
    const created = resolveAppRoute("/logs/new", NOW);
    expect(created.hideTabBar).toBe(true);
    expect(created.header).toEqual({
      title: "お酒を記録",
      left: { kind: "back", fallback: "/logs" },
      right: { kind: "spacer" },
    });
    // ?date= の過去日はその日の log-day へ戻る。今日・未来・不正は今日
    expect(resolveAppRoute("/logs/new", NOW, "?date=2026-09-04&camera=1").header.left).toEqual({
      kind: "back",
      fallback: "/logs/2026-09-04",
    });
    expect(resolveAppRoute("/logs/new", NOW, "?date=2026-09-05").header.left).toEqual({
      kind: "back",
      fallback: "/logs",
    });
    expect(resolveAppRoute("/logs/new", NOW, "?date=2026-09-09").header.left).toEqual({
      kind: "back",
      fallback: "/logs",
    });
    expect(resolveAppRoute("/logs/new", NOW, "?date=2026-02-30").header.left).toEqual({
      kind: "back",
      fallback: "/logs",
    });
    expect(resolveAppRoute("/cellar/b1", NOW).header.right).toEqual({
      kind: "edit",
      to: "/cellar/b1/edit",
    });
    expect(resolveAppRoute("/unknown", NOW).header).toEqual({
      title: "見つかりません",
      left: { kind: "spacer" },
      right: { kind: "spacer" },
    });
  });
});

describe("parentTabOf", () => {
  it("不明パスはハイライトしない", () => {
    expect(parentTabOf("/nope")).toBeNull();
  });
});

describe("summary hrefs", () => {
  it("週/月サマリーは date クエリを付ける", () => {
    expect(summaryWeekHref("2026-09-05")).toBe("/summary/week?date=2026-09-05");
    expect(summaryMonthHref("2026-08-01")).toBe("/summary/month?date=2026-08-01");
  });
});

describe("note hrefs", () => {
  it("bottleId があるとき作成と一覧に引き継ぐ", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(noteCreateHref(id)).toBe(`/notes/new?bottleId=${id}`);
    expect(notesListHref(id)).toBe(`/notes?bottleId=${id}`);
    expect(noteCreateHref()).toBe("/notes/new");
    const header = resolveAppRoute("/notes", NOW, `?bottleId=${id}`).header;
    expect(header.left).toEqual({ kind: "back", fallback: `/cellar/${id}` });
    expect(header.right).toEqual({ kind: "spacer" });
    expect(addFabForRoute("/notes", `?bottleId=${id}`)).toEqual({
      to: `/notes/new?bottleId=${id}`,
      label: "作成",
    });
    expect(resolveAppRoute("/notes", NOW).header.right).toEqual({ kind: "spacer" });
    expect(addFabForRoute("/notes")).toEqual({ to: "/notes/new", label: "作成" });
    expect(resolveAppRoute("/notes/new", NOW, `?bottleId=${id}`).header.left).toEqual({
      kind: "back",
      fallback: `/notes?bottleId=${id}`,
    });
    expect(resolveAppRoute("/notes/new", NOW, `?bottleId=${id}&from=detail`).header.left).toEqual({
      kind: "back",
      fallback: `/cellar/${id}`,
    });
    expect(noteCreateHref(id, "opened")).toBe(`/notes/new?bottleId=${id}&from=opened`);
    expect(noteFromLogHref(id)).toBe(`/notes/new?fromLog=${id}`);
  });
});

describe("logCreateHref", () => {
  it("ボトル詳細起点は bottleId と from を付け、戻り先を詳細にする", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(logCreateHref({ bottleId: id, from: "detail" })).toBe(
      `/logs/new?bottleId=${id}&from=detail`,
    );
    expect(resolveAppRoute("/logs/new", NOW, `?bottleId=${id}&from=opened`).header.left).toEqual({
      kind: "back",
      fallback: `/cellar/${id}`,
    });
  });
});

describe("logFormHrefs", () => {
  it("日付なしは新規記録、日付ありは query を付ける", () => {
    expect(logFormHrefs()).toEqual({
      newHref: "/logs/new",
      cameraHref: "/logs/new?camera=1",
    });
    expect(logFormHrefs("2026-09-04")).toEqual({
      newHref: "/logs/new?date=2026-09-04",
      cameraHref: "/logs/new?date=2026-09-04&camera=1",
    });
  });
});
