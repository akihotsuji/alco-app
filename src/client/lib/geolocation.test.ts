import { describe, expect, it } from "vitest";
import {
  isGeolocationSupported,
  queryGeolocationPermission,
  recordLocationCaption,
} from "./geolocation.ts";

describe("isGeolocationSupported", () => {
  it("navigator.geolocation の有無で判定する", () => {
    const original = navigator.geolocation;
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    expect(isGeolocationSupported()).toBe(false);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: original,
    });
  });
});

describe("queryGeolocationPermission", () => {
  it("Permissions API が無いときは unknown", async () => {
    const original = navigator.permissions;
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: undefined,
    });
    expect(await queryGeolocationPermission()).toBe("unknown");
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: original,
    });
  });
});

describe("recordLocationCaption", () => {
  it("非対応・拒否・それ以外で文言を分ける", () => {
    expect(recordLocationCaption(false, "unknown")).toBe("この端末では使えません");
    expect(recordLocationCaption(true, "denied")).toBe("端末の設定で位置情報を許可してください");
    expect(recordLocationCaption(true, "granted")).toBe("新規の記録で現在地を残します");
    expect(recordLocationCaption(true, "prompt")).toBe("新規の記録で現在地を残します");
  });
});
