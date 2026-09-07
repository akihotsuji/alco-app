import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addFabForRoute } from "@/client/lib/app-routes.ts";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "AddFab.tsx"), "utf8");
const shell = readFileSync(join(here, "AppShell.tsx"), "utf8");

describe("AddFab（00-common 1.4）", () => {
  it("セラー一覧は「追加」、ノート一覧は「作成」で撮影から始まる", () => {
    expect(addFabForRoute("/cellar")).toEqual({ to: "/cellar/new?camera=1", label: "追加" });
    expect(addFabForRoute("/notes")).toEqual({ to: "/notes/new?camera=1", label: "作成" });
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(addFabForRoute("/notes", `?bottleId=${id}`)).toEqual({
      to: `/notes/new?bottleId=${id}&camera=1`,
      label: "作成",
    });
  });

  it("作成・編集・詳細・他タブには出さない", () => {
    expect(addFabForRoute("/")).toBeNull();
    expect(addFabForRoute("/settings")).toBeNull();
    expect(addFabForRoute("/cellar/new")).toBeNull();
    expect(addFabForRoute("/cellar/batch")).toBeNull();
    expect(addFabForRoute("/cellar/archive")).toBeNull();
    expect(addFabForRoute("/notes/new")).toBeNull();
    expect(addFabForRoute("/logs/my-drinks")).toBeNull();
  });

  it("円 52px の副ボタンで、primary 塗りにしない", () => {
    expect(source).toContain('size="icon-lg"');
    expect(source).toContain('className="add-fab"');
    expect(source).not.toContain("btn-primary");
    expect(source).not.toContain('variant="default"');
    expect(shell).toContain("<AddFab");
    expect(shell).toContain("has-add-fab");
  });
});
