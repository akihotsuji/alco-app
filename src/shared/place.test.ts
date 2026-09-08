import { describe, expect, it } from "vitest";
import {
  googleMapsSearchUrl,
  isSafeGoogleMapsHref,
  placeCoordsArePaired,
} from "./place.ts";

describe("placeCoordsArePaired", () => {
  it("両方省略・両方 null・両方数値だけ通す", () => {
    expect(placeCoordsArePaired({})).toBe(true);
    expect(placeCoordsArePaired({ placeLat: null, placeLng: null })).toBe(true);
    expect(placeCoordsArePaired({ placeLat: 35.6, placeLng: 139.7 })).toBe(true);
    expect(placeCoordsArePaired({ placeLat: 35.6 })).toBe(false);
    expect(placeCoordsArePaired({ placeLng: 139.7 })).toBe(false);
    expect(placeCoordsArePaired({ placeLat: 35.6, placeLng: null })).toBe(false);
  });
});

describe("googleMapsSearchUrl", () => {
  it("座標があれば lat,lng、なければ店名", () => {
    expect(googleMapsSearchUrl({ placeLat: 35.681, placeLng: 139.767 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=35.681%2C139.767",
    );
    expect(googleMapsSearchUrl({ placeName: "居酒屋 山田" })).toBe(
      "https://www.google.com/maps/search/?api=1&query=%E5%B1%85%E9%85%92%E5%B1%8B%20%E5%B1%B1%E7%94%B0",
    );
    expect(googleMapsSearchUrl({ placeName: "  " })).toBeNull();
  });
});

describe("isSafeGoogleMapsHref", () => {
  it("https の Google マップだけ許可する", () => {
    const ok = googleMapsSearchUrl({ placeName: "店" });
    expect(ok && isSafeGoogleMapsHref(ok)).toBe(true);
    expect(isSafeGoogleMapsHref("https://maps.google.com/maps?q=1,2")).toBe(true);
    expect(isSafeGoogleMapsHref("javascript:alert(1)")).toBe(false);
    expect(isSafeGoogleMapsHref("https://evil.example/maps")).toBe(false);
    expect(isSafeGoogleMapsHref("http://www.google.com/maps/search/?api=1&query=1")).toBe(false);
  });
});
