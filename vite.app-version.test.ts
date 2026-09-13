import { describe, expect, it } from "vitest";
import { APP_BUILD_ID_DEV } from "./src/shared/app-version.ts";
import { resolveBuildTimeAppBuildId } from "./vite.app-version.ts";

describe("resolveBuildTimeAppBuildId", () => {
  it("VITE_APP_BUILD_ID を優先する", () => {
    expect(
      resolveBuildTimeAppBuildId({
        VITE_APP_BUILD_ID: "abcdef1",
        GITHUB_SHA: "1111111",
      }),
    ).toBe("abcdef1");
  });

  it("不正な明示値は GitHub SHA に倒す", () => {
    expect(
      resolveBuildTimeAppBuildId({
        VITE_APP_BUILD_ID: "not-a-sha",
        GITHUB_SHA: "2222222dddd",
      }),
    ).toBe("2222222");
  });

  it("何も無ければ git か dev", () => {
    const id = resolveBuildTimeAppBuildId({});
    expect(id === APP_BUILD_ID_DEV || /^[0-9a-f]{7}$/.test(id)).toBe(true);
  });
});
