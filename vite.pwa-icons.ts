import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { Plugin } from "vite";
import { buildPwaIconSvg } from "./src/client/lib/pwa-icon.ts";
import { PWA_ICON_BACKGROUND, PWA_ICON_DIR, PWA_ICON_FILES } from "./src/shared/pwa.ts";

const root = fileURLToPath(new URL(".", import.meta.url));
const mascotPath = join(root, "spec/assets/character/mascot-default.svg");

export function pwaIconOutputDir(projectRoot = root): string {
  return join(projectRoot, "public", PWA_ICON_DIR);
}

export async function generatePwaIcons(outDir = pwaIconOutputDir()): Promise<void> {
  const svg = buildPwaIconSvg(readFileSync(mascotPath, "utf8"));
  const source = Buffer.from(svg);
  mkdirSync(outDir, { recursive: true });

  const [r, g, b] = hexToRgb(PWA_ICON_BACKGROUND);
  await Promise.all([
    sharp(source)
      .resize(192, 192)
      .png()
      .toFile(join(outDir, basename(PWA_ICON_FILES.any192))),
    sharp(source)
      .resize(512, 512)
      .png()
      .toFile(join(outDir, basename(PWA_ICON_FILES.any512))),
    sharp(source)
      .resize(180, 180)
      .png()
      .toFile(join(outDir, basename(PWA_ICON_FILES.appleTouch))),
    // ソース既にセーフゾーン内。maskable は同絵を primary 地のまま出す
    sharp(source)
      .resize(512, 512)
      .flatten({ background: { r, g, b } })
      .png()
      .toFile(join(outDir, basename(PWA_ICON_FILES.maskable512))),
  ]);
}

export function pwaIcons(): Plugin {
  return {
    name: "pwa-icons",
    async buildStart() {
      await generatePwaIcons();
    },
    async configureServer() {
      await generatePwaIcons();
    },
  };
}

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
