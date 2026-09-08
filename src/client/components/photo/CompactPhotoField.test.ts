import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const field = readFileSync(join(here, "CompactPhotoField.tsx"), "utf8");
const logNew = readFileSync(join(here, "../logs/LogNewForm.tsx"), "utf8");
const bottle = readFileSync(join(here, "../cellar/BottleForm.tsx"), "utf8");

describe("CompactPhotoField 撮影と選択", () => {
  it("記録・セラーとも撮影と選択を同じ行で出せる", () => {
    expect(field).toContain("写真を撮る");
    expect(field).toContain("IMAGE_PICK_LABELS.captureLibrary");
    expect(field).toContain("photo-action-row");
    expect(logNew).toContain("CompactPhotoField");
    expect(logNew).toContain('startCapture("log", { source: "library" })');
    expect(bottle).toContain("CompactPhotoField");
    expect(bottle).toContain('startCapture("cellar", { source: "library" })');
    expect(bottle).toContain('ratio="bottle"');
    expect(bottle).not.toContain("PhotoTile");
  });
});
