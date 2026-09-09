import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  appShellClassName,
  measureSafeAreaInsets,
  parseCssPx,
  readSafeAreaInsets,
  ZERO_SAFE_AREA,
} from "./device-chrome.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(join(root, "client/styles.css"), "utf8");
const html = readFileSync(join(root, "../index.html"), "utf8");
const readme = readFileSync(join(root, "../README.md"), "utf8");

function ruleBlock(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match?.[1]) {
    throw new Error(`${selector} ブロックが見つかりません`);
  }
  return match[1];
}

describe("device-chrome", () => {
  it("シェル class がタブとヘッダーの有無を表す", () => {
    expect(appShellClassName({ hideTabs: false, hideHeader: false })).toBe("app-shell");
    expect(appShellClassName({ hideTabs: true, hideHeader: false })).toBe(
      "app-shell app-shell-no-tabs",
    );
    expect(appShellClassName({ hideTabs: false, hideHeader: true })).toBe(
      "app-shell app-shell-no-header",
    );
    expect(appShellClassName({ hideTabs: true, hideHeader: true })).toBe(
      "app-shell app-shell-no-tabs app-shell-no-header",
    );
  });

  it("CSS 変数の px を読み、負や空は 0 にする", () => {
    expect(parseCssPx("47px")).toBe(47);
    expect(parseCssPx("0px")).toBe(0);
    expect(parseCssPx("")).toBe(0);
    expect(parseCssPx("auto")).toBe(0);
    expect(
      readSafeAreaInsets({
        getPropertyValue: (name) =>
          ({
            "--safe-top": "47px",
            "--safe-right": "0px",
            "--safe-bottom": "34px",
            "--safe-left": "12.5px",
          })[name] ?? "",
      }),
    ).toEqual({ top: 47, right: 0, bottom: 34, left: 12.5 });
    expect(ZERO_SAFE_AREA).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it("document が無いときはゼロのセーフエリアを返す", () => {
    expect(measureSafeAreaInsets()).toEqual(ZERO_SAFE_AREA);
  });
});

describe("device chrome CSS / HTML / README", () => {
  it("viewport-fit=cover と safe-area トークンがある", () => {
    expect(html).toContain("viewport-fit=cover");
    expect(html).toContain("interactive-widget=resizes-content");
    expect(css).toContain("--safe-top: env(safe-area-inset-top, 0px)");
    expect(css).toContain("--safe-right: env(safe-area-inset-right, 0px)");
    expect(css).toContain("--safe-bottom: env(safe-area-inset-bottom, 0px)");
    expect(css).toContain("--safe-left: env(safe-area-inset-left, 0px)");
    expect(css).toContain("--page-pad-x: 20px");
  });

  it("ヘッダー・タブ・コンテンツ・FAB・トーストが四辺のセーフエリアを使う", () => {
    const header = ruleBlock(".app-header");
    expect(header).toContain("var(--safe-top)");
    expect(header).toContain("var(--safe-right)");
    expect(header).toContain("var(--safe-left)");

    const tabs = ruleBlock(".tab-bar");
    expect(tabs).toContain("var(--safe-bottom)");
    expect(tabs).toContain("var(--safe-right)");
    expect(tabs).toContain("var(--safe-left)");

    const content = ruleBlock(".app-content");
    expect(content).toContain("var(--safe-right)");
    expect(content).toContain("var(--safe-left)");
    expect(content).toContain("var(--safe-bottom)");

    expect(css).toContain(".app-shell-no-header .app-content");
    expect(ruleBlock(".app-shell-no-header .app-content")).toContain("var(--safe-top)");
    expect(ruleBlock(".add-fab")).toContain("var(--safe-right)");
    expect(ruleBlock(".add-fab")).toContain("var(--safe-bottom)");
    expect(ruleBlock(".app-toast")).toContain("var(--safe-left)");
    expect(ruleBlock(".app-toast")).toContain("var(--safe-right)");
    expect(ruleBlock(".save-bar")).toContain("var(--safe-bottom)");
    expect(ruleBlock(".photo-edit-bar")).toContain("var(--safe-top)");
    expect(ruleBlock(".auth-page")).toContain("var(--safe-top)");
    expect(ruleBlock(".app-dialog-panel")).toContain("var(--safe-left)");
  });

  it("設定行とフォームは inherit せずトークン色で、作成画面は縮まない", () => {
    expect(ruleBlock(".settings-row")).toContain("color: var(--foreground)");
    expect(ruleBlock(".form-row")).toContain("color: var(--foreground)");
    expect(ruleBlock(".form-page")).toContain("flex: 1 0 auto");
  });

  it("高さは 100dvh で、入力は 16px 未満にしない", () => {
    expect(css).toContain("height: 100dvh");
    expect(css).not.toMatch(/min-height:\s*100vh\s*;/);
    expect(css).toContain("font-size: max(16px, 1em)");
    expect(css).toMatch(/text-size-adjust:\s*100%/);
    expect(css).toContain("overflow-x: clip");
    expect(css).toContain("overscroll-behavior-y: none");
  });

  it("README に iOS と Android のホーム追加手順がある", () => {
    expect(readme).toContain("ホーム画面に追加");
    expect(readme).toContain("共有");
    expect(readme).toContain("アプリをインストール");
  });
});
