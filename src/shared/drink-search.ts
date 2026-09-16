import { DRINK_TYPE_LABELS, type DrinkType, isWineFamily } from "./constants.ts";
import { vintageSchema } from "./identity.ts";

/**
 * セラー・記録・ノートの品名から Google 検索 URL を作る。
 * 正本: spec/features/drink-search.md
 */

export const DRINK_SEARCH_LABEL = "Googleで調べる";
export const GOOGLE_SEARCH_HREF_BASE = "https://www.google.com/search";

const PLACEHOLDER_NAMES = new Set(
  ["不明", "未入力", "unknown", "n/a", "（品名未入力）", "解析中", "解析中…", "解析中..."].map(
    normalizeCompareKey,
  ),
);

const GENERIC_DRINK_NAMES = new Set(
  [
    "シャルドネ",
    "Chardonnay",
    "ピノ・ノワール",
    "ピノノワール",
    "Pinot Noir",
    "カベルネ・ソーヴィニヨン",
    "カベルネソーヴィニヨン",
    "Cabernet Sauvignon",
    "メルロー",
    "Merlot",
    "ソーヴィニヨン・ブラン",
    "ソーヴィニヨンブラン",
    "Sauvignon Blanc",
    "純米",
    "純米酒",
    "純米吟醸",
    "純米大吟醸",
    "吟醸",
    "大吟醸",
    "本醸造",
  ].map(normalizeCompareKey),
);

export type DrinkSearchFields = {
  name?: string | null;
  producer?: string | null;
  vintage?: string | number | null;
  drinkType?: string | null;
};

/** 検索用コピーだけ。保存値は変えない */
export function collapseSearchWhitespace(value: string): string {
  return value.replace(/[\t\n\r\f\v ]+/g, " ").trim();
}

function normalizeCompareKey(value: string): string {
  return collapseSearchWhitespace(value).normalize("NFKC").toLowerCase();
}

function asSearchText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const collapsed = collapseSearchWhitespace(value);
  return collapsed.length === 0 ? null : collapsed;
}

function isPlaceholderValue(value: string): boolean {
  return PLACEHOLDER_NAMES.has(normalizeCompareKey(value));
}

export function parseSearchVintage(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return vintageSchema.safeParse(value).success ? value : null;
  }
  const text = asSearchText(value);
  if (!text || !/^\d{4}$/.test(text)) {
    return null;
  }
  const year = Number(text);
  return vintageSchema.safeParse(year).success ? year : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function usesLatinWordBoundary(value: string): boolean {
  return (
    /\p{Script=Latin}/u.test(value) &&
    !/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value)
  );
}

function nameContainsProducer(name: string, producer: string): boolean {
  const haystack = normalizeCompareKey(name);
  const needle = normalizeCompareKey(producer);
  if (needle.length === 0) {
    return false;
  }
  if (usesLatinWordBoundary(needle)) {
    const pattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}(?:$|[^\\p{L}\\p{N}])`,
      "u",
    );
    return pattern.test(haystack);
  }
  return haystack.includes(needle);
}

function nameContainsVintage(name: string, year: number): boolean {
  return new RegExp(`(?<!\\d)${year}(?!\\d)`).test(normalizeCompareKey(name));
}

function drinkTypeSearchLabel(drinkType: string | null | undefined): string | null {
  if (!drinkType || drinkType === "other") {
    return null;
  }
  if (isWineFamily(drinkType)) {
    return "ワイン";
  }
  if ((Object.keys(DRINK_TYPE_LABELS) as DrinkType[]).includes(drinkType as DrinkType)) {
    return DRINK_TYPE_LABELS[drinkType as DrinkType];
  }
  return null;
}

function isGenericDrinkName(name: string): boolean {
  return GENERIC_DRINK_NAMES.has(normalizeCompareKey(name));
}

export function buildDrinkSearchQuery(fields: DrinkSearchFields): string | null {
  const name = asSearchText(fields.name);
  if (!name || isPlaceholderValue(name)) {
    return null;
  }

  const parts: string[] = [];
  const producer = asSearchText(fields.producer);
  const usableProducer = producer && !isPlaceholderValue(producer) ? producer : null;
  if (usableProducer && !nameContainsProducer(name, usableProducer)) {
    parts.push(usableProducer);
  }
  parts.push(name);

  const vintage = parseSearchVintage(fields.vintage);
  const drinkType = fields.drinkType?.trim() || null;
  if (
    vintage !== null &&
    drinkType !== null &&
    isWineFamily(drinkType) &&
    !nameContainsVintage(name, vintage)
  ) {
    parts.push(String(vintage));
  }

  if (!usableProducer && isGenericDrinkName(name)) {
    const typeLabel = drinkTypeSearchLabel(drinkType);
    if (typeLabel && !normalizeCompareKey(name).includes(normalizeCompareKey(typeLabel))) {
      parts.push(typeLabel);
    }
  }

  return parts.join(" ");
}

export function googleDrinkSearchUrl(query: string): string {
  const url = new URL(GOOGLE_SEARCH_HREF_BASE);
  url.searchParams.set("q", query);
  return url.href;
}

export function isSafeGoogleSearchHref(href: string): boolean {
  try {
    const url = new URL(href);
    return (
      url.protocol === "https:" && url.hostname === "www.google.com" && url.pathname === "/search"
    );
  } catch {
    return false;
  }
}

export function drinkSearchHref(fields: DrinkSearchFields): string | null {
  const query = buildDrinkSearchQuery(fields);
  if (!query) {
    return null;
  }
  const href = googleDrinkSearchUrl(query);
  return isSafeGoogleSearchHref(href) ? href : null;
}

export function drinkSearchAriaLabel(name: string): string {
  return `Googleで『${collapseSearchWhitespace(name)}』を検索（新しいタブまたは外部ブラウザで開きます）`;
}
