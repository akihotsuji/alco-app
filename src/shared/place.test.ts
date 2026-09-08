import { describe, expect, it } from "vitest";
import {
  googleMapsSearchUrl,
  hasPlaceCoords,
  isSafeGoogleMapsHref,
  PLACE_UI,
  placeCoordsArePaired,
  placeDedupeKey,
  placeMapsLinkLabel,
  placesForDay,
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

describe("placeMapsLinkLabel", () => {
  it("座標ありは見る、店名だけは探す。Google マップで開くは使わない", () => {
    expect(placeMapsLinkLabel({ placeLat: 35.6, placeLng: 139.7 })).toBe(
      PLACE_UI.formMapsWithCoords,
    );
    expect(placeMapsLinkLabel({ placeName: "居酒屋" })).toBe(PLACE_UI.formMapsNameOnly);
    expect(PLACE_UI.formMapsWithCoords).not.toContain("Google");
    expect(PLACE_UI.dayHeading).toBe("その日いた場所");
  });
});

describe("placesForDay", () => {
  it("店名または座標がある場所だけ出し、近い座標はまとめる", () => {
    expect(placesForDay([])).toEqual([]);
    expect(placesForDay([{ placeName: "  ", placeLat: null, placeLng: null }])).toEqual([]);
    expect(hasPlaceCoords({ placeLat: 35.681, placeLng: 139.767 })).toBe(true);

    const named = placesForDay([{ placeName: "居酒屋 山田", placeLat: null, placeLng: null }]);
    expect(named).toHaveLength(1);
    expect(named[0]?.label).toBe("居酒屋 山田");
    expect(named[0]?.href && isSafeGoogleMapsHref(named[0].href)).toBe(true);

    const coords = placesForDay([{ placeLat: 35.681, placeLng: 139.767 }]);
    expect(coords).toHaveLength(1);
    expect(coords[0]?.label).toBe(PLACE_UI.dayUnnamed);
    expect(coords[0]?.href).toContain("35.681");

    const dup = placesForDay([
      { placeName: "店", placeLat: 35.68121, placeLng: 139.76711 },
      { placeName: "店", placeLat: 35.68124, placeLng: 139.76714 },
    ]);
    expect(placeDedupeKey({ placeName: "店", placeLat: 35.68121, placeLng: 139.76711 })).toBe(
      placeDedupeKey({ placeName: "店", placeLat: 35.68124, placeLng: 139.76714 }),
    );
    expect(dup).toHaveLength(1);

    const many = placesForDay([
      { placeName: "居酒屋", placeLat: 35.6, placeLng: 139.7 },
      { placeLat: 34.7, placeLng: 135.5 },
    ]);
    expect(many.map((place) => place.label)).toEqual(["居酒屋", PLACE_UI.dayUnnamed]);
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
