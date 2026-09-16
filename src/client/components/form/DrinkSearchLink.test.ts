import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DRINK_SEARCH_LABEL, drinkSearchHref } from "@/shared/drink-search.ts";
import { DrinkSearchLink } from "./DrinkSearchLink.tsx";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "DrinkSearchLink.tsx"),
  "utf8",
);

function render(props: Parameters<typeof DrinkSearchLink>[0]): string {
  return renderToStaticMarkup(createElement(DrinkSearchLink, props));
}

describe("DrinkSearchLink", () => {
  it("有効な品名のときテキストリンクを出し、空欄・仮値では出さない", () => {
    const html = render({
      name: "エルギン シャルドネ",
      producer: "リチャード・カーショー",
      vintage: 2022,
      drinkType: "wine",
    });
    expect(html).toContain("<a ");
    expect(html).toContain(DRINK_SEARCH_LABEL);
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("aria-hidden");
    expect(html).toContain("Googleで『エルギン シャルドネ』を検索");
    const href = drinkSearchHref({
      name: "エルギン シャルドネ",
      producer: "リチャード・カーショー",
      vintage: 2022,
      drinkType: "wine",
    });
    expect(href).toBeTruthy();
    expect(html).toContain(`href="${href}"`);
    expect(render({ name: "" })).toBe("");
    expect(render({ name: "  " })).toBe("");
    expect(render({ name: "不明", producer: "蔵" })).toBe("");
  });

  it("最新の props から href を作り、保存ボタンや window.open は使わない", () => {
    const first = render({ name: "エルギン シャルドネ", drinkType: "wine", vintage: "2020" });
    const second = render({ name: "エルギン シャルドネ", drinkType: "wine", vintage: "2022" });
    expect(first).not.toBe(second);
    expect(second).toContain("2022");
    expect(htmlHasNoSubmit(first)).toBe(true);
    expect(source).not.toContain("window.open");
    expect(source).not.toContain('type="submit"');
    expect(source).not.toContain("<button");
    expect(source).not.toContain("onClick");
  });
});

function htmlHasNoSubmit(html: string): boolean {
  return !html.includes("<button") && !html.includes('type="submit"');
}
