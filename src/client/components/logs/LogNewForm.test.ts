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

  it("関連付けは保存直前の任意行で、後選択は手入力を残す", () => {
    expect(source.indexOf('placement="optional"')).toBeGreaterThan(source.indexOf("<MemoField"));
    expect(source).toContain("TargetBottleChip");
    expect(source).toContain("preserveEdits: true");
    expect(edit).toContain('placement="optional"');
    expect(edit.indexOf('placement="optional"')).toBeGreaterThan(edit.indexOf("<MemoField"));
  });
});
