import { describe, expect, it } from "vitest";
import {
  FREQUENT_ORIGIN_COUNTRIES_JA,
  isAllowedOriginJa,
  japaneseOriginNames,
  normalizeOriginToJa,
  ORIGIN_COUNTRIES,
  ORIGIN_SEARCH_LIMIT,
  resolveWritableOrigin,
  searchOriginCountries,
} from "./origin-countries.ts";

describe("searchOriginCountries", () => {
  it("空なら候補を出さない（呼び出し側がよく使う国を出す）", () => {
    expect(searchOriginCountries("")).toEqual([]);
    expect(searchOriginCountries("   ")).toEqual([]);
  });

  it("日本語名の前方一致を先頭に、部分一致を後ろに置く", () => {
    const names = searchOriginCountries("ア").map((country) => country.ja);
    expect(names.length).toBeLessThanOrEqual(ORIGIN_SEARCH_LIMIT);
    expect(names[0]).toBe("アイスランド");
    expect(names.every((name) => name.startsWith("ア"))).toBe(true);
    expect(searchOriginCountries("フラン")[0]?.ja).toBe("フランス");
    expect(searchOriginCountries("フランス")[0]?.ja).toBe("フランス");
    expect(searchOriginCountries("メリカ").map((country) => country.ja)).toContain(
      "アメリカ合衆国",
    );
  });

  it("ひらがな入力と英語別名でも当たる", () => {
    expect(searchOriginCountries("ふらんす")[0]?.ja).toBe("フランス");
    expect(searchOriginCountries("いた")[0]?.ja).toBe("イタリア");
    expect(searchOriginCountries("fra")[0]?.ja).toBe("フランス");
    expect(searchOriginCountries("USA")[0]?.ja).toBe("アメリカ合衆国");
    expect(searchOriginCountries("米国")[0]?.ja).toBe("アメリカ合衆国");
    expect(searchOriginCountries("zealand")[0]?.ja).toBe("ニュージーランド");
  });

  it("上限で切る", () => {
    expect(searchOriginCountries("a", 3)).toHaveLength(3);
  });
});

describe("FREQUENT_ORIGIN_COUNTRIES_JA", () => {
  it("すべて実在国の日本語名で重複がない", () => {
    expect(new Set(FREQUENT_ORIGIN_COUNTRIES_JA).size).toBe(FREQUENT_ORIGIN_COUNTRIES_JA.length);
    for (const name of FREQUENT_ORIGIN_COUNTRIES_JA) {
      expect(isAllowedOriginJa(name)).toBe(true);
    }
  });
});

describe("ORIGIN_COUNTRIES", () => {
  it("国連加盟193とバチカン・パレスチナ・台湾を含み地域は除く", () => {
    expect(ORIGIN_COUNTRIES).toHaveLength(196);
    const codes = ORIGIN_COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(196);
    expect(codes).toEqual(expect.arrayContaining(["JP", "FR", "VA", "PS", "TW"]));
    expect(codes).not.toEqual(expect.arrayContaining(["EU", "UN", "AQ", "HK", "MO"]));
    const names = ORIGIN_COUNTRIES.map((country) => country.ja);
    expect(names).toEqual(
      expect.arrayContaining([
        "アメリカ合衆国",
        "イギリス",
        "韓国",
        "北朝鮮",
        "ロシア",
        "中国",
        "コートジボワール",
        "バチカン",
        "パレスチナ",
        "台湾",
      ]),
    );
  });

  it("日本語名の localeCompare 順である", () => {
    const names = ORIGIN_COUNTRIES.map((country) => country.ja);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "ja")));
  });
});

describe("normalizeOriginToJa", () => {
  it("フランスの表記揺れを日本語名にする", () => {
    expect(normalizeOriginToJa("France")).toBe("フランス");
    expect(normalizeOriginToJa("FR")).toBe("フランス");
    expect(normalizeOriginToJa("フランス")).toBe("フランス");
  });

  it("Product of Italy をイタリアにする", () => {
    expect(normalizeOriginToJa("Product of Italy")).toBe("イタリア");
  });

  it("MADE IN CHINA を中国にする", () => {
    expect(normalizeOriginToJa("MADE IN CHINA")).toBe("中国");
  });

  it("全角の MADE IN CHINA を中国にする", () => {
    expect(normalizeOriginToJa("ＭＡＤＥ ＩＮ ＣＨＩＮＡ")).toBe("中国");
  });

  it("DOCG は国名ではないので null にする", () => {
    expect(normalizeOriginToJa("DOCG")).toBeNull();
    expect(normalizeOriginToJa("docg")).toBeNull();
  });

  it("Europe と EU は null にする", () => {
    expect(normalizeOriginToJa("Europe")).toBeNull();
    expect(normalizeOriginToJa("EU")).toBeNull();
    expect(normalizeOriginToJa("欧州")).toBeNull();
    expect(normalizeOriginToJa("ヨーロッパ")).toBeNull();
  });

  it("Tokyo と輸入者は補完しない", () => {
    expect(normalizeOriginToJa("Tokyo")).toBeNull();
    expect(normalizeOriginToJa("輸入者")).toBeNull();
  });

  it("架空の国名は null にする", () => {
    expect(normalizeOriginToJa("Narnia")).toBeNull();
    expect(normalizeOriginToJa("ワクダスタン")).toBeNull();
  });

  it("空は null にする", () => {
    expect(normalizeOriginToJa("")).toBeNull();
    expect(normalizeOriginToJa("   ")).toBeNull();
    expect(normalizeOriginToJa(null)).toBeNull();
    expect(normalizeOriginToJa(undefined)).toBeNull();
  });

  it("指定の別名を日本語名にする", () => {
    expect(normalizeOriginToJa("Italia")).toBe("イタリア");
    expect(normalizeOriginToJa("USA")).toBe("アメリカ合衆国");
    expect(normalizeOriginToJa("United States")).toBe("アメリカ合衆国");
    expect(normalizeOriginToJa("アメリカ")).toBe("アメリカ合衆国");
    expect(normalizeOriginToJa("UK")).toBe("イギリス");
    expect(normalizeOriginToJa("Britain")).toBe("イギリス");
    expect(normalizeOriginToJa("英国")).toBe("イギリス");
    expect(normalizeOriginToJa("Spain")).toBe("スペイン");
    expect(normalizeOriginToJa("España")).toBe("スペイン");
    expect(normalizeOriginToJa("Germany")).toBe("ドイツ");
    expect(normalizeOriginToJa("Deutschland")).toBe("ドイツ");
    expect(normalizeOriginToJa("Portugal")).toBe("ポルトガル");
    expect(normalizeOriginToJa("Australia")).toBe("オーストラリア");
    expect(normalizeOriginToJa("New Zealand")).toBe("ニュージーランド");
    expect(normalizeOriginToJa("Chile")).toBe("チリ");
    expect(normalizeOriginToJa("Argentina")).toBe("アルゼンチン");
    expect(normalizeOriginToJa("South Africa")).toBe("南アフリカ");
    expect(normalizeOriginToJa("Japan")).toBe("日本");
    expect(normalizeOriginToJa("JAPAN")).toBe("日本");
  });

  it("接頭辞を除いて国名にする", () => {
    expect(normalizeOriginToJa("produce of France")).toBe("フランス");
    expect(normalizeOriginToJa("wine of Portugal")).toBe("ポルトガル");
    expect(normalizeOriginToJa("produit de France")).toBe("フランス");
    expect(normalizeOriginToJa("producto de España")).toBe("スペイン");
    expect(normalizeOriginToJa("原産国: スペイン")).toBe("スペイン");
    expect(normalizeOriginToJa("生産国：日本")).toBe("日本");
    expect(normalizeOriginToJa("産地 チリ")).toBe("チリ");
  });

  it("複数の国が含まれると null にする", () => {
    expect(normalizeOriginToJa("France Italy")).toBeNull();
    expect(normalizeOriginToJa("FR IT")).toBeNull();
    expect(normalizeOriginToJa("フランスとイタリア")).toBeNull();
  });

  it("産地名は国へ対応しない", () => {
    expect(normalizeOriginToJa("Barolo")).toBeNull();
    expect(normalizeOriginToJa("Bordeaux")).toBeNull();
    expect(normalizeOriginToJa("シチリア")).toBeNull();
  });

  it("短いコードを単語の一部としては照合しない", () => {
    expect(normalizeOriginToJa("AFRICA")).toBeNull();
    expect(normalizeOriginToJa("CHINA")).toBe("中国");
    expect(normalizeOriginToJa("FRANCE")).toBe("フランス");
    expect(normalizeOriginToJa("Papua New Guinea")).toBe("パプアニューギニア");
    expect(normalizeOriginToJa("South Sudan")).toBe("南スーダン");
  });
});

describe("isAllowedOriginJa", () => {
  it("許可された日本語名だけを真にする", () => {
    expect(isAllowedOriginJa("フランス")).toBe(true);
    expect(isAllowedOriginJa("シチリア")).toBe(false);
    expect(isAllowedOriginJa("DOCG")).toBe(false);
  });
});

describe("resolveWritableOrigin", () => {
  it("未指定は omit、空は clear にする", () => {
    expect(resolveWritableOrigin(undefined, "フランス")).toEqual({ status: "omit" });
    expect(resolveWritableOrigin(null, "フランス")).toEqual({ status: "clear" });
    expect(resolveWritableOrigin("", "フランス")).toEqual({ status: "clear" });
    expect(resolveWritableOrigin("  ", "フランス")).toEqual({ status: "clear" });
  });

  it("正規化できる国名は ok にする", () => {
    expect(resolveWritableOrigin("France", "DOCG")).toEqual({ status: "ok", value: "フランス" });
    expect(resolveWritableOrigin("フランス")).toEqual({ status: "ok", value: "フランス" });
  });

  it("現行の不正値 DOCG はそのまま keep にする", () => {
    expect(resolveWritableOrigin("DOCG", "DOCG")).toEqual({ status: "keep", value: "DOCG" });
    expect(resolveWritableOrigin("docg", "DOCG")).toEqual({ status: "keep", value: "DOCG" });
  });

  it("現行と違う不正値は invalid にする", () => {
    expect(resolveWritableOrigin("シチリア", "DOCG")).toEqual({ status: "invalid" });
    expect(resolveWritableOrigin("IGT", "DOCG")).toEqual({ status: "invalid" });
    expect(resolveWritableOrigin("DOCG")).toEqual({ status: "invalid" });
  });
});

describe("japaneseOriginNames", () => {
  it("日本語名の一覧を返す", () => {
    const names = japaneseOriginNames();
    expect(names).toHaveLength(ORIGIN_COUNTRIES.length);
    expect(names).toContain("フランス");
    expect(names).not.toContain("シチリア");
  });
});
