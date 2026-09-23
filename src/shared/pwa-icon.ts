import {
  PWA_ICON_BACKGROUND,
  PWA_ICON_LINE,
  PWA_ICON_MASCOT_HEIGHT_RATIO,
  PWA_ICON_SIZE,
  PWA_SHORTCUT_ICON_ACCENT,
  PWA_SHORTCUT_ICON_CIRCLE_RATIO,
  PWA_SHORTCUT_ICON_GLYPH,
  PWA_SHORTCUT_ICON_SIZE,
} from "./pwa.ts";

/** lucide Plus の 24 グリッドを円の直径の 58% 角に収める */
const SHORTCUT_GLYPH_RATIO = 0.58;
const LUCIDE_GRID = 24;

export type PwaIconSvgOptions = {
  background?: string;
  line?: string;
  size?: number;
  mascotHeightRatio?: number;
};

export function extractSvgInner(svg: string): { viewBox: string; inner: string } {
  const viewBox = svg.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) {
    throw new Error("mascot SVG に viewBox がありません");
  }
  const inner = svg
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
  if (!inner) {
    throw new Error("mascot SVG の中身が空です");
  }
  return { viewBox, inner };
}

/**
 * 通常ポーズをクリーム正方形に載せたアイコン SVG を作る。
 * 角丸はソースに焼き込まない（OS がマスクする）。
 */
export function buildPwaIconSvg(mascotSvg: string, options: PwaIconSvgOptions = {}): string {
  const background = options.background ?? PWA_ICON_BACKGROUND;
  const line = options.line ?? PWA_ICON_LINE;
  const size = options.size ?? PWA_ICON_SIZE;
  const ratio = options.mascotHeightRatio ?? PWA_ICON_MASCOT_HEIGHT_RATIO;
  const { viewBox, inner } = extractSvgInner(mascotSvg);
  const parts = viewBox.split(/\s+/).map(Number);
  const vbWidth = parts[2];
  const vbHeight = parts[3];
  if (
    parts.length !== 4 ||
    parts.some((value) => !Number.isFinite(value)) ||
    !vbWidth ||
    !vbHeight
  ) {
    throw new Error("mascot SVG の viewBox が不正です");
  }
  const height = size * ratio;
  const width = height * (vbWidth / vbHeight);
  const x = (size - width) / 2;
  const y = (size - height) / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${background}"/>
  <svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" color="${line}">
    ${inner}
  </svg>
</svg>
`;
}

/**
 * 「飲酒を記録」ショートカットのアイコン SVG。中央タブ（primary の円 + Plus）を写す。
 * キャラは載せずアプリアイコンと区別する。
 */
export function buildPwaShortcutIconSvg(size = PWA_SHORTCUT_ICON_SIZE): string {
  const center = size / 2;
  const radius = (size * PWA_SHORTCUT_ICON_CIRCLE_RATIO) / 2;
  const glyph = radius * 2 * SHORTCUT_GLYPH_RATIO;
  const offset = center - glyph / 2;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="${PWA_ICON_BACKGROUND}"/>
  <circle cx="${center}" cy="${center}" r="${radius}" fill="${PWA_SHORTCUT_ICON_ACCENT}"/>
  <svg x="${offset}" y="${offset}" width="${glyph}" height="${glyph}" viewBox="0 0 ${LUCIDE_GRID} ${LUCIDE_GRID}" fill="none" stroke="${PWA_SHORTCUT_ICON_GLYPH}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 12h14"/>
    <path d="M12 5v14"/>
  </svg>
</svg>
`;
}
