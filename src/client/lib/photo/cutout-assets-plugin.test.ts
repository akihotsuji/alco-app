import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../../vite.cutout-assets.ts", import.meta.url), "utf8");

describe("cutoutAssets プラグイン", () => {
  it("ORT の mjs/wasm は存在チェックで省略せず毎回上書きコピーする", () => {
    expect(source).toContain("copyFileSync(join(ortDist, file), join(ortDir, file))");
    expect(source).toContain("PHOTO_CUTOUT_ORT_JSEP_WASM_FILE");
    expect(source).toContain("PHOTO_CUTOUT_ORT_JSEP_MJS_FILE");
    expect(source).not.toMatch(/if\s*\(\s*!existsSync\(dest\)\s*\)/);
  });

  it("hashed な JSEP wasm はバンドルから除き /models/ort/ だけを使う", () => {
    expect(source).toContain("generateBundle");
    expect(source).toContain("ort-wasm-simd-threaded\\.jsep.*\\.wasm");
  });

  it("配置するモデルはサイズとハッシュで検証する", () => {
    expect(source).toContain("PHOTO_CUTOUT_MODEL_SHA256");
    expect(source).toContain("PHOTO_CUTOUT_MODEL_BYTES");
  });
});
