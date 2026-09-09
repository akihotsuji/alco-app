import { describe, expect, it } from "vitest";
import { chunkIdForPath, initialRouteChunkIds, tabChunkIds } from "./route-chunks.ts";

describe("chunkIdForPath", () => {
  it("主要ルートを機能単位の chunk に分ける", () => {
    expect(chunkIdForPath("/")).toBe("home");
    expect(chunkIdForPath("/login")).toBe("login");
    expect(chunkIdForPath("/signup")).toBe("signup");
    expect(chunkIdForPath("/age")).toBe("age");
    expect(chunkIdForPath("/terms")).toBe("legal");
    expect(chunkIdForPath("/privacy")).toBe("legal");
    expect(chunkIdForPath("/summary/week")).toBe("summary");
    expect(chunkIdForPath("/summary/month")).toBe("summary");
    expect(chunkIdForPath("/logs")).toBe("logDay");
    expect(chunkIdForPath("/logs/2026-09-08")).toBe("logDay");
    expect(chunkIdForPath("/logs/new")).toBe("logForm");
    expect(chunkIdForPath("/logs/entries/abc/edit")).toBe("logForm");
    expect(chunkIdForPath("/logs/my-drinks")).toBe("myDrinks");
    expect(chunkIdForPath("/logs/my-drinks/new")).toBe("myDrinks");
    expect(chunkIdForPath("/cellar")).toBe("cellar");
    expect(chunkIdForPath("/cellar/archive")).toBe("cellar");
    expect(chunkIdForPath("/notes/new")).toBe("notes");
    expect(chunkIdForPath("/settings")).toBe("settings");
    expect(chunkIdForPath("/unknown")).toBeNull();
  });
});

describe("initialRouteChunkIds", () => {
  it("開いたパスの画面だけを先読みする（httpOnly Cookie は見ない）", () => {
    expect(initialRouteChunkIds("/login")).toEqual(["login"]);
    expect(initialRouteChunkIds("/signup")).toEqual(["signup"]);
    expect(initialRouteChunkIds("/age")).toEqual(["age"]);
    expect(initialRouteChunkIds("/terms")).toEqual(["legal"]);
    expect(initialRouteChunkIds("/")).toEqual(["shell", "home"]);
    expect(initialRouteChunkIds("/cellar")).toEqual(["shell", "cellar"]);
    expect(initialRouteChunkIds("/logs/new")).toEqual(["shell", "logForm"]);
  });
});

describe("tabChunkIds", () => {
  it("記録タブはフォームと photo-edit を先読みする", () => {
    expect(tabChunkIds("home")).toEqual(["home"]);
    expect(tabChunkIds("cellar")).toEqual(["cellar", "photoEdit"]);
    expect(tabChunkIds("notes")).toEqual(["notes", "photoEdit"]);
    expect(tabChunkIds("settings")).toEqual(["settings"]);
    expect(tabChunkIds("log")).toEqual(["logForm", "photoEdit"]);
  });
});
