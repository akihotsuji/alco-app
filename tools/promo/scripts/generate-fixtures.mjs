/**
 * デモ用ボトル／グラス写真を JPEG 化する。
 * 既定の入力は環境の生成画像。無い場合は SVG の架空ボトルを描いて埋め、再実行可能にする。
 */
import { createRequire } from "node:module";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const promoRoot = path.resolve(here, "..");
const workspaceRoot = path.resolve(promoRoot, "../..");
const outDir = path.join(promoRoot, "public/fixtures");
const sharp = createRequire(path.join(workspaceRoot, "package.json"))("sharp");

const SOURCE_CANDIDATES = [
  process.env.PROMO_FIXTURE_SOURCE,
  "/opt/cursor/artifacts/assets",
  path.join(promoRoot, "source-photos"),
].filter(Boolean);

const TARGETS = [
  { name: "bottle-red.jpg", sources: ["bottle-red.png", "bottle-red.jpg"], kind: "bottle", wine: "#5a1d24" },
  { name: "bottle-white.jpg", sources: ["bottle-white.png", "bottle-white.jpg"], kind: "bottle", wine: "#d9c57a" },
  { name: "bottle-whisky.jpg", sources: ["bottle-whisky.png", "bottle-whisky.jpg"], kind: "bottle", wine: "#8a4a1a" },
  { name: "bottle-sake.jpg", sources: ["bottle-sake.png", "bottle-sake.jpg"], kind: "bottle", wine: "#f3efe4" },
  { name: "bottle-sparkling.jpg", sources: ["bottle-sparkling.png", "bottle-sparkling.jpg"], kind: "bottle", wine: "#c5d6a8" },
  { name: "bottle-orange.jpg", sources: ["bottle-orange.png", "bottle-orange.jpg"], kind: "bottle", wine: "#c56a2d" },
  { name: "glass-red.jpg", sources: ["glass-red.png", "glass-red.jpg"], kind: "glass", wine: "#7a3538" },
  { name: "glass-whisky.jpg", sources: ["glass-whisky.png", "glass-whisky.jpg"], kind: "glass", wine: "#b56a2a" },
  { name: "glass-sake.jpg", sources: ["glass-sake.png", "glass-sake.jpg"], kind: "glass", wine: "#f4efe4" },
];

const PHOTO_MAX_BYTES = 1_048_576;

function fallbackSvg(kind, wine) {
  if (kind === "glass") {
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
      <rect width="800" height="1000" fill="#E6E0D6"/>
      <ellipse cx="400" cy="860" rx="90" ry="18" fill="none" stroke="#2B261F" stroke-width="8"/>
      <rect x="388" y="620" width="24" height="230" rx="10" fill="none" stroke="#2B261F" stroke-width="8"/>
      <path d="M250 180 C250 480 310 620 400 620 C490 620 550 480 550 180 Z" fill="#fff" fill-opacity="0.35" stroke="#2B261F" stroke-width="8"/>
      <path d="M262 360 C300 340 500 340 538 360 V610 H262 Z" fill="${wine}"/>
    </svg>`);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
    <rect width="800" height="1200" fill="#E6E0D6"/>
    <rect x="330" y="80" width="140" height="90" rx="16" fill="#2B261F"/>
    <rect x="250" y="170" width="300" height="860" rx="90" fill="${wine}"/>
    <rect x="250" y="170" width="300" height="860" rx="90" fill="none" stroke="#2B261F" stroke-width="8"/>
    <rect x="300" y="430" width="200" height="280" rx="8" fill="#F4EDE4"/>
    <rect x="320" y="460" width="160" height="12" fill="#7A3538"/>
    <rect x="340" y="500" width="120" height="8" fill="#5C564C"/>
    <rect x="350" y="530" width="100" height="8" fill="#5C564C"/>
  </svg>`);
}

async function findSource(fileNames) {
  for (const dir of SOURCE_CANDIDATES) {
    try {
      const entries = await readdir(dir);
      for (const name of fileNames) {
        if (entries.includes(name)) {
          return path.join(dir, name);
        }
      }
    } catch {
      // 入力ディレクトリが無い場合は次へ
    }
  }
  return null;
}

async function encodeJpeg(input, dest, kind) {
  const width = 800;
  const height = kind === "bottle" ? 1200 : 1000;
  let quality = 82;
  let buffer = await sharp(input)
    .rotate()
    .resize(width, height, { fit: "cover", position: "centre" })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  while (buffer.length > PHOTO_MAX_BYTES && quality > 50) {
    quality -= 6;
    buffer = await sharp(input)
      .rotate()
      .resize(width, height, { fit: "cover", position: "centre" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }
  if (buffer.length > PHOTO_MAX_BYTES) {
    throw new Error(`${dest} が ${buffer.length} bytes で上限超過`);
  }
  await sharp(buffer).toFile(dest);
  return { bytes: buffer.length, quality };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const results = [];
  for (const target of TARGETS) {
    const source = await findSource(target.sources);
    const input = source ?? fallbackSvg(target.kind, target.wine);
    const dest = path.join(outDir, target.name);
    const info = await encodeJpeg(input, dest, target.kind);
    results.push({
      name: target.name,
      source: source ? path.relative(workspaceRoot, source) : "svg-fallback",
      ...info,
    });
  }
  console.log(JSON.stringify({ outDir, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
