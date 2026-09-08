/**
 * 生産国・品種はラベルに国名や品種が無くても、ラベルの手がかりから推測する。
 * ユーザー入力は含めない。3 つの Vision プロンプトで共有する。
 */
export const IDENTITY_INFERENCE_PROMPT = [
  "origin is the country of production (e.g. フランス, 日本, イタリア), not a small appellation.",
  "The country name is often missing. Infer it from appellation, region, language, producer, and the typical origin for that brand or style (Bordeaux/Champagne → フランス, Barolo/Chianti → イタリア, Rioja → スペイン, Napa → アメリカ, sake/焼酎 → 日本).",
  "variety is grape, rice, hop, or malt variety. Labels often omit it. Infer the typical variety from appellation, style, or brand (Chianti → Sangiovese, Barolo → Nebbiolo, Champagne → Chardonnay / Pinot Noir / Pinot Meunier, Sancerre → Sauvignon Blanc).",
  "Use lower confidence for inferred origin and variety. Omit a field only when you have no reasonable guess.",
].join(" ");
