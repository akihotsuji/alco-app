import { describe, expect, it } from "vitest";
import {
  buildDrinkSearchQuery,
  drinkSearchHref,
  googleDrinkSearchUrl,
  isSafeGoogleSearchHref,
  parseSearchVintage,
} from "./drink-search.ts";

function decodedQuery(href: string): string | null {
  return new URL(href).searchParams.get("q");
}

describe("parseSearchVintage", () => {
  it("trim 後の 4 桁だけを採用し、parseInt 相当の途中入力は捨てる", () => {
    expect(parseSearchVintage(2022)).toBe(2022);
    expect(parseSearchVintage("2022")).toBe(2022);
    expect(parseSearchVintage(" 2022 ")).toBe(2022);
    expect(parseSearchVintage("20")).toBeNull();
    expect(parseSearchVintage("2022abc")).toBeNull();
    expect(parseSearchVintage("NV")).toBeNull();
    expect(parseSearchVintage("")).toBeNull();
    expect(parseSearchVintage("   ")).toBeNull();
    expect(parseSearchVintage(Number.NaN)).toBeNull();
    expect(parseSearchVintage(1799)).toBeNull();
    expect(parseSearchVintage(2101)).toBeNull();
    expect(parseSearchVintage(2022.5)).toBeNull();
  });
});

describe("buildDrinkSearchQuery", () => {
  it.each([
    {
      name: "エルギン シャルドネ",
      producer: "リチャード・カーショー",
      drinkType: "wine",
      vintage: 2022,
      expected: "リチャード・カーショー エルギン シャルドネ 2022",
    },
    {
      name: "リチャード・カーショー エルギン シャルドネ 2022",
      producer: "リチャード・カーショー",
      drinkType: "wine",
      vintage: 2022,
      expected: "リチャード・カーショー エルギン シャルドネ 2022",
    },
    {
      name: "惣誉 純米吟醸",
      producer: "惣誉酒造",
      drinkType: "sake",
      vintage: null,
      expected: "惣誉酒造 惣誉 純米吟醸",
    },
    {
      name: "シャルドネ",
      producer: null,
      drinkType: "wine",
      vintage: null,
      expected: "シャルドネ ワイン",
    },
    {
      name: "純米吟醸",
      producer: null,
      drinkType: "sake",
      vintage: null,
      expected: "純米吟醸 日本酒",
    },
    {
      name: "山崎12年",
      producer: null,
      drinkType: "whisky",
      vintage: 2022,
      expected: "山崎12年",
    },
    {
      name: "エルギン シャルドネ",
      producer: null,
      drinkType: "wine",
      vintage: "20",
      expected: "エルギン シャルドネ",
    },
    {
      name: "Unknown Pleasures",
      producer: null,
      drinkType: null,
      vintage: null,
      expected: "Unknown Pleasures",
    },
  ] as const)("4.6 $name → $expected", ({ expected, ...fields }) => {
    expect(buildDrinkSearchQuery({ ...fields })).toBe(expected);
  });

  it("品名が欠損・仮値なら null。生産者や年号だけでは出さない", () => {
    expect(buildDrinkSearchQuery({ name: null, producer: "蔵", vintage: 2022 })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "  ", producer: "蔵" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "不明", producer: "蔵" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "未入力" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "unknown" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "UNKNOWN" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "n/a" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "（品名未入力）" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "解析中" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "解析中…" })).toBeNull();
    expect(buildDrinkSearchQuery({ name: "解析中..." })).toBeNull();
  });

  it("英字の生産者は単語境界で判定し、短い語の部分一致では重ねない", () => {
    expect(
      buildDrinkSearchQuery({
        name: "Richardson Estate",
        producer: "Rich",
        drinkType: "wine",
      }),
    ).toBe("Rich Richardson Estate");
    expect(
      buildDrinkSearchQuery({
        name: "Kershawville Blanc",
        producer: "Kershaw",
        drinkType: "wine_white",
      }),
    ).toBe("Kershaw Kershawville Blanc");
    expect(
      buildDrinkSearchQuery({
        name: "Richard Kershaw Elgin Chardonnay",
        producer: "Richard Kershaw",
        drinkType: "wine",
      }),
    ).toBe("Richard Kershaw Elgin Chardonnay");
  });

  it("日本語の生産者は連続表記が品名に含まれるときだけ重複とする", () => {
    expect(
      buildDrinkSearchQuery({
        name: "惣誉酒造 純米吟醸",
        producer: "惣誉酒造",
        drinkType: "sake",
      }),
    ).toBe("惣誉酒造 純米吟醸");
    expect(
      buildDrinkSearchQuery({
        name: "惣誉 純米吟醸",
        producer: "惣誉酒造",
        drinkType: "sake",
      }),
    ).toBe("惣誉酒造 惣誉 純米吟醸");
  });

  it("年号は数字境界を見て、ワイン系だけ付ける", () => {
    expect(
      buildDrinkSearchQuery({
        name: "エルギン シャルドネ 2022年",
        producer: null,
        drinkType: "wine_white",
        vintage: 2022,
      }),
    ).toBe("エルギン シャルドネ 2022年");
    expect(
      buildDrinkSearchQuery({
        name: "ロット120220",
        producer: null,
        drinkType: "wine",
        vintage: 2022,
      }),
    ).toBe("ロット120220 2022");
    expect(
      buildDrinkSearchQuery({
        name: "エルギン シャルドネ",
        producer: null,
        drinkType: "wine_sparkling",
        vintage: "2022",
      }),
    ).toBe("エルギン シャルドネ 2022");
    expect(
      buildDrinkSearchQuery({
        name: "エルギン シャルドネ",
        producer: null,
        drinkType: null,
        vintage: 2022,
      }),
    ).toBe("エルギン シャルドネ");
    expect(
      buildDrinkSearchQuery({
        name: "エルギン シャルドネ",
        producer: null,
        drinkType: "wine",
        vintage: "2022abc",
      }),
    ).toBe("エルギン シャルドネ");
  });

  it("一般名称へ付ける酒類は wine 系をワインにまとめ、その他は出さない", () => {
    expect(buildDrinkSearchQuery({ name: "Chardonnay", drinkType: "wine_red" })).toBe(
      "Chardonnay ワイン",
    );
    expect(buildDrinkSearchQuery({ name: "Pinot Noir", drinkType: "wine_sparkling" })).toBe(
      "Pinot Noir ワイン",
    );
    expect(buildDrinkSearchQuery({ name: "純米大吟醸", drinkType: "sake" })).toBe(
      "純米大吟醸 日本酒",
    );
    expect(buildDrinkSearchQuery({ name: "シャルドネ", drinkType: "other" })).toBe("シャルドネ");
    expect(buildDrinkSearchQuery({ name: "シャルドネ" })).toBe("シャルドネ");
    expect(buildDrinkSearchQuery({ name: "シャルドネ ワイン", drinkType: "wine" })).toBe(
      "シャルドネ ワイン",
    );
    expect(
      buildDrinkSearchQuery({
        name: "シャルドネ",
        producer: "蔵元",
        drinkType: "wine",
      }),
    ).toBe("蔵元 シャルドネ");
  });

  it("生産者の仮値と年号エラーは検索全体を止めない", () => {
    expect(
      buildDrinkSearchQuery({
        name: "エルギン シャルドネ",
        producer: "不明",
        drinkType: "wine",
        vintage: "20",
      }),
    ).toBe("エルギン シャルドネ");
  });

  it("検索用コピーだけ空白を正規化し、保存値は受け取った生値の空白だけ整える", () => {
    expect(
      buildDrinkSearchQuery({
        name: " エルギン\nシャルドネ\t ",
        producer: " リチャード・カーショー ",
        drinkType: "wine",
        vintage: " 2022 ",
      }),
    ).toBe("リチャード・カーショー エルギン シャルドネ 2022");
  });
});

describe("googleDrinkSearchUrl / isSafeGoogleSearchHref", () => {
  it("host は www.google.com、pathname は /search、q は復号できる", () => {
    const query = "花と酒 & + # O'Brien";
    const href = googleDrinkSearchUrl(query);
    const url = new URL(href);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("www.google.com");
    expect(url.pathname).toBe("/search");
    expect(url.searchParams.get("q")).toBe(query);
    expect(isSafeGoogleSearchHref(href)).toBe(true);
  });

  it("drinkSearchHref は生成 URL だけ通し、任意ホストや javascript は拒否する", () => {
    const href = drinkSearchHref({
      name: "エルギン シャルドネ",
      producer: "リチャード・カーショー",
      drinkType: "wine",
      vintage: 2022,
    });
    expect(href).toBeTruthy();
    if (!href) {
      return;
    }
    expect(decodedQuery(href)).toBe("リチャード・カーショー エルギン シャルドネ 2022");
    expect(isSafeGoogleSearchHref(href)).toBe(true);
    expect(isSafeGoogleSearchHref("javascript:alert(1)")).toBe(false);
    expect(isSafeGoogleSearchHref("https://evil.example/search?q=a")).toBe(false);
    expect(isSafeGoogleSearchHref("http://www.google.com/search?q=a")).toBe(false);
    expect(isSafeGoogleSearchHref("https://www.google.com/maps/search?q=a")).toBe(false);
  });

  it("品名が空なら href も出さない", () => {
    expect(drinkSearchHref({ name: "", producer: "蔵" })).toBeNull();
  });
});
