import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOTTLE_PHOTO_ACTION_LABELS } from "@/client/lib/bottle-photo-actions.ts";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "BottlePhotoPair.tsx"), "utf8");
const css = readFileSync(join(here, "../../styles.css"), "utf8");

describe("BottlePhotoPair", () => {
  it("表面は切り抜き調整を含み、裏面は切り抜き調整を出さない", () => {
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.adjustCrop");
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.recapture");
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.reselect");
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.deletePhoto");
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.addBack");
    expect(source.indexOf("adjustCrop")).toBeLessThan(source.lastIndexOf("backActions"));
    expect(source.slice(source.indexOf("const backActions"))).not.toContain("adjustCrop");
    expect(BOTTLE_PHOTO_ACTION_LABELS.deletePhoto).toBe("写真を削除");
    expect(BOTTLE_PHOTO_ACTION_LABELS.deletePhoto).not.toContain("ボトル");
  });

  it("空状態は主写真1枠で、表裏の同じ空枠を並べない", () => {
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.addFrontPrompt");
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.captureShort");
    expect(source).toContain("BOTTLE_PHOTO_ACTION_LABELS.libraryShort");
    expect(source).toContain("bottle-photo-drop");
    expect(source).not.toContain("bottle-photo-empty");
    expect(source).toContain("hasFront ? (");
    expect(source).toContain('onClick={() => setPanel("front")}');
    expect(BOTTLE_PHOTO_ACTION_LABELS.addBack).toBe("＋ 裏ラベルを追加（任意）");
    expect(BOTTLE_PHOTO_ACTION_LABELS.captureShort).toBe("撮影");
    expect(BOTTLE_PHOTO_ACTION_LABELS.libraryShort).toBe("ライブラリ");
  });

  it("表面と裏ラベルはボトル詳細と同じ横並び（主 240px の脇に 64×96）", () => {
    expect(source).toContain("bottle-photo-filled has-back");
    expect(source).toContain('className="bottle-hero-img is-photo"');
    expect(source).toContain("PHOTO_DISPLAY_SIZE.bottleHero");
    expect(source).toContain('className="bottle-back-thumb"');
    expect(source).toContain("photo-thumb bottle-back-thumb-frame");
    expect(source).not.toContain("FilledSlot");
    expect(css).toMatch(/\.bottle-photo-filled \{\s*display: flex;/);
    expect(css).toContain(".bottle-photo-filled.has-back .bottle-photo-hero");
    expect(css).toContain(".bottle-back-thumb-frame .photo-thumb-img");
  });
});
