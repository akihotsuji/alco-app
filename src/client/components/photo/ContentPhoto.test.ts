import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isImageSettled } from "./ContentPhoto.tsx";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "ContentPhoto.tsx"), "utf8");
const tileSource = readFileSync(join(here, "../cellar/BottleTile.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("ContentPhoto", () => {
  it("既定は lazy と async decode で、寸法を属性に出す", () => {
    expect(source).toContain('loading = "lazy"');
    expect(source).toContain('decoding="async"');
    expect(source).toContain("draggable={false}");
    expect(source).toContain("width={size.width}");
    expect(source).toContain("height={size.height}");
    expect(source).toContain("logRow: { width: 48, height: 48 }");
    expect(source).toContain("bottleTile: { width: 100, height: 150 }");
  });

  it("到着状態を data-state に出し、load / error のどちらでも loaded にする（透明のまま残さない）", () => {
    expect(source).toContain("data-state={state}");
    expect(source).toContain("onLoad={settle}");
    expect(source).toContain("onError={settle}");
  });

  it("CSS は loading を不透明 0、loaded を 1 にして --dur-state でフェードする（M-29）", () => {
    expect(css).toMatch(/img\[data-state="loading"\]\s*\{\s*opacity:\s*0;/);
    expect(css).toMatch(
      /img\[data-state="loaded"\]\s*\{\s*opacity:\s*1;\s*transition:\s*opacity var\(--dur-state\)/,
    );
  });

  it("ブラウザキャッシュ済み（complete かつ幅あり）は load イベントを待たず loaded 扱い", () => {
    expect(isImageSettled({ complete: true, naturalWidth: 100 })).toBe(true);
    expect(isImageSettled({ complete: true, naturalWidth: 0 })).toBe(false);
    expect(isImageSettled({ complete: false, naturalWidth: 0 })).toBe(false);
  });

  it("BottleTile は写真到着まで種類のボトル型をプレースホルダに置き、到着でフェードアウトする", () => {
    expect(tileSource).toContain('className="bottle-tile-placeholder" data-state={photoState}');
    expect(tileSource).toContain("onStateChange={setPhotoState}");
    expect(css).toMatch(/\.bottle-tile-placeholder\[data-state="loaded"\]\s*\{\s*opacity:\s*0;/);
  });
});
