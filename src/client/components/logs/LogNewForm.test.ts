import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "LogNewForm.tsx"), "utf8");
const edit = readFileSync(join(here, "LogEditForm.tsx"), "utf8");
const styles = readFileSync(join(here, "..", "..", "styles.css"), "utf8");

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
    expect(source).toContain("<LogTastingSection");
    expect(source).not.toContain("テイスティングノートをつける？");
    expect(source).not.toContain("noteFromLogHref");
    expect(source).toContain("TargetBottleChip");
    expect(source).toContain("preserveEdits: true");
    expect(source).toContain("inheritOwnedPhoto");
    expect(source).toContain("drinkLogSavePhotoId");
    expect(edit).toContain("drinkLogSavePhotoId");
    expect(source).toContain("PHOTO_COPY_FAILED_MESSAGE");
    expect(source).toContain("firstPhotoId");
    expect(source).toContain('clearAttachment("log")');
    expect(edit).toContain('clearAttachment("log")');
    expect(source).not.toContain("お酒の情報と写真をノートに引き継ぎます");
    expect(source).not.toContain("写真はコピーしません");
    expect(edit).toContain("<IdentityFields");
    expect(edit).toContain("<PlaceField");
    expect(edit).toContain("<LogTastingSection");
    expect(edit).toContain("onDeleteNote");
    for (const form of [source, edit]) {
      expect(form).toContain("<DrinkSearchLink");
      expect(form.indexOf("visibleErrors.drinkName")).toBeLessThan(
        form.indexOf("<DrinkSearchLink"),
      );
      expect(form).toContain("name={state.drinkName}");
    }
    expect(edit).not.toContain("requestCurrentPosition");
    expect(edit).not.toContain("テイスティングノートをつける？");
  });
});

describe("LogNewForm 横並び（ラベル左・入力右）", () => {
  it("品名・種類・識別・量・度数・日時・場所・メモが log-form-field", () => {
    for (const form of [source, edit]) {
      expect(form).toContain("log-form-section log-form-field");
    }
    const components = [
      "DrinkTypeSelect.tsx",
      "DrunkAtRow.tsx",
      "PlaceField.tsx",
      "MemoField.tsx",
      "VolumeField.tsx",
      "AbvField.tsx",
    ];
    for (const file of components) {
      const code = readFileSync(join(here, file), "utf8");
      expect(code).toContain("log-form-field");
    }
    const identity = readFileSync(join(here, "..", "form", "IdentityFields.tsx"), "utf8");
    expect(identity).toContain("log-form-field");
    expect(identity).toContain("log-identity-pair");
    expect(identity).not.toContain("bottle-details-pair");
    const origin = readFileSync(join(here, "..", "form", "OriginCountryField.tsx"), "utf8");
    expect(origin).toContain("log-form-field");
  });

  it("量・度数は grid のため section（fieldset/legend ではない）", () => {
    for (const file of ["VolumeField.tsx", "AbvField.tsx"]) {
      const code = readFileSync(join(here, file), "utf8");
      expect(code).not.toContain("<fieldset");
      expect(code).not.toContain("<legend");
      expect(code).toContain("<section");
    }
  });

  it("CSS が 2 列 grid で 360px/320px の折返しを持つ", () => {
    expect(styles).toContain(".log-form-field {");
    expect(styles).toContain("grid-template-columns: 6.5rem minmax(0, 1fr)");
    expect(styles).toContain(".log-form-field > .field-label");
    expect(styles).toContain(".log-form-field > :not(.field-label)");
    expect(styles).toContain(".log-form-field .abv-cluster");
    expect(styles).toContain(".log-form-field .unit-field-input");
    expect(styles).toContain("@media (max-width: 360px)");
    expect(styles).toContain("grid-template-columns: 5.5rem minmax(0, 1fr)");
    expect(styles).toContain("@media (max-width: 320px)");
    expect(styles).toContain(".log-identity-pair");
  });
});
