import { describe, expect, it } from "vitest";
import { APP_BUILD_ID_DEV } from "@/shared/app-version.ts";
import { readClientBuildId } from "./app-version.ts";

describe("readClientBuildId", () => {
  it("不正値は dev に倒す", () => {
    expect(readClientBuildId("29c3055deadbeef")).toBe("29c3055");
    expect(readClientBuildId("nope")).toBe(APP_BUILD_ID_DEV);
    expect(readClientBuildId(undefined)).toBe(APP_BUILD_ID_DEV);
  });
});
