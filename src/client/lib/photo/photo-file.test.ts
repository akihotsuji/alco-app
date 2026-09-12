import { describe, expect, it } from "vitest";
import { isCutoutBlobType, photoFileName } from "./photo-file.ts";

describe("photoFileName", () => {
  it("MIME に合わせて拡張子を付ける", () => {
    expect(photoFileName("image/webp")).toBe("photo.webp");
    expect(photoFileName("image/png")).toBe("photo.png");
    expect(photoFileName("image/jpeg")).toBe("photo.jpg");
    expect(photoFileName("")).toBe("photo.jpg");
  });
});

describe("isCutoutBlobType", () => {
  it("WebP と PNG を切り抜きとして扱う", () => {
    expect(isCutoutBlobType("image/webp")).toBe(true);
    expect(isCutoutBlobType("image/png")).toBe(true);
    expect(isCutoutBlobType("image/jpeg")).toBe(false);
  });
});
