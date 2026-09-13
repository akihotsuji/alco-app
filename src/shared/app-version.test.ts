import { describe, expect, it } from "vitest";
import {
  APP_BUILD_ID_DEV,
  createAppVersionManifest,
  formatAppVersionLabel,
  isForceRefreshCacheKey,
  parseAppVersionManifest,
  resolveAppBuildId,
  resolveAppBuildIdFromEnv,
  sanitizeAppBuildId,
  shouldNotifyPublishedUpdate,
  shouldRunVersionCheck,
} from "./app-version.ts";
import { APP_VERSION, PHOTO_CUTOUT_CACHE } from "./constants.ts";

describe("sanitizeAppBuildId", () => {
  it("長い SHA を 7 桁の小文字にする", () => {
    expect(sanitizeAppBuildId("29C3055ABCDEF")).toBe("29c3055");
    expect(sanitizeAppBuildId("dev")).toBe(APP_BUILD_ID_DEV);
    expect(sanitizeAppBuildId("not a sha")).toBeNull();
    expect(sanitizeAppBuildId("")).toBeNull();
  });
});

describe("resolveAppBuildId", () => {
  it("明示値 → GitHub SHA → git の順で使う", () => {
    expect(
      resolveAppBuildId({
        explicit: "aaaaaaaa",
        githubSha: "bbbbbbb",
        gitSha: "ccccccc",
      }),
    ).toBe("aaaaaaa");
    expect(resolveAppBuildId({ githubSha: "bbbbbbbcccc", gitSha: "ccccccc" })).toBe("bbbbbbb");
    expect(resolveAppBuildId({ gitSha: "ccccccc" })).toBe("ccccccc");
    expect(resolveAppBuildId({})).toBe(APP_BUILD_ID_DEV);
  });

  it("環境変数から同じ順で読む", () => {
    expect(
      resolveAppBuildIdFromEnv({ VITE_APP_BUILD_ID: "1111111", GITHUB_SHA: "2222222" }, "3333333"),
    ).toBe("1111111");
    expect(resolveAppBuildIdFromEnv({ GITHUB_SHA: "2222222" }, "3333333")).toBe("2222222");
    expect(resolveAppBuildIdFromEnv({}, "3333333")).toBe("3333333");
  });
});

describe("formatAppVersionLabel", () => {
  it("名称・製品版・ビルド ID を並べる", () => {
    expect(formatAppVersionLabel("酒のしおり", APP_VERSION, "29c3055")).toBe(
      "酒のしおり 0.1.0 (29c3055)",
    );
  });
});

describe("parseAppVersionManifest", () => {
  it("未知キーと HTML を捨てる", () => {
    expect(parseAppVersionManifest({ version: APP_VERSION, buildId: "29c3055" })).toEqual({
      version: APP_VERSION,
      buildId: "29c3055",
    });
    expect(
      parseAppVersionManifest({ version: APP_VERSION, buildId: "29c3055", extra: true }),
    ).toBeNull();
    expect(parseAppVersionManifest("<!doctype html>")).toBeNull();
    expect(createAppVersionManifest("29c3055")).toEqual({
      version: APP_VERSION,
      buildId: "29c3055",
    });
  });
});

describe("shouldNotifyPublishedUpdate", () => {
  it("配信中のビルドが違うときだけ通知する", () => {
    expect(
      shouldNotifyPublishedUpdate("aaaaaaa", { version: APP_VERSION, buildId: "bbbbbbb" }),
    ).toBe(true);
    expect(
      shouldNotifyPublishedUpdate("aaaaaaa", { version: APP_VERSION, buildId: "aaaaaaa" }),
    ).toBe(false);
    expect(shouldNotifyPublishedUpdate("aaaaaaa", null)).toBe(false);
  });
});

describe("shouldRunVersionCheck", () => {
  it("初回は走り、間隔内は走らない", () => {
    expect(shouldRunVersionCheck(null, 1_000, 30_000)).toBe(true);
    expect(shouldRunVersionCheck(1_000, 20_000, 30_000)).toBe(false);
    expect(shouldRunVersionCheck(1_000, 31_000, 30_000)).toBe(true);
  });
});

describe("isForceRefreshCacheKey", () => {
  it("Workbox だけ消し、切り抜きモデルは残す", () => {
    expect(isForceRefreshCacheKey("workbox-precache-v2-https://example.test/")).toBe(true);
    expect(isForceRefreshCacheKey("alco-precache-v1")).toBe(true);
    expect(isForceRefreshCacheKey(PHOTO_CUTOUT_CACHE)).toBe(false);
    expect(isForceRefreshCacheKey("random-cache")).toBe(false);
  });
});
