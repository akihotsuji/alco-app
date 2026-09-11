import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "ToastProvider.tsx"), "utf8");
const shell = readFileSync(join(here, "../layout/AppShell.tsx"), "utf8");

describe("ToastProvider / ToastHost", () => {
  it("表示はヘッダー直下スロットで、画面遷移では消さない", () => {
    expect(source).toContain("export function ToastHost");
    expect(source).toContain("画面遷移では消さない");
    expect(source).not.toContain("useLocation");
    expect(shell).toContain("<ToastHost />");
    expect(shell.indexOf("<AppHeader")).toBeLessThan(shell.indexOf("<ToastHost"));
    expect(shell.indexOf("<ToastHost")).toBeLessThan(shell.indexOf("app-content"));
  });

  it("操作付き通知は閉じられ、スクリーンリーダー通知を維持しフォーカスを奪わない", () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('aria-label="閉じる"');
    expect(source).toContain("onPointerCancel");
    expect(source).toContain("onPointerLeave");
    expect(source).toContain("onBlur");
    expect(source).not.toContain(".focus(");
    expect(source).not.toContain("autoFocus");
  });
});
