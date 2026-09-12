import { describe, expect, it } from "vitest";
import {
  filesFromList,
  IMAGE_PICK_FOCUS_GRACE_MS,
  IMAGE_PICK_LABELS,
  imagePickAttributes,
  resolvePickedFilesAfterFocus,
} from "@/client/lib/photo/pick-image.ts";

describe("imagePickAttributes", () => {
  it("撮影は capture=environment、ライブラリは capture なし", () => {
    expect(imagePickAttributes("camera")).toEqual({
      accept: "image/*",
      capture: "environment",
      multiple: false,
    });
    expect(imagePickAttributes("library")).toEqual({
      accept: "image/*",
      capture: null,
      multiple: false,
    });
    expect(imagePickAttributes("library", { multiple: true })).toEqual({
      accept: "image/*",
      capture: null,
      multiple: true,
    });
    expect(imagePickAttributes("camera", { multiple: true }).multiple).toBe(false);
  });

  it("ライブラリの文言は「ライブラリから」とノートの「選ぶ」", () => {
    expect(IMAGE_PICK_LABELS.library).toBe("ライブラリから");
    expect(IMAGE_PICK_LABELS.libraryMultiple).toBe("ライブラリから（複数枚）");
    expect(IMAGE_PICK_LABELS.noteLibrary).toBe("選ぶ");
  });
});

describe("resolvePickedFilesAfterFocus", () => {
  it("iOS の focus 先行では空のまま即キャンセルしない", () => {
    expect(resolvePickedFilesAfterFocus([], 400)).toBe("wait");
    expect(resolvePickedFilesAfterFocus([], IMAGE_PICK_FOCUS_GRACE_MS)).toBe("cancel");
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    expect(resolvePickedFilesAfterFocus([file], 10)).toBe("selected");
    expect(filesFromList(null)).toEqual([]);
  });
});
