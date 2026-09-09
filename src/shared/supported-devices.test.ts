import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SUPPORTED_ANDROID_BROWSER,
  SUPPORTED_ANDROID_CHROME_POLICY,
  SUPPORTED_IOS_MAJOR_MIN,
} from "./supported-devices.ts";

const spec = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../spec/qa-devices.md"),
  "utf8",
);

describe("supported-devices", () => {
  it("最小バージョンが qa-devices の確定と一致する", () => {
    expect(SUPPORTED_IOS_MAJOR_MIN).toBe(17);
    expect(SUPPORTED_ANDROID_BROWSER).toBe("Chrome");
    expect(SUPPORTED_ANDROID_CHROME_POLICY).toBe("latest-and-previous-major");
    expect(spec).toContain("**iOS 17+ Safari**");
    expect(spec).toContain("Android Chrome（最新および直前のメジャー）");
  });
});
