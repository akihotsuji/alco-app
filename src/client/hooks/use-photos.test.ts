import { describe, expect, it } from "vitest";
import { photoContentUrl } from "./use-photos.ts";

describe("photoContentUrl", () => {
  it("原本はクエリなし、一覧は variant=thumb", () => {
    expect(photoContentUrl("11111111-1111-4111-8111-111111111111")).toBe(
      "/api/photos/11111111-1111-4111-8111-111111111111/content",
    );
    expect(photoContentUrl("11111111-1111-4111-8111-111111111111", "thumb")).toBe(
      "/api/photos/11111111-1111-4111-8111-111111111111/content?variant=thumb",
    );
  });
});
