import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BOTTLE_PHOTO_ACTION_LABELS } from "@/client/lib/bottle-photo-actions.ts";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "BottlePhotoPair.tsx"),
  "utf8",
);

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
});
