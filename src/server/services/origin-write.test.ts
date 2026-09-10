import { describe, expect, it } from "vitest";
import { ORIGIN_MESSAGES } from "@/shared/origin-countries.ts";
import { ApiError } from "../errors.ts";
import { writtenOrigin } from "./origin-write.ts";

describe("writtenOrigin", () => {
  it("省略は undefined、空は null、正規化できる値は日本語名", () => {
    expect(writtenOrigin(undefined)).toBeUndefined();
    expect(writtenOrigin(null)).toBeNull();
    expect(writtenOrigin("")).toBeNull();
    expect(writtenOrigin("France")).toBe("フランス");
  });

  it("新しい不正値は 400。既存不正値の維持は通す", () => {
    expect(() => writtenOrigin("DOCG")).toThrow(ApiError);
    try {
      writtenOrigin("DOCG");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).fields).toEqual({ origin: [ORIGIN_MESSAGES.invalid] });
    }
    expect(writtenOrigin("DOCG", "DOCG")).toBe("DOCG");
  });
});
