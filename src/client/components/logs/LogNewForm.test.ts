import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "LogNewForm.tsx"), "utf8");
const edit = readFileSync(join(here, "LogEditForm.tsx"), "utf8");

describe("LogNewForm 写真からの種類・量の先埋め", () => {
  it("新規と編集の空欄だけ推測し、触った欄とボトル由来は上書きしない", () => {
    for (const form of [source, edit]) {
      // 二段階の読み取りは共有フックに寄せ、フォームは状態・候補を受け取るだけ
      expect(form).toContain("useDrinkPhotoRecognition({");
      expect(form).toContain("jpeg: recognizeJpegForForm(attachment, pendingRecognize, session)");
      expect(form).toContain(
        "drinkRecognizeBannerMessage(recognition.status, recognition.appliedCount)",
      );
      expect(form).toContain("aiPending={recognition.aiPending}");
      expect(form).toContain("originCandidate={recognition.originCandidate}");
      expect(form).toContain("recognition.reset()");
      expect(form).toContain("lockInheritedRecognizeFields");
      expect(form).toContain("usePhotoFormSession");
      expect(form).toContain("CompactPhotoField");
      expect(form).toContain("PhotoViewer");
      expect(form).toContain("savedRef,");
      expect(form).not.toContain("startDrinkRecognition");
    }
    expect(source).toContain("touchedRef.current.drinkType = true");
    expect(source).toContain("touchedRef.current.volumeMl = true");
    expect(source).toContain("usePhotoEdit");
    expect(source).not.toContain("useCaptureOnCameraQuery");
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
    expect(source).toContain("お酒の情報と写真をノートに引き継ぎます");
    expect(source).not.toContain("写真はコピーしません");
    expect(edit).toContain("<IdentityFields");
    expect(edit).toContain("<PlaceField");
    expect(edit).not.toContain("requestCurrentPosition");
    expect(edit).not.toContain("テイスティングノートをつける？");
  });
});
