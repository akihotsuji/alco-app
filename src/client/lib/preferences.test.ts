import { describe, expect, it } from "vitest";
import { PHOTO_PREF_KEYS } from "@/shared/constants.ts";

describe("PHOTO_PREF_KEYS", () => {
  it("設定と photo-edit が同じキーを読む", () => {
    expect(PHOTO_PREF_KEYS).toEqual({
      mascot: "photo.mascot",
      filter: "photo.filter",
      cutout: "photo.cutout",
      recognize: "cellar.recognize",
    });
  });
});
