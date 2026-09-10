import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "LogNewForm.tsx"), "utf8");
const edit = readFileSync(join(here, "LogEditForm.tsx"), "utf8");

describe("LogNewForm 写真からの種類・量の先埋め", () => {
  it("新規と編集の空欄だけ推測し、触った欄とボトル由来は上書きしない", () => {
    expect(source).toContain("startDrinkRecognition");
    expect(source).toContain("applyRecognizeToLogForm");
    expect(source).toContain("marks: aiMarksRef.current");
    expect(source).toContain("drinkRecognizeBannerMessage(recognizeStatus, recognizeAppliedCount)");
    expect(source).toContain("pendingDrinkRecognizeFields(state, touchedRef.current, aiMarks)");
    expect(source).toContain('setRecognizeStatus("empty")');
    expect(source).toContain('setRecognizeStatus("failure")');
    expect(source).toContain("lockInheritedRecognizeFields");
    expect(source).toContain("touchedRef.current.drinkType = true");
    expect(source).toContain("touchedRef.current.volumeMl = true");
    expect(source).toContain("usePhotoEdit");
    expect(source).toContain("usePhotoFormSession");
    expect(source).toContain("recognizeJpegForForm");
    expect(edit).toContain("usePhotoFormSession");
    expect(edit).toContain("recognizeJpegForForm");
    expect(source).not.toContain("useCaptureOnCameraQuery");
    expect(source).toContain("CompactPhotoField");
    expect(source).toContain("PhotoViewer");
    expect(source).toContain("savedRef.current");
    expect(edit).toContain("CompactPhotoField");
    expect(edit).toContain("startDrinkRecognition");
    expect(edit).toContain("lockInheritedRecognizeFields");
    expect(edit).toContain("PhotoViewer");
    expect(edit).toContain("savedRef.current");
  });

  it("共通識別と場所があり、ボトルは種類の次。後選択は手入力を残す", () => {
    expect(source.indexOf("<BottlePickerRow")).toBeGreaterThan(source.indexOf("<DrinkTypeSelect"));
    expect(source.indexOf("<IdentityFields")).toBeGreaterThan(source.indexOf("<BottlePickerRow"));
    expect(source.indexOf("<PlaceField")).toBeGreaterThan(source.indexOf("<DrunkAtRow"));
    expect(source.indexOf("<MemoField")).toBeGreaterThan(source.indexOf("<PlaceField"));
    expect(source).toContain("requestCurrentPosition");
    expect(source).toContain("getRecordLocationPref");
    expect(source).toContain("capturedAtToDrunkAt");
    expect(source).toContain("テイスティングノートをつける？");
    expect(source).toContain("noteFromLogHref");
    expect(source).toContain("TargetBottleChip");
    expect(source).toContain("preserveEdits: true");
    expect(source).toContain("inheritOwnedPhoto");
    expect(source).toContain("PHOTO_COPY_FAILED_MESSAGE");
    expect(source).toContain("firstPhotoId");
    expect(source).toContain('clearAttachment("log")');
    expect(edit).toContain('clearAttachment("log")');
    expect(source).toContain("記録した品名・識別と写真を引き継ぎます。");
    expect(source).not.toContain("写真はコピーしません");
    expect(edit).toContain("<IdentityFields");
    expect(edit).toContain("<PlaceField");
    expect(edit).not.toContain("requestCurrentPosition");
    expect(edit).not.toContain("テイスティングノートをつける？");
  });
});
