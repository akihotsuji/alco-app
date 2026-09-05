import { describe, expect, it } from "vitest";
import { hidesTabBar, isValidLogDateParam, parentTabOf, resolveAppRoute } from "./app-routes.ts";

const NOW = new Date("2026-09-04T15:00:00.000Z");

describe("isValidLogDateParam", () => {
  it("暦日の YYYY-MM-DD だけ日別とみなす", () => {
    expect(isValidLogDateParam("2026-09-05")).toBe(true);
    expect(isValidLogDateParam("new")).toBe(false);
    expect(isValidLogDateParam("2026-09-31")).toBe(false);
  });
});

describe("resolveAppRoute", () => {
  it("タブの根と親タブを対応させる", () => {
    expect(resolveAppRoute("/", NOW).parentTab).toBe("home");
    expect(resolveAppRoute("/summary/week", NOW).parentTab).toBe("home");
    expect(resolveAppRoute("/cellar/archive", NOW).parentTab).toBe("cellar");
    expect(resolveAppRoute("/logs", NOW).parentTab).toBe("log");
    expect(resolveAppRoute("/notes/abc/edit", NOW).parentTab).toBe("notes");
    expect(resolveAppRoute("/settings", NOW).parentTab).toBe("settings");
  });

  it("作成・編集ではタブバーを隠す", () => {
    expect(resolveAppRoute("/logs/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/logs/entries/x/edit", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/logs/my-drinks/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/cellar/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/cellar/b1/edit", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/notes/new", NOW).hideTabBar).toBe(true);
    expect(resolveAppRoute("/notes/n1/edit", NOW).hideTabBar).toBe(true);
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

  it("予約セグメントを :date / :id より先に解決する", () => {
    expect(resolveAppRoute("/cellar/archive", NOW).screenId).toBe("bottle-archive");
    expect(resolveAppRoute("/logs/new", NOW).screenId).toBe("log-new");
    expect(resolveAppRoute("/logs/my-drinks", NOW).screenId).toBe("mydrink-list");
    expect(resolveAppRoute("/logs/not-a-date", NOW).notFound).toBe(true);
    expect(resolveAppRoute("/unknown", NOW).screenId).toBe("not-found");
  });

  it("セラー一覧は左が貯蔵庫・右が追加", () => {
    const header = resolveAppRoute("/cellar", NOW).header;
    expect(header.left).toEqual({ kind: "archive" });
    expect(header.right).toEqual({ kind: "plus", to: "/cellar/new?camera=1" });
    expect(header.titleMuted).toBe("0 本");
  });
});

describe("parentTabOf", () => {
  it("不明パスはハイライトしない", () => {
    expect(parentTabOf("/nope")).toBeNull();
  });
});
