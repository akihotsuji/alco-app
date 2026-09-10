/**
 * ISO 3166-1 + 日本語は外務省表記に準拠。
 * 版: 2026-09。更新は ORIGIN_COUNTRIES を差し替え。
 */

export type OriginCountry = { code: string; ja: string };

type CountrySeed = readonly [code: string, ja: string, ...aliases: string[]];

const COUNTRY_SEEDS: readonly CountrySeed[] = [
  ["IS", "アイスランド", "Iceland"],
  ["IE", "アイルランド", "Ireland"],
  ["AZ", "アゼルバイジャン", "Azerbaijan"],
  ["AF", "アフガニスタン", "Afghanistan"],
  [
    "US",
    "アメリカ合衆国",
    "United States",
    "USA",
    "United States of America",
    "America",
    "アメリカ",
    "米国",
  ],
  ["AE", "アラブ首長国連邦", "United Arab Emirates", "UAE"],
  ["DZ", "アルジェリア", "Algeria"],
  ["AR", "アルゼンチン", "Argentina"],
  ["AL", "アルバニア", "Albania"],
  ["AM", "アルメニア", "Armenia"],
  ["AO", "アンゴラ", "Angola"],
  ["AG", "アンティグア・バーブーダ", "Antigua & Barbuda", "Antigua and Barbuda"],
  ["AD", "アンドラ", "Andorra"],
  ["YE", "イエメン", "Yemen"],
  ["GB", "イギリス", "United Kingdom", "UK", "Britain", "Great Britain", "英国"],
  ["IL", "イスラエル", "Israel"],
  ["IT", "イタリア", "Italy", "Italia"],
  ["IQ", "イラク", "Iraq"],
  ["IR", "イラン", "Iran"],
  ["IN", "インド", "India"],
  ["ID", "インドネシア", "Indonesia"],
  ["UG", "ウガンダ", "Uganda"],
  ["UA", "ウクライナ", "Ukraine"],
  ["UZ", "ウズベキスタン", "Uzbekistan"],
  ["UY", "ウルグアイ", "Uruguay"],
  ["EC", "エクアドル", "Ecuador"],
  ["EG", "エジプト", "Egypt"],
  ["EE", "エストニア", "Estonia"],
  ["SZ", "エスワティニ", "Eswatini"],
  ["ET", "エチオピア", "Ethiopia"],
  ["ER", "エリトリア", "Eritrea"],
  ["SV", "エルサルバドル", "El Salvador"],
  ["AU", "オーストラリア", "Australia"],
  ["AT", "オーストリア", "Austria"],
  ["OM", "オマーン", "Oman"],
  ["NL", "オランダ", "Netherlands", "Holland"],
  ["GH", "ガーナ", "Ghana"],
  ["CV", "カーボベルデ", "Cape Verde", "Cabo Verde"],
  ["GY", "ガイアナ", "Guyana"],
  ["KZ", "カザフスタン", "Kazakhstan"],
  ["QA", "カタール", "Qatar"],
  ["CA", "カナダ", "Canada"],
  ["GA", "ガボン", "Gabon"],
  ["CM", "カメルーン", "Cameroon"],
  ["GM", "ガンビア", "Gambia"],
  ["KH", "カンボジア", "Cambodia"],
  ["GN", "ギニア", "Guinea"],
  ["GW", "ギニアビサウ", "Guinea-Bissau"],
  ["CY", "キプロス", "Cyprus"],
  ["CU", "キューバ", "Cuba"],
  ["GR", "ギリシャ", "Greece"],
  ["KI", "キリバス", "Kiribati"],
  ["KG", "キルギス", "Kyrgyzstan"],
  ["GT", "グアテマラ", "Guatemala"],
  ["KW", "クウェート", "Kuwait"],
  ["GD", "グレナダ", "Grenada"],
  ["HR", "クロアチア", "Croatia"],
  ["KE", "ケニア", "Kenya"],
  ["CI", "コートジボワール", "Côte d’Ivoire", "Cote d'Ivoire", "Ivory Coast"],
  ["CR", "コスタリカ", "Costa Rica"],
  ["KM", "コモロ", "Comoros"],
  ["CO", "コロンビア", "Colombia"],
  ["CG", "コンゴ共和国", "Congo - Brazzaville", "Republic of the Congo", "Congo-Brazzaville"],
  [
    "CD",
    "コンゴ民主共和国",
    "Congo - Kinshasa",
    "DRC",
    "DR Congo",
    "Democratic Republic of the Congo",
    "Congo-Kinshasa",
  ],
  ["SA", "サウジアラビア", "Saudi Arabia"],
  ["WS", "サモア", "Samoa"],
  ["ST", "サントメ・プリンシペ", "São Tomé & Príncipe", "Sao Tome and Principe"],
  ["ZM", "ザンビア", "Zambia"],
  ["SM", "サンマリノ", "San Marino"],
  ["SL", "シエラレオネ", "Sierra Leone"],
  ["DJ", "ジブチ", "Djibouti"],
  ["JM", "ジャマイカ", "Jamaica"],
  ["GE", "ジョージア", "Georgia"],
  ["SY", "シリア", "Syria"],
  ["SG", "シンガポール", "Singapore"],
  ["ZW", "ジンバブエ", "Zimbabwe"],
  ["CH", "スイス", "Switzerland"],
  ["SE", "スウェーデン", "Sweden"],
  ["SD", "スーダン", "Sudan"],
  ["ES", "スペイン", "Spain", "España", "Espana"],
  ["SR", "スリナム", "Suriname"],
  ["LK", "スリランカ", "Sri Lanka"],
  ["SK", "スロバキア", "Slovakia"],
  ["SI", "スロベニア", "Slovenia"],
  ["SC", "セーシェル", "Seychelles"],
  ["SN", "セネガル", "Senegal"],
  ["RS", "セルビア", "Serbia"],
  [
    "KN",
    "セントクリストファー・ネービス",
    "St. Kitts & Nevis",
    "Saint Kitts and Nevis",
    "St Kitts and Nevis",
    "セントクリストファー・ネーヴィス",
  ],
  [
    "VC",
    "セントビンセント及びグレナディーン諸島",
    "St. Vincent & Grenadines",
    "Saint Vincent and the Grenadines",
    "St Vincent and the Grenadines",
  ],
  ["LC", "セントルシア", "St. Lucia", "Saint Lucia", "St Lucia"],
  ["SO", "ソマリア", "Somalia"],
  ["SB", "ソロモン諸島", "Solomon Islands"],
  ["TH", "タイ", "Thailand"],
  ["TJ", "タジキスタン", "Tajikistan"],
  ["TZ", "タンザニア", "Tanzania"],
  ["CZ", "チェコ", "Czechia", "Czech Republic"],
  ["TD", "チャド", "Chad"],
  ["TN", "チュニジア", "Tunisia"],
  ["CL", "チリ", "Chile"],
  ["TV", "ツバル", "Tuvalu"],
  ["DK", "デンマーク", "Denmark"],
  ["DE", "ドイツ", "Germany", "Deutschland"],
  ["TG", "トーゴ", "Togo"],
  ["DO", "ドミニカ共和国", "Dominican Republic"],
  ["DM", "ドミニカ国", "Dominica"],
  ["TT", "トリニダード・トバゴ", "Trinidad & Tobago", "Trinidad and Tobago"],
  ["TM", "トルクメニスタン", "Turkmenistan"],
  ["TR", "トルコ", "Türkiye", "Turkey", "Turkiye"],
  ["TO", "トンガ", "Tonga"],
  ["NG", "ナイジェリア", "Nigeria"],
  ["NR", "ナウル", "Nauru"],
  ["NA", "ナミビア", "Namibia"],
  ["NI", "ニカラグア", "Nicaragua"],
  ["NE", "ニジェール", "Niger"],
  ["NZ", "ニュージーランド", "New Zealand"],
  ["NP", "ネパール", "Nepal"],
  ["NO", "ノルウェー", "Norway"],
  ["BH", "バーレーン", "Bahrain"],
  ["HT", "ハイチ", "Haiti"],
  ["PK", "パキスタン", "Pakistan"],
  ["VA", "バチカン", "Vatican City", "Vatican", "Holy See", "バチカン市国"],
  ["PA", "パナマ", "Panama"],
  ["VU", "バヌアツ", "Vanuatu"],
  ["BS", "バハマ", "Bahamas"],
  ["PG", "パプアニューギニア", "Papua New Guinea"],
  ["PW", "パラオ", "Palau"],
  ["PY", "パラグアイ", "Paraguay"],
  ["BB", "バルバドス", "Barbados"],
  ["PS", "パレスチナ", "Palestinian Territories", "Palestine", "パレスチナ自治区"],
  ["HU", "ハンガリー", "Hungary"],
  ["BD", "バングラデシュ", "Bangladesh"],
  ["FJ", "フィジー", "Fiji"],
  ["PH", "フィリピン", "Philippines"],
  ["FI", "フィンランド", "Finland"],
  ["BT", "ブータン", "Bhutan"],
  ["BR", "ブラジル", "Brazil", "Brasil"],
  ["FR", "フランス", "France"],
  ["BG", "ブルガリア", "Bulgaria"],
  ["BF", "ブルキナファソ", "Burkina Faso"],
  ["BN", "ブルネイ", "Brunei"],
  ["BI", "ブルンジ", "Burundi"],
  ["VN", "ベトナム", "Vietnam", "Viet Nam"],
  ["BJ", "ベナン", "Benin"],
  ["VE", "ベネズエラ", "Venezuela"],
  ["BY", "ベラルーシ", "Belarus"],
  ["BZ", "ベリーズ", "Belize"],
  ["PE", "ペルー", "Peru"],
  ["BE", "ベルギー", "Belgium"],
  ["PL", "ポーランド", "Poland"],
  ["BA", "ボスニア・ヘルツェゴビナ", "Bosnia & Herzegovina", "Bosnia and Herzegovina"],
  ["BW", "ボツワナ", "Botswana"],
  ["BO", "ボリビア", "Bolivia"],
  ["PT", "ポルトガル", "Portugal"],
  ["HN", "ホンジュラス", "Honduras"],
  ["MH", "マーシャル諸島", "Marshall Islands"],
  ["MG", "マダガスカル", "Madagascar"],
  ["MW", "マラウイ", "Malawi"],
  ["ML", "マリ", "Mali"],
  ["MT", "マルタ", "Malta"],
  ["MY", "マレーシア", "Malaysia"],
  ["FM", "ミクロネシア連邦", "Micronesia"],
  ["MM", "ミャンマー", "Myanmar", "Myanmar (Burma)", "Burma"],
  ["MX", "メキシコ", "Mexico"],
  ["MU", "モーリシャス", "Mauritius"],
  ["MR", "モーリタニア", "Mauritania"],
  ["MZ", "モザンビーク", "Mozambique"],
  ["MC", "モナコ", "Monaco"],
  ["MV", "モルディブ", "Maldives"],
  ["MD", "モルドバ", "Moldova"],
  ["MA", "モロッコ", "Morocco"],
  ["MN", "モンゴル", "Mongolia"],
  ["ME", "モンテネグロ", "Montenegro"],
  ["JO", "ヨルダン", "Jordan"],
  ["LA", "ラオス", "Laos"],
  ["LV", "ラトビア", "Latvia"],
  ["LT", "リトアニア", "Lithuania"],
  ["LY", "リビア", "Libya"],
  ["LI", "リヒテンシュタイン", "Liechtenstein"],
  ["LR", "リベリア", "Liberia"],
  ["RO", "ルーマニア", "Romania"],
  ["LU", "ルクセンブルク", "Luxembourg"],
  ["RW", "ルワンダ", "Rwanda"],
  ["LS", "レソト", "Lesotho"],
  ["LB", "レバノン", "Lebanon"],
  ["RU", "ロシア", "Russia", "Russian Federation", "ロシア連邦"],
  ["KR", "韓国", "South Korea", "Republic of Korea", "大韓民国"],
  ["GQ", "赤道ギニア", "Equatorial Guinea"],
  ["TW", "台湾", "Taiwan"],
  ["CF", "中央アフリカ", "Central African Republic"],
  ["CN", "中国", "China", "PRC", "中華人民共和国"],
  ["TL", "東ティモール", "Timor-Leste", "East Timor"],
  ["ZA", "南アフリカ", "South Africa"],
  ["SS", "南スーダン", "South Sudan"],
  ["JP", "日本", "Japan", "日本国"],
  ["MK", "北マケドニア", "North Macedonia"],
  ["KP", "北朝鮮", "North Korea", "DPRK", "朝鮮民主主義人民共和国"],
];

export const ORIGIN_COUNTRIES: readonly OriginCountry[] = COUNTRY_SEEDS.map(([code, ja]) => ({
  code,
  ja,
}));

export const ORIGIN_MESSAGES = {
  invalid: "実在する国の名前を選んでください",
} as const;

/**
 * 生産国欄の「よく使う国」チップ（spec/screen-designs/03-log.md N8b）。
 * 酒類の主要生産国。順番は表示順。全 200 か国からの選択は検索で行う。
 */
export const FREQUENT_ORIGIN_COUNTRIES_JA: readonly string[] = [
  "日本",
  "フランス",
  "イタリア",
  "スペイン",
  "アメリカ合衆国",
  "ドイツ",
  "チリ",
  "オーストラリア",
  "ニュージーランド",
  "アルゼンチン",
  "ポルトガル",
  "イギリス",
];

export const ORIGIN_SEARCH_LIMIT = 8;

/** ひらがな → カタカナ（IME 変換前の入力でも国名に当てる） */
function hiraganaToKatakana(text: string): string {
  return text.replace(/[\u3041-\u3096]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0x60));
}

type SearchEntry = {
  country: OriginCountry;
  ja: string;
  aliases: readonly string[];
};

const SEARCH_ENTRIES: readonly SearchEntry[] = COUNTRY_SEEDS.map(([code, ja, ...aliases]) => ({
  country: { code, ja },
  ja,
  aliases: aliases.map((alias) => normalizeKey(alias)),
}));

/**
 * 生産国の候補検索。日本語名（ひらがな入力可）と英語別名の前方一致を優先し、部分一致を後ろに置く。
 * 空の問い合わせは空配列（呼び出し側が「よく使う国」を出す）。
 */
export function searchOriginCountries(
  query: string,
  limit: number = ORIGIN_SEARCH_LIMIT,
): OriginCountry[] {
  const raw = query.normalize("NFKC").trim();
  if (raw.length === 0 || limit <= 0) {
    return [];
  }
  const ja = hiraganaToKatakana(raw);
  const key = normalizeKey(raw);
  const ranked: { country: OriginCountry; rank: number; index: number }[] = [];
  SEARCH_ENTRIES.forEach((entry, index) => {
    let rank: number | null = null;
    if (entry.ja === ja) {
      rank = 0;
    } else if (entry.ja.startsWith(ja)) {
      rank = 1;
    } else if (entry.aliases.some((alias) => alias.startsWith(key))) {
      rank = 2;
    } else if (entry.ja.includes(ja)) {
      rank = 3;
    } else if (entry.aliases.some((alias) => alias.includes(key))) {
      rank = 4;
    }
    if (rank !== null) {
      ranked.push({ country: entry.country, rank, index });
    }
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return ranked.slice(0, limit).map((item) => item.country);
}

const ORIGIN_JA_NAMES: readonly string[] = ORIGIN_COUNTRIES.map((country) => country.ja);
const ORIGIN_JA_SET = new Set(ORIGIN_JA_NAMES);
const JA_NAMES_BY_LENGTH = [...ORIGIN_JA_NAMES].sort((a, b) => b.length - a.length);

const ORIGIN_PREFIX =
  /^(?:made\s+in|product\s+of|produce\s+of|wine\s+of|produit\s+de|producto\s+de|原産国|生産国|産地)\s*:?\s*/i;

const BLOCKED_ORIGINS = new Set(
  [
    "DOCG",
    "DOC",
    "DOP",
    "IGT",
    "IGP",
    "AOC",
    "AOP",
    "AVA",
    "EU",
    "Europe",
    "欧州",
    "ヨーロッパ",
    "unknown",
    "不明",
    "N/A",
  ].map((value) => normalizeKey(value)),
);

type TokenHit = { ja: string; start: number; end: number };

const LOOKUP = new Map<string, string>();

for (const [code, ja, ...aliases] of COUNTRY_SEEDS) {
  addLookup(code, ja);
  addLookup(ja, ja);
  for (const alias of aliases) {
    addLookup(alias, ja);
  }
}

function addLookup(alias: string, ja: string): void {
  const key = normalizeKey(alias);
  if (key.length === 0) {
    return;
  }
  const existing = LOOKUP.get(key);
  if (existing !== undefined && existing !== ja) {
    throw new Error(`origin alias conflict: ${alias}`);
  }
  LOOKUP.set(key, ja);
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u201B\u02BC]/g, "'")
    .replace(/&/g, " and ")
    .replace(/[.-]/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isBlockedOrigin(text: string): boolean {
  return BLOCKED_ORIGINS.has(normalizeKey(text));
}

function stripOriginPrefix(text: string): string {
  return text.replace(ORIGIN_PREFIX, "");
}

function tokenize(text: string): string[] {
  return text
    .replaceAll("または", " ")
    .replace(/[とや]/g, " ")
    .split(/[^\p{L}\p{N}']+/u)
    .filter((token) => token.length > 0);
}

function collectTokenHits(tokens: string[]): TokenHit[] {
  const hits: TokenHit[] = [];
  for (let n = tokens.length; n >= 1; n--) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const phrase = tokens.slice(i, i + n).join(" ");
      const ja = LOOKUP.get(normalizeKey(phrase));
      if (ja) {
        hits.push({ ja, start: i, end: i + n });
      }
    }
  }
  hits.sort((a, b) => b.end - b.start - (a.end - a.start));
  const chosen: TokenHit[] = [];
  for (const hit of hits) {
    if (chosen.some((current) => hit.start < current.end && hit.end > current.start)) {
      continue;
    }
    chosen.push(hit);
  }
  return chosen;
}

function collectJapaneseHits(text: string, tokens: readonly string[]): string[] {
  const tokenSet = new Set(tokens);
  const spans: { ja: string; start: number; end: number }[] = [];
  for (const ja of JA_NAMES_BY_LENGTH) {
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(ja, from);
      if (start === -1) {
        break;
      }
      const end = start + ja.length;
      const covered = spans.some((span) => start >= span.start && end <= span.end);
      if (!covered) {
        const shortName = ja.length <= 2;
        if (!shortName || text === ja || tokenSet.has(ja)) {
          spans.push({ ja, start, end });
        }
      }
      from = start + 1;
    }
  }
  return spans.map((span) => span.ja);
}

function findCountries(text: string): Set<string> {
  const tokens = tokenize(text);
  const hits = new Set<string>();
  const whole = LOOKUP.get(normalizeKey(text));
  if (whole) {
    hits.add(whole);
  }
  for (const hit of collectTokenHits(tokens)) {
    hits.add(hit.ja);
  }
  for (const ja of collectJapaneseHits(text, tokens)) {
    hits.add(ja);
  }
  return hits;
}

export function japaneseOriginNames(): readonly string[] {
  return ORIGIN_JA_NAMES;
}

export function isAllowedOriginJa(value: string): boolean {
  return ORIGIN_JA_SET.has(value.normalize("NFKC").trim());
}

export function normalizeOriginToJa(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const text = raw.normalize("NFKC").trim();
  if (text.length === 0 || isBlockedOrigin(text)) {
    return null;
  }
  const stripped = stripOriginPrefix(text).trim();
  if (stripped.length === 0 || isBlockedOrigin(stripped)) {
    return null;
  }
  const countries = findCountries(stripped);
  if (countries.size !== 1) {
    return null;
  }
  const [ja] = countries;
  return ja ?? null;
}

export function resolveWritableOrigin(
  raw: string | null | undefined,
  current?: string | null,
): { status: "omit" | "clear" | "ok" | "keep" | "invalid"; value?: string | null } {
  if (raw === undefined) {
    return { status: "omit" };
  }
  if (raw === null || raw.normalize("NFKC").trim().length === 0) {
    return { status: "clear" };
  }
  const normalized = normalizeOriginToJa(raw);
  if (normalized !== null) {
    return { status: "ok", value: normalized };
  }
  if (
    current !== undefined &&
    current !== null &&
    current.normalize("NFKC").trim().length > 0 &&
    normalizeKey(raw) === normalizeKey(current)
  ) {
    return { status: "keep", value: current };
  }
  return { status: "invalid" };
}
