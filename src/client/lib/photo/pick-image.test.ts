import { describe, expect, it } from "vitest";
import { IMAGE_PICK_LABELS, imagePickAttributes } from "@/client/lib/photo/pick-image.ts";

describe("imagePickAttributes", () => {
  it("撮影は capture=environment、ライブラリは capture なし", () => {
    expect(imagePickAttributes("camera")).toEqual({
      accept: "image/*",
      capture: "environment",
    });
    expect(imagePickAttributes("library")).toEqual({
      accept: "image/*",
      capture: null,
    });
  });

  it("ライブラリの文言は「ライブラリから」とノートの「選ぶ」", () => {
    expect(IMAGE_PICK_LABELS.library).toBe("ライブラリから");
    expect(IMAGE_PICK_LABELS.noteLibrary).toBe("選ぶ");
  });
});
