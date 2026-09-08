import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "LogNewForm.tsx"), "utf8");
const edit = readFileSync(join(here, "LogEditForm.tsx"), "utf8");

describe("LogNewForm 写真からの種類・量の先埋め", () => {
  it("新規だけ推測し、触った欄は上書きしない。編集は変えない", () => {
    expect(source).toContain("startDrinkRecognition");
    expect(source).toContain("applyRecognizeToLogForm");
    expect(source).toContain("DRINK_RECOGNIZE_BANNER");
    expect(source).toContain("touchedRef.current.drinkType = true");
    expect(source).toContain("touchedRef.current.volumeMl = true");
    expect(source).toContain("usePhotoEdit");
    expect(source).not.toContain("useCaptureOnCameraQuery");
    expect(source).toContain("CompactPhotoField");
    expect(edit).toContain("CompactPhotoField");
    expect(edit).not.toContain("startDrinkRecognition");
  });

  it("共通識別と場所があり、ボトルは種類の次。後選択は手入力を残す", () => {
    expect(source.indexOf("<BottlePickerRow")).toBeGreaterThan(source.indexOf("<DrinkTypeSelect"));
    expect(source.indexOf("<IdentityFields")).toBeGreaterThan(source.indexOf("<BottlePickerRow"));
    expect(source.indexOf("<PlaceField")).toBeGreaterThan(source.indexOf("<DrunkAtRow"));
    expect(source.indexOf("<MemoField")).toBeGreaterThan(source.indexOf("<PlaceField"));
    expect(source).toContain("requestCurrentPosition");
    expect(source).toContain("capturedAtToDrunkAt");
    expect(source).toContain("テイスティングノートをつける？");
    expect(source).toContain("noteFromLogHref");
    expect(source).toContain("TargetBottleChip");
    expect(source).toContain("preserveEdits: true");
    expect(edit).toContain("<IdentityFields");
    expect(edit).toContain("<PlaceField");
    expect(edit).not.toContain("requestCurrentPosition");
    expect(edit).not.toContain("テイスティングノートをつける？");
  });
});
