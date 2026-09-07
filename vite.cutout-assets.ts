import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const MODEL_FILE = "u2netp.onnx";
const MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx";
const WASM_FILES = ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"] as const;

export function cutoutAssets(): Plugin {
  return {
    name: "cutout-assets",
    async buildStart() {
      await ensureCutoutAssets();
    },
    async configureServer() {
      await ensureCutoutAssets();
    },
  };
}

async function ensureCutoutAssets(): Promise<void> {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const modelsDir = join(root, "public/models");
  const ortDir = join(modelsDir, "ort");
  mkdirSync(ortDir, { recursive: true });

  const ortDist = join(root, "node_modules/onnxruntime-web/dist");
  for (const file of WASM_FILES) {
    const dest = join(ortDir, file);
    if (!existsSync(dest)) {
      copyFileSync(join(ortDist, file), dest);
    }
  }

  const modelDest = join(modelsDir, MODEL_FILE);
  if (existsSync(modelDest)) {
    return;
  }
  const response = await fetch(MODEL_URL, {
    redirect: "follow",
    headers: { "User-Agent": "alco-app-cutout-assets" },
  });
  if (!response.ok) {
    throw new Error(`u2netp.onnx の取得に失敗しました (${response.status})`);
  }
  await writeFile(modelDest, Buffer.from(await response.arrayBuffer()));
}
