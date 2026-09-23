import { describe, expect, it } from "vitest";
import { makeUploadThumb, uploadThumbType } from "./upload-thumb.ts";

describe("uploadThumbType", () => {
  it("切り抜き（WebP / PNG）は透過を残す PNG、それ以外は JPEG", () => {
    expect(uploadThumbType("image/webp")).toBe("image/png");
    expect(uploadThumbType("image/png")).toBe("image/png");
    expect(uploadThumbType("image/jpeg")).toBe("image/jpeg");
    expect(uploadThumbType("")).toBe("image/jpeg");
  });
});

describe("makeUploadThumb", () => {
  it("Canvas が使えない環境では null（原本だけ送る）", async () => {
    await expect(makeUploadThumb(new Blob(["x"], { type: "image/jpeg" }))).resolves.toBeNull();
  });
});
