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
});
