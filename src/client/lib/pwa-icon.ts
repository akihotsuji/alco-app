import {
  PWA_ICON_BACKGROUND,
  PWA_ICON_LINE,
  PWA_ICON_MASCOT_HEIGHT_RATIO,
  PWA_ICON_SIZE,
} from "@/shared/pwa.ts";

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
 * 通常ポーズを primary 正方形に載せたアイコン SVG を作る。
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
