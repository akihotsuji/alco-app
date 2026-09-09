import { describe, expect, it } from "vitest";
import { isHttpsSourceUrl, recognizeSourceSchema } from "./ai-recognition.ts";

describe("isHttpsSourceUrl / recognizeSourceSchema", () => {
  it("https の出典だけ通す", () => {
    expect(isHttpsSourceUrl("https://example.test/sheet")).toBe(true);
    expect(recognizeSourceSchema.parse({ url: "https://example.test/sheet" }).url).toBe(
      "https://example.test/sheet",
    );
  });

  it("javascript / http / userinfo は拒否する", () => {
    expect(isHttpsSourceUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpsSourceUrl("http://example.test/sheet")).toBe(false);
    expect(isHttpsSourceUrl("https://user:pass@example.test/sheet")).toBe(false);
    expect(recognizeSourceSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(recognizeSourceSchema.safeParse({ url: "http://example.test/sheet" }).success).toBe(
      false,
    );
  });
});
