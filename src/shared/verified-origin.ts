/**
 * 産地表記 → 生産国の検証済み対応。代表品種や「よくある産地」の推測は含めない。
 * キーは正規化後（小文字・記号除去）。
 */

const VERIFIED_ORIGIN_BY_APPELLATION: Record<string, string> = {
  bordeaux: "フランス",
  champagne: "フランス",
  bourgogne: "フランス",
  burgundy: "フランス",
  alsace: "フランス",
  loire: "フランス",
  rhone: "フランス",
  sancerre: "フランス",
  chablis: "フランス",
  beaujolais: "フランス",
  provence: "フランス",
  cote_de_nuit: "フランス",
  cote_de_beaune: "フランス",
  chateauneuf_du_pape: "フランス",
  barolo: "イタリア",
  barbaresco: "イタリア",
  chianti: "イタリア",
  brunello: "イタリア",
  brunello_di_montalcino: "イタリア",
  prosecco: "イタリア",
  valpolicella: "イタリア",
  soave: "イタリア",
  rioja: "スペイン",
  ribera_del_duero: "スペイン",
  priorat: "スペイン",
  cava: "スペイン",
  napa: "アメリカ",
  napa_valley: "アメリカ",
  sonoma: "アメリカ",
  mosel: "ドイツ",
  rheingau: "ドイツ",
  pfalz: "ドイツ",
  tokaj: "ハンガリー",
  porto: "ポルトガル",
  port: "ポルトガル",
  douro: "ポルトガル",
  vinho_verde: "ポルトガル",
  stellenbosch: "南アフリカ",
  mendoza: "アルゼンチン",
  marlborough: "ニュージーランド",
  barossa: "オーストラリア",
  barossa_valley: "オーストラリア",
  yarra_valley: "オーストラリア",
};

export function normalizeAppellationKey(raw: string): string {
  return raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[àáâä]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/ñ/g, "n")
    .replace(/ô/g, "o")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** 産地表記から検証済みの生産国だけを返す。未知・曖昧は null */
export function countryFromVerifiedAppellation(raw: string): string | null {
  const key = normalizeAppellationKey(raw);
  if (!key) {
    return null;
  }
  return VERIFIED_ORIGIN_BY_APPELLATION[key] ?? null;
}
