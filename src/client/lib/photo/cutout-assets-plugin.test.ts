import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../../../../vite.cutout-assets.ts", import.meta.url), "utf8");

describe("cutoutAssets プラグイン", () => {
  it("ORT の mjs/wasm は存在チェックで省略せず毎回上書きコピーする", () => {
    expect(source).toContain("copyFileSync(join(ortDist, file), join(ortDir, file))");
    expect(source).not.toMatch(/if\s*\(\s*!existsSync\(dest\)\s*\)/);
  });

  it("配置するモデルはサイズとハッシュで検証する", () => {
    expect(source).toContain("PHOTO_CUTOUT_MODEL_SHA256");
    expect(source).toContain("PHOTO_CUTOUT_MODEL_BYTES");
  });
});
