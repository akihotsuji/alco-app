import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { LIGHT_COLOR_TOKENS } from "@/client/lib/design-tokens.ts";
import { PWA_ICON_BACKGROUND, PWA_ICON_FILES } from "@/shared/pwa.ts";
import { generatePwaIcons } from "../../../vite.pwa-icons.ts";

function basename(relativePath: string): string {
  return relativePath.slice(relativePath.lastIndexOf("/") + 1);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function isNear(
  pixel: [number, number, number],
  target: [number, number, number],
  tolerance: number,
): boolean {
  return (
    Math.abs(pixel[0] - target[0]) <= tolerance &&
    Math.abs(pixel[1] - target[1]) <= tolerance &&
    Math.abs(pixel[2] - target[2]) <= tolerance
  );
}

function hasNearColor(
  data: Buffer,
  channels: number,
  target: [number, number, number],
  tolerance: number,
): boolean {
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r === undefined || g === undefined || b === undefined) {
      continue;
    }
    if (isNear([r, g, b], target, tolerance)) {
      return true;
    }
  }
  return false;
}

describe("generatePwaIcons", () => {
  it("192 / 512 / maskable / Apple touch の PNG を書く", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "alco-pwa-icons-"));
    await generatePwaIcons(outDir);
    const names = [
      PWA_ICON_FILES.any192,
      PWA_ICON_FILES.any512,
      PWA_ICON_FILES.maskable512,
      PWA_ICON_FILES.appleTouch,
    ].map(basename);
    for (const name of names) {
      const bytes = await readFile(join(outDir, name));
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.byteLength).toBeGreaterThan(1000);
    }
  });

  it("512 の角はクリーム地で、キャラのワイン色が残る", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "alco-pwa-icons-color-"));
    await generatePwaIcons(outDir);
    const { data, info } = await sharp(join(outDir, basename(PWA_ICON_FILES.any512)))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const cream = hexToRgb(PWA_ICON_BACKGROUND);
    const primary = hexToRgb(LIGHT_COLOR_TOKENS["--primary"]);
    const wine = hexToRgb(LIGHT_COLOR_TOKENS["--mascot-wine"]);
    const corner: [number, number, number] = [data[0] ?? -1, data[1] ?? -1, data[2] ?? -1];
    expect(info.channels).toBeGreaterThanOrEqual(3);
    expect(isNear(corner, cream, 2)).toBe(true);
    expect(isNear(corner, primary, 8)).toBe(false);
    expect(hasNearColor(data, info.channels, wine, 10)).toBe(true);
  });
});
