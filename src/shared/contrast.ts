/** WCAG 2.2 相対輝度・コントラスト（sRGB）。design-system の本文 4.5:1 を固定する */

export const WCAG_BODY_MIN = 4.5;

export type Srgb = readonly [number, number, number];

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function parseHexColor(hex: string): Srgb {
  const normalized = hex.trim().replace("#", "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(normalized)) {
    throw new Error(`invalid hex color: ${hex}`);
  }
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}

export function relativeLuminance(rgb: Srgb): number {
  const [r, g, b] = rgb;
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

export function contrastRatio(foreground: Srgb, background: Srgb): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function hexContrastRatio(foregroundHex: string, backgroundHex: string): number {
  return contrastRatio(parseHexColor(foregroundHex), parseHexColor(backgroundHex));
}

/** `rgba(r,g,b,a)` を下地 HEX に重ねた結果（水位線 `--fill-tint`） */
export function blendRgbaOverHex(
  overlay: { r: number; g: number; b: number; a: number },
  baseHex: string,
): Srgb {
  const [br, bg, bb] = parseHexColor(baseHex);
  const alpha = overlay.a;
  return [
    Math.round(overlay.r * alpha + br * (1 - alpha)),
    Math.round(overlay.g * alpha + bg * (1 - alpha)),
    Math.round(overlay.b * alpha + bb * (1 - alpha)),
  ];
}

export function contrastMeetsBody(ratio: number): boolean {
  return ratio + Number.EPSILON >= WCAG_BODY_MIN;
}
