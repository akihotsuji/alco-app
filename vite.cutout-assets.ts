import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import {
  PHOTO_CUTOUT_MODEL_BYTES,
  PHOTO_CUTOUT_MODEL_SHA256,
  PHOTO_CUTOUT_ORT_MJS_FILE,
  PHOTO_CUTOUT_ORT_WASM_FILE,
} from "./src/shared/constants.ts";

const MODEL_FILE = "u2netp.onnx";
const MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx";
const WASM_FILES = [PHOTO_CUTOUT_ORT_WASM_FILE, PHOTO_CUTOUT_ORT_MJS_FILE] as const;

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
    copyFileSync(join(ortDist, file), join(ortDir, file));
  }

  const modelDest = join(modelsDir, MODEL_FILE);
  if (isValidModelFile(modelDest)) {
    return;
  }
  const response = await fetch(MODEL_URL, {
    redirect: "follow",
    headers: { "User-Agent": "alco-app-cutout-assets" },
  });
  if (!response.ok) {
    throw new Error(`u2netp.onnx の取得に失敗しました (${response.status})`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!isValidModelBytes(bytes)) {
    throw new Error("u2netp.onnx の内容が期待するモデルと一致しません");
  }
  await writeFile(modelDest, bytes);
}

function isValidModelFile(path: string): boolean {
  return existsSync(path) && isValidModelBytes(readFileSync(path));
}

function isValidModelBytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength !== PHOTO_CUTOUT_MODEL_BYTES) {
    return false;
  }
  return createHash("sha256").update(bytes).digest("hex") === PHOTO_CUTOUT_MODEL_SHA256;
}
