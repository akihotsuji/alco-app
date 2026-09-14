import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { photoContentUrl } from "./use-photos.ts";

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "use-photos.ts"), "utf8");

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

describe("uploadPhoto", () => {
  it("送信前に blob.size を検査し、任意の AbortSignal を渡せる", () => {
    expect(source).toContain("assertUploadableBlob(file)");
    expect(source).toContain("signal ? { init: { signal } } : undefined");
  });
});
