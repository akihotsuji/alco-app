import { describe, expect, it } from "vitest";
import { PHOTO_CUTOUT_ORT_WASM_FILE, PHOTO_CUTOUT_ORT_WASM_PATH } from "@/shared/constants.ts";
import { resolveOrtWasmPaths, supportsBackgroundRemoval } from "./remove-background.ts";

describe("supportsBackgroundRemoval", () => {
  it("boolean を返し、ライブラリ未ロードでも落ちない", () => {
    expect(typeof supportsBackgroundRemoval()).toBe("boolean");
  });
});

describe("resolveOrtWasmPaths", () => {
  it("origin 付きでも /models/ort/ 配下の wasm を指す", () => {
    expect(resolveOrtWasmPaths("http://127.0.0.1:5173")).toEqual({
      wasm: `http://127.0.0.1:5173${PHOTO_CUTOUT_ORT_WASM_PATH}${PHOTO_CUTOUT_ORT_WASM_FILE}`,
    });
  });

  it("末尾スラッシュ付き origin でもパスが二重にならない", () => {
    expect(resolveOrtWasmPaths("http://127.0.0.1:5173/").wasm).toBe(
      `http://127.0.0.1:5173${PHOTO_CUTOUT_ORT_WASM_PATH}${PHOTO_CUTOUT_ORT_WASM_FILE}`,
    );
  });

  it("origin が空なら同一オリジンの絶対パス", () => {
    expect(resolveOrtWasmPaths().wasm).toBe(
      `${PHOTO_CUTOUT_ORT_WASM_PATH}${PHOTO_CUTOUT_ORT_WASM_FILE}`,
    );
  });

  it("ディレクトリ接頭辞の new URL 結合は末尾スラッシュ無しだと親に潰れる", () => {
    expect(new URL(PHOTO_CUTOUT_ORT_WASM_FILE, "http://example.test/models/ort").pathname).toBe(
      `/models/${PHOTO_CUTOUT_ORT_WASM_FILE}`,
    );
    expect(new URL(PHOTO_CUTOUT_ORT_WASM_FILE, "http://example.test/models/ort/").pathname).toBe(
      `${PHOTO_CUTOUT_ORT_WASM_PATH}${PHOTO_CUTOUT_ORT_WASM_FILE}`,
    );
  });
});
