import { describe, expect, it } from "vitest";
import {
  capturedAtFromFile,
  capturedAtToCalendarDate,
  capturedAtToDrunkAt,
  readJpegExifCapturedAt,
  shouldKeepQueryDrunkAt,
} from "./captured-at.ts";

function writeU16(bytes: Uint8Array, offset: number, value: number, little: boolean) {
  if (little) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
  } else {
    bytes[offset] = (value >> 8) & 0xff;
    bytes[offset + 1] = value & 0xff;
  }
}

function writeU32(bytes: Uint8Array, offset: number, value: number, little: boolean) {
  if (little) {
    bytes[offset] = value & 0xff;
    bytes[offset + 1] = (value >> 8) & 0xff;
    bytes[offset + 2] = (value >> 16) & 0xff;
    bytes[offset + 3] = (value >> 24) & 0xff;
  } else {
    bytes[offset] = (value >> 24) & 0xff;
    bytes[offset + 1] = (value >> 16) & 0xff;
    bytes[offset + 2] = (value >> 8) & 0xff;
    bytes[offset + 3] = value & 0xff;
  }
}

/** DateTimeOriginal だけを持つ最小 JPEG */
function jpegWithExifDate(raw: string): Uint8Array {
  const tiff = new Uint8Array(64);
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  writeU16(tiff, 2, 0x002a, true);
  writeU32(tiff, 4, 8, true);
  writeU16(tiff, 8, 1, true);
  writeU16(tiff, 10, 0x8769, true);
  writeU16(tiff, 12, 4, true);
  writeU32(tiff, 14, 1, true);
  writeU32(tiff, 18, 26, true);
  writeU32(tiff, 22, 0, true);
  writeU16(tiff, 26, 1, true);
  writeU16(tiff, 28, 0x9003, true);
  writeU16(tiff, 30, 2, true);
  writeU32(tiff, 32, 20, true);
  writeU32(tiff, 36, 44, true);
  writeU32(tiff, 40, 0, true);
  for (let i = 0; i < raw.length; i += 1) {
    tiff[44 + i] = raw.charCodeAt(i);
  }
  tiff[44 + 19] = 0;

  const app1Len = 2 + 6 + tiff.length;
  const jpeg = new Uint8Array(4 + 2 + app1Len + 2);
  jpeg[0] = 0xff;
  jpeg[1] = 0xd8;
  jpeg[2] = 0xff;
  jpeg[3] = 0xe1;
  writeU16(jpeg, 4, app1Len, false);
  jpeg[6] = 0x45;
  jpeg[7] = 0x78;
  jpeg[8] = 0x69;
  jpeg[9] = 0x66;
  jpeg[10] = 0;
  jpeg[11] = 0;
  jpeg.set(tiff, 12);
  jpeg[12 + tiff.length] = 0xff;
  jpeg[13 + tiff.length] = 0xd9;
  return jpeg;
}

describe("readJpegExifCapturedAt", () => {
  it("DateTimeOriginal を Asia/Tokyo として ISO にする", () => {
    const bytes = jpegWithExifDate("2026:03:15 18:30:00");
    expect(readJpegExifCapturedAt(bytes)).toBe("2026-03-15T09:30:00.000Z");
  });

  it("JPEG でなければ null", () => {
    expect(readJpegExifCapturedAt(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("capturedAtFromFile", () => {
  it("EXIF が無いときは lastModified を使う", async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], "x.jpg", {
      type: "image/jpeg",
      lastModified: Date.parse("2026-04-01T00:00:00.000Z"),
    });
    expect(await capturedAtFromFile(file)).toBe("2026-04-01T00:00:00.000Z");
  });
});

describe("capturedAtToDrunkAt / capturedAtToCalendarDate", () => {
  const now = new Date("2026-09-08T03:00:00.000Z");

  it("記録の未来はいまにクランプする", () => {
    expect(capturedAtToDrunkAt("2026-09-08T04:00:00.000Z", now)).toBe(now.toISOString());
    expect(capturedAtToDrunkAt("2026-09-08T03:10:00.000Z", now)).toBe("2026-09-08T03:10:00.000Z");
  });

  it("ノート / セラーの日は未来なら今日", () => {
    expect(capturedAtToCalendarDate("2026-09-10T00:00:00.000Z", now)).toBe("2026-09-08");
    expect(capturedAtToCalendarDate("2026-08-01T15:00:00.000Z", now)).toBe("2026-08-02");
  });
});

describe("shouldKeepQueryDrunkAt", () => {
  const now = new Date("2026-09-08T03:00:00.000Z");

  it("過去日クエリだけ撮影日で上書きしない", () => {
    expect(shouldKeepQueryDrunkAt("2026-09-07", now)).toBe(true);
    expect(shouldKeepQueryDrunkAt("2026-09-08", now)).toBe(false);
    expect(shouldKeepQueryDrunkAt(null, now)).toBe(false);
  });
});
