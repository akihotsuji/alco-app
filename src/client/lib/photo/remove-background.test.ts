import { describe, expect, it } from "vitest";
import { supportsBackgroundRemoval } from "./remove-background.ts";

describe("supportsBackgroundRemoval", () => {
  it("boolean を返し、ライブラリ未ロードでも落ちない", () => {
    expect(typeof supportsBackgroundRemoval()).toBe("boolean");
  });
});
