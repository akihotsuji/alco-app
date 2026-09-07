import { describe, expect, it } from "vitest";
import { THEME_PREFS } from "@/shared/constants.ts";
import { parseThemePref } from "./preferences.ts";
import { applyTheme, resolveTheme, THEME_ATTR } from "./theme.ts";

describe("theme", () => {
  it("外観の選択肢は 端末に従う / ライト / ダーク の 3 つ", () => {
    expect(THEME_PREFS).toEqual(["system", "light", "dark"]);
  });

  it("端末に従う（既定）は OS の外観で決まる", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
  });

  it("ライト / ダークを選ぶと OS の外観に関係なく固定される", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("不正・未保存の値は 端末に従う に倒す", () => {
    expect(parseThemePref(null)).toBe("system");
    expect(parseThemePref("blue")).toBe("system");
    expect(parseThemePref("dark")).toBe("dark");
  });

  it("applyTheme は html の data-theme に解決済みの値だけを書く（system は書かない）", () => {
    const html = { attributes: new Map<string, string>() } as unknown as HTMLElement & {
      attributes: Map<string, string>;
    };
    const setAttribute = (name: string, value: string) => html.attributes.set(name, value);
    const target = { setAttribute } as unknown as HTMLElement;
    expect(applyTheme(target, "system", true)).toBe("dark");
    expect(html.attributes.get(THEME_ATTR)).toBe("dark");
    expect(applyTheme(target, "light", true)).toBe("light");
    expect(html.attributes.get(THEME_ATTR)).toBe("light");
  });
});
